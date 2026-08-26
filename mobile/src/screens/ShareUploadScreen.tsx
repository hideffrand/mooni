import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ShareIntentFile, useShareIntentContext } from "expo-share-intent";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useDevices } from "../context/DevicesContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";
import { uploadFile } from "../api/files";
import { ionIconFor } from "../utils/fileTypes";

type Props = NativeStackScreenProps<RootStackParamList, "ShareUpload">;

type FileStatus = "pending" | "uploading" | "done" | "error";

interface Row {
  file: ShareIntentFile;
  status: FileStatus;
  message?: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export default function ShareUploadScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { devices, activeDevice } = useDevices();
  const { shareIntent, resetShareIntent } = useShareIntentContext();

  const [rows, setRows] = useState<Row[]>(() =>
    (shareIntent.files ?? []).map((file) => ({ file, status: "pending" as FileStatus }))
  );
  const [deviceId, setDeviceId] = useState<string | null>(
    activeDevice?.id ?? devices[0]?.id ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [finished, setFinished] = useState(false);
  const uploadingRef = useRef(false);

  const selected = devices.find((d) => d.id === deviceId) ?? null;

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const uploadAll = async () => {
    const device = selected;
    if (!device || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status === "done") {
        ok += 1;
        continue;
      }
      updateRow(i, { status: "uploading", message: undefined });
      try {
        await uploadFile(device.baseUrl, device.apiKey, "", row.file.path);
        updateRow(i, { status: "done" });
        ok += 1;
      } catch (e: any) {
        updateRow(i, { status: "error", message: e?.message ?? "Upload failed" });
      }
    }
    uploadingRef.current = false;
    setUploading(false);
    if (ok === rows.length) setFinished(true);
  };

  const leave = () => {
    resetShareIntent();
    navigation.goBack();
  };

  if (rows.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>Nothing was shared to Mooni.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={leave}>
          <Text style={styles.btnPrimaryText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (devices.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>
          No devices paired. Add a device before uploading files.
        </Text>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate("AddDevice", {})}
        >
          <Text style={styles.btnPrimaryText}>Add a device</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Shared files</Text>
        <View style={styles.card}>
          {rows.map((row, i) => (
            <View key={`${row.file.path}-${i}`} style={[styles.fileRow, i > 0 && styles.fileRowDivider]}>
              <View style={styles.fileIcon}>
                <Ionicons name={ionIconFor(row.file.fileName ?? "")} size={20} color={colors.primary} />
              </View>
              <View style={styles.fileMeta}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {row.file.fileName ?? `file-${i + 1}`}
                </Text>
                <Text style={styles.fileSub} numberOfLines={1}>
                  {row.file.mimeType}
                  {row.file.size ? ` · ${formatBytes(row.file.size)}` : ""}
                </Text>
                {row.status === "error" && row.message ? (
                  <Text style={styles.fileError} numberOfLines={2}>
                    {row.message}
                  </Text>
                ) : null}
              </View>
              {row.status === "pending" && (
                <Ionicons name="time-outline" size={18} color={colors.textMuted} />
              )}
              {row.status === "uploading" && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              {row.status === "done" && (
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              )}
              {row.status === "error" && (
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
              )}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Upload to device</Text>
        <View style={styles.deviceChips}>
          {devices.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.deviceChip, deviceId === d.id && styles.deviceChipActive]}
              onPress={() => setDeviceId(d.id)}
            >
              <Ionicons
                name="desktop-outline"
                size={14}
                color={deviceId === d.id ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[styles.deviceChipText, deviceId === d.id && styles.deviceChipTextActive]}
                numberOfLines={1}
              >
                {d.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.destHint}>
          Files land in the root folder of {selected?.name ?? "the selected device"}.
        </Text>

        {finished && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text style={styles.successText}>
              Uploaded {rows.length} file{rows.length === 1 ? "" : "s"} to {selected?.name}.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnGhost} onPress={leave} disabled={uploading}>
          <Text style={styles.btnGhostText}>{uploading ? "Uploading…" : "Cancel"}</Text>
        </TouchableOpacity>
        {!finished ? (
          <TouchableOpacity
            style={[styles.btnPrimary, !selected && styles.btnDisabled, uploading && styles.btnDisabled]}
            onPress={uploadAll}
            disabled={!selected || uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.btnPrimaryText}>
                Upload{selected ? ` to ${selected.name}` : ""}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnPrimary} onPress={leave}>
            <Text style={styles.btnPrimaryText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: "center" },

    scroll: { padding: 16, paddingBottom: 8 },
    sectionTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
    },
    fileRowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    fileIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    fileMeta: { flex: 1 },
    fileName: { color: colors.text, fontSize: 15, fontWeight: "600" },
    fileSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    fileError: { color: colors.dangerText, fontSize: 12, marginTop: 2 },

    deviceChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    deviceChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: 220,
    },
    deviceChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    deviceChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", flexShrink: 1 },
    deviceChipTextActive: { color: colors.text },

    destHint: { color: colors.textSecondary, fontSize: 12, marginBottom: 12 },

    successBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    successText: { color: colors.text, fontSize: 14, flex: 1 },

    footer: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
      backgroundColor: colors.cardAlt,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    btnPrimary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 13,
      borderRadius: 12,
    },
    btnPrimaryText: { color: colors.onPrimary, fontWeight: "700", fontSize: 15 },
    btnGhost: {
      paddingVertical: 13,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnGhostText: { color: colors.textSecondary, fontWeight: "600", fontSize: 15 },
    btnDisabled: { opacity: 0.5 },
  });
}
