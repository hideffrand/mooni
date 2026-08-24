import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AxiosInstance } from "axios";
import { registerPushToken } from "../api/system";

const sentKeyFor = (deviceId: string) => `mooni.pushtoken.sent.${deviceId}`;

export async function ensureNotificationChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync("alerts", {
    name: "Device alerts",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/**
 * Registers this phone's Expo push token with the given device's backend,
 * so the backend can push threshold alerts to it. Best-effort and idempotent:
 * the token is only re-sent when it changed, and any failure is swallowed
 * (alerts are optional; pairing/browsing must never break because of them).
 *
 * Note: remote pushes need a real build (dev/preview) - they do nothing in
 * Expo Go on modern Android.
 */
export async function registerPushForDevice(
  client: AxiosInstance,
  deviceId: string
): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const perm = await Notifications.getPermissionsAsync();
    const granted =
      perm.granted ||
      (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;

    await ensureNotificationChannel();

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    const sent = await AsyncStorage.getItem(sentKeyFor(deviceId));
    if (sent === token) return;

    await registerPushToken(client, token);
    await AsyncStorage.setItem(sentKeyFor(deviceId), token);
  } catch {
    // Ignore: offline, Expo Go, permission denied - alerts stay off silently.
  }
}
