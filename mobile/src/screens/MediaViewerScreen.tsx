import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { VideoView, useVideoPlayer, VideoSource } from "expo-video";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useDevices } from "../context/DevicesContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";
import { createClient } from "../api/client";
import { mediaUrl, deleteMedia } from "../api/media";
import { downloadFile } from "../api/files";
import PinchZoomImage from "./components/PinchZoomImage";

type Props = NativeStackScreenProps<RootStackParamList, "MediaViewer">;

function MediaPlayer({ source, style }: { source: VideoSource; style: object }) {
  const player = useVideoPlayer(source, (player) => {
    player.loop = false;
  });
  return <VideoView player={player} style={style} nativeControls contentFit="contain" />;
}

/**
 * Vertical drag-to-dismiss wrapper (Google Photos style). Only claims the
 * gesture for a single-finger downward drag — unzoomed horizontal swipes
 * still reach the pager, and PinchZoomImage keeps priority while zoomed.
 * Reports drag progress (0..1) so the screen can fade background + bars.
 */
function DragDismissView({
  progress,
  onDismiss,
  children,
}: {
  progress: Animated.Value;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;

  const settle = () =>
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: false }),
      Animated.spring(progress, { toValue: 0, friction: 7, tension: 60, useNativeDriver: false }),
    ]).start();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        g.numberActiveTouches === 1 && g.dy > 12 && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => {
        const dy = Math.max(0, g.dy);
        translateY.setValue(dy);
        progress.setValue(Math.min(1, dy / (height * 0.4)));
      },
      onPanResponderRelease: (_e, g) => {
        const shouldDismiss = g.dy > height * 0.25 || (g.vy > 0.9 && g.dy > 40);
        if (shouldDismiss) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: height,
              duration: 180,
              useNativeDriver: false,
            }),
            Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: false }),
          ]).start(() => onDismiss());
        } else {
          settle();
        }
      },
      onPanResponderTerminate: settle,
    })
  ).current;

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateY }] }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

export default function MediaViewerScreen({ route, navigation }: Props) {
  const { items, initialIndex } = route.params;
  const { activeDevice } = useDevices();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { width, height } = useWindowDimensions();

  const [index, setIndex] = useState(initialIndex);
  const [busy, setBusy] = useState(false);
  // 0..1 while a drag-to-dismiss gesture is in flight; fades bg + overlay.
  const dragProgress = useRef(new Animated.Value(0)).current;

  const item = items[index];

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    const v = viewableItems[0];
    if (v && v.index != null) setIndex(v.index);
  }).current;

  if (!activeDevice) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>No device selected.</Text>
      </View>
    );
  }

  const handleDownloadAndShare = async () => {
    setBusy(true);
    try {
      if (!activeDevice) return;
      const localUri = await downloadFile(
        activeDevice.baseUrl,
        activeDevice.apiKey,
        item.path,
        item.name
      );
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri);
      } else {
        Alert.alert("Done", `File saved to:\n${localUri}`);
      }
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete media?", `"${item.name}" will be permanently deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!activeDevice) return;
          try {
            const client = createClient(activeDevice);
            await deleteMedia(client, [item.path]);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert("Failed", e?.response?.data?.error ?? e.message);
          }
        },
      },
    ]);
  };

  const renderPage = ({ item: m }: { item: (typeof items)[number] }) => (
    <View style={[styles.page, { width }]} key={m.path}>
      {m.kind === "video" ? (
        <MediaPlayer
          source={{
            uri: mediaUrl(activeDevice, "preview", m.path),
            headers: { "X-API-Key": activeDevice.apiKey },
          }}
          style={styles.video}
        />
      ) : (
        <DragDismissView progress={dragProgress} onDismiss={() => navigation.goBack()}>
          <PinchZoomImage
            uri={mediaUrl(activeDevice, "preview", m.path, "large")}
            headers={{ "X-API-Key": activeDevice.apiKey }}
          />
        </DragDismissView>
      )}
    </View>
  );

  // Warm expo-image's disk cache for the next image so swiping feels instant.
  // (Image.prefetch can't send our X-API-Key header, so download invisibly.)
  const next = items[index + 1];
  const prefetchSource =
    activeDevice && next && next.kind === "image"
      ? {
          uri: mediaUrl(activeDevice, "preview", next.path, "large"),
          headers: { "X-API-Key": activeDevice.apiKey },
        }
      : null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: dragProgress.interpolate({
            inputRange: [0, 1],
            outputRange: ["#000000", "rgba(0,0,0,0)"],
          }),
        },
      ]}
    >
      <FlatList
        data={items}
        renderItem={renderPage}
        keyExtractor={(m) => m.path}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={{ width, height }}
      />

      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: dragProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          },
        ]}
        pointerEvents="box-none"
      >
        <SafeAreaView style={styles.overlayContent}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.counter}>
            {index + 1} of {items.length}
          </Text>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={handleDownloadAndShare} style={styles.topBtn} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="share-outline" size={22} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDelete} style={styles.topBtn}>
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.bottomBar}>
          <Text style={styles.dateText}>
            {new Date(item.modTime).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>
        </SafeAreaView>
      </Animated.View>

      {prefetchSource && (
        <Image
          source={prefetchSource}
          style={{ width: 0, height: 0 }}
          cachePolicy="disk"
        />
      )}
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyText: { color: colors.text, fontSize: 15 },
    page: { flex: 1, alignItems: "center", justifyContent: "center" },
    video: { width: "100%", height: "100%" },

    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    overlayContent: { flex: 1, justifyContent: "space-between" },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingTop: 4,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    topActions: { flexDirection: "row", alignItems: "center", gap: 4 },
    topBtn: { padding: 10 },
    counter: { color: "#fff", fontSize: 14, fontWeight: "600" },
    bottomBar: {
      alignItems: "center",
      paddingBottom: 12,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    dateText: { color: "#fff", fontSize: 12 },
  });
}
