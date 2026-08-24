import React, { useEffect, useRef } from "react";
import { View, TouchableOpacity } from "react-native";
import { NavigationContainer, NavigationContainerRef, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useShareIntentContext } from "expo-share-intent";
import DeviceListScreen from "../screens/DeviceListScreen";
import AddDeviceScreen from "../screens/AddDeviceScreen";
import ScanQRScreen from "../screens/ScanQRScreen";
import HomeScreen from "../screens/HomeScreen";
import FileBrowserScreen from "../screens/FileBrowserScreen";
import FilePreviewScreen from "../screens/FilePreviewScreen";
import SettingsScreen from "../screens/SettingsScreen";
import AlertSettingsScreen from "../screens/AlertSettingsScreen";
import LegalScreen from "../screens/LegalScreen";
import ShareUploadScreen from "../screens/ShareUploadScreen";
import MediaScreen from "../screens/MediaScreen";
import MediaViewerScreen from "../screens/MediaViewerScreen";
import { MediaItem } from "../types";
import { useDevices } from "../context/DevicesContext";
import { useTheme } from "../context/ThemeContext";
import { createClient } from "../api/client";
import { registerPushForDevice } from "../utils/pushNotifications";

export type RootStackParamList = {
  DeviceList: undefined;
  AddDevice: { editDeviceId?: string } | undefined;
  ScanQR: undefined;
  Home: undefined;
  FileBrowser: { path: string } | undefined;
  FilePreview: { path: string; name: string };
  Settings: undefined;
  AlertSettings: undefined;
  Legal: undefined;
  ShareUpload: undefined;
  Media: undefined;
  MediaViewer: { items: MediaItem[]; initialIndex: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Pushes the ShareUpload modal whenever the app is opened from a system
// share sheet (e.g. gallery → share → Mooni).
function ShareIntentGate({
  navigationRef,
}: {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}) {
  const { hasShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (hasShareIntent) {
      navigationRef.current?.navigate("ShareUpload");
    }
  }, [hasShareIntent, navigationRef]);
  return null;
}

export default function RootNavigator() {
  const { loading, activeDevice } = useDevices();
  const { mode, colors } = useTheme();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Best-effort: hand this phone's Expo push token to the active device's
  // backend so it can push threshold alerts. No-op in Expo Go / when denied.
  const activeDeviceId = activeDevice?.id;
  useEffect(() => {
    if (activeDevice && activeDeviceId) {
      registerPushForDevice(createClient(activeDevice), activeDeviceId);
    }
  }, [activeDevice, activeDeviceId]);

  if (loading) return null;

  const base = mode === "dark" ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.cardAlt,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <ShareIntentGate navigationRef={navigationRef} />
      <Stack.Navigator initialRouteName={activeDevice ? "Home" : "DeviceList"}>
        <Stack.Screen
          name="DeviceList"
          component={DeviceListScreen}
          options={{ title: "My Devices" }}
        />
        <Stack.Screen
          name="AddDevice"
          component={AddDeviceScreen}
          options={{ title: "Add Device" }}
        />
        <Stack.Screen
          name="ScanQR"
          component={ScanQRScreen}
          options={{ title: "Scan QR", presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: activeDevice?.name ?? "Mooni",
            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
                  <Ionicons name="settings-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate("DeviceList")}>
                  <Ionicons name="list" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ),
          })}
        />
        <Stack.Screen
          name="FileBrowser"
          component={FileBrowserScreen}
          initialParams={{ path: "" }}
          options={({ navigation }) => ({
            title: activeDevice?.name ?? "Files",
            headerRight: () => (
              <TouchableOpacity onPress={() => navigation.navigate("Home")}>
                <Ionicons name="home-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name="FilePreview"
          component={FilePreviewScreen}
          options={({ route }) => ({ title: route.params.name })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Settings" }}
        />
        <Stack.Screen
          name="AlertSettings"
          component={AlertSettingsScreen}
          options={{ title: "Threshold Alerts" }}
        />
        <Stack.Screen
          name="Legal"
          component={LegalScreen}
          options={{ title: "Terms & Privacy" }}
        />
        <Stack.Screen
          name="ShareUpload"
          component={ShareUploadScreen}
          options={{ title: "Upload to Mooni", presentation: "modal" }}
        />
        <Stack.Screen
          name="Media"
          component={MediaScreen}
          options={{ title: "Media" }}
        />
        <Stack.Screen
          name="MediaViewer"
          component={MediaViewerScreen}
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
