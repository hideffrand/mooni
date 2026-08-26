import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { VideoView, useVideoPlayer, VideoSource } from "expo-video";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useDevices } from "../context/DevicesContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";
import { fileUrl } from "../api/client";
import { downloadFile } from "../api/files";

type Props = NativeStackScreenProps<RootStackParamList, "FilePreview">;

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
const VIDEO_EXT = ["mp4", "mov", "m4v", "webm", "mkv"];
const AUDIO_EXT = ["mp3", "wav", "aac", "flac", "ogg"];

function extOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function MediaPlayer({
  source,
  style,
}: {
  source: VideoSource;
  style: object;
}) {
  const player = useVideoPlayer(source, (player) => {
    player.loop = false;
  });
  return <VideoView player={player} style={style} nativeControls contentFit="contain" />;
}

export default function FilePreviewScreen({ route }: Props) {
  const { path, name } = route.params;
  const { activeDevice } = useDevices();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const ext = extOf(name);
  const previewUri = activeDevice ? fileUrl(activeDevice, "preview", path) : "";

  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ written: number; total: number } | null>(null);

  const handleDownloadAndShare = async () => {
    setDownloading(true);
    setProgress(null);
    try {
      if (!activeDevice) return;
      const localUri = await downloadFile(
        activeDevice.baseUrl,
        activeDevice.apiKey,
        path,
        name,
        (written, total) => setProgress({ written, total })
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
      setDownloading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.previewArea}>
        {IMAGE_EXT.includes(ext) ? (
          <Image
            source={{
              uri: previewUri,
              headers: { "X-API-Key": activeDevice?.apiKey ?? "" },
            }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : VIDEO_EXT.includes(ext) ? (
          <MediaPlayer
            source={{
              uri: previewUri,
              headers: { "X-API-Key": activeDevice?.apiKey ?? "" },
            }}
            style={styles.video}
          />
        ) : AUDIO_EXT.includes(ext) ? (
          <View style={styles.center}>
            <Ionicons name="musical-notes-outline" size={56} color={colors.text} style={styles.bigIcon} />
            <MediaPlayer
              source={{
                uri: previewUri,
                headers: { "X-API-Key": activeDevice?.apiKey ?? "" },
              }}
              style={styles.audioPlayer}
            />
            <Text style={styles.fileName}>{name}</Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Ionicons name="document-outline" size={56} color={colors.text} style={styles.bigIcon} />
            <Text style={styles.fileName}>{name}</Text>
            <Text style={styles.hint}>
              Preview isn't available for this file type. Download to open it.
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.downloadBtn}
        onPress={handleDownloadAndShare}
        disabled={downloading}
        activeOpacity={0.85}
      >
        {downloading ? (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: progress && progress.total > 0
                      ? `${Math.min(100, (progress.written / progress.total) * 100)}%`
                      : "0%",
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText} numberOfLines={1}>
              {progress
                ? progress.total > 0
                  ? `${formatSize(progress.written)} / ${formatSize(progress.total)}`
                  : formatSize(progress.written)
                : "Starting…"}
            </Text>
          </View>
        ) : (
          <View style={styles.btnRow}>
            <Ionicons name="arrow-down-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.downloadBtnText}>Download / Share</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    previewArea: { flex: 1, alignItems: "center", justifyContent: "center" },
    image: { width: "100%", height: "100%" },
    video: { width: "100%", height: 300 },
    audioPlayer: { width: 240, height: 48, marginBottom: 12 },
    center: { alignItems: "center", padding: 24 },
    bigIcon: { fontSize: 56, marginBottom: 12 },
    btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    fileName: { color: colors.text, fontSize: 15, textAlign: "center" },
    hint: { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 8 },
    downloadBtn: {
      backgroundColor: colors.primary,
      margin: 16,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    downloadBtnText: { color: colors.onPrimary, fontWeight: "700", fontSize: 15 },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      width: "100%",
      paddingHorizontal: 4,
    },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.35)",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
      backgroundColor: colors.onPrimary,
    },
    progressText: {
      color: colors.onPrimary,
      fontWeight: "600",
      fontSize: 12,
      minWidth: 90,
      textAlign: "right",
    },
  });
}
