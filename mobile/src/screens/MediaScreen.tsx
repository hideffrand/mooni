import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useDevices } from "../context/DevicesContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";
import { createClient } from "../api/client";
import { listMedia, listMediaFolders, mediaUrl, uploadMedia, deleteMedia } from "../api/media";
import { downloadSelected } from "../api/files";
import { MediaFolder, MediaItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Media">;

const COLS = 3;
const THUMB_EXT = ["jpg", "jpeg", "png", "gif", "bmp"];

function extOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function sectionTitle(d: Date): string {
  const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Row = MediaItem[];

interface Section {
  title: string;
  data: Row[];
}

function chunkRows(items: MediaItem[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < items.length; i += COLS) {
    rows.push(items.slice(i, i + COLS));
  }
  return rows;
}

export default function MediaScreen({ route, navigation }: Props) {
  const currentPath = route.params?.path ?? "";
  const { activeDevice } = useDevices();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { width } = useWindowDimensions();
  const cellSize = (width - 2) / COLS;

  const [items, setItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [dlStatus, setDlStatus] = useState<{ done: number; total: number } | null>(null);
  // Videos whose thumbnail failed (no ffmpeg); cells show the play icon.
  const [videoThumbFailed, setVideoThumbFailed] = useState<Set<string>>(new Set());

  const client = activeDevice ? createClient(activeDevice) : null;

  const load = useCallback(async () => {
    if (!client) return;
    setError(null);
    try {
      if (currentPath === "") {
        // Root: flat "All" grid plus a top-level album strip.
        const [all, browse] = await Promise.all([
          listMedia(client),
          listMediaFolders(client, ""),
        ]);
        setItems(all);
        setFolders(browse.folders);
      } else {
        // Drilled in: scoped to this folder only.
        const res = await listMediaFolders(client, currentPath);
        setItems(res.items);
        setFolders(res.folders);
      }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setError("This server doesn't have the Media library enabled.");
      } else {
        setError(e?.response?.data?.error ?? e.message ?? "Failed to load media");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, activeDevice?.baseUrl, activeDevice?.apiKey]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Show the folder name in the header while drilled in.
  useEffect(() => {
    const name = currentPath.split("/").filter(Boolean).pop();
    navigation.setOptions({ title: name ?? "Media" });
  }, [currentPath, navigation]);

  // Refresh when returning from the viewer (deletes may have happened there).
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (!loading) load();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, load]);

  const selecting = selected.size > 0;

  const toggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const openItem = (item: MediaItem, index: number) => {
    navigation.navigate("MediaViewer", { items, initialIndex: index });
  };

  const onCellPress = (item: MediaItem, index: number) => {
    if (selecting) {
      toggleSelect(item.path);
    } else {
      openItem(item, index);
    }
  };

  const onLongPress = (item: MediaItem) => {
    setSelected((prev) => new Set(prev).add(item.path));
  };

  const handleUpload = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const assets = picked.assets;
    setUpload({ done: 0, total: assets.length });
    let failed = 0;
    for (const asset of assets) {
      try {
        if (!activeDevice) return;
        await uploadMedia(activeDevice.baseUrl, activeDevice.apiKey, currentPath, asset.uri);
      } catch {
        failed++;
      }
      setUpload((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    setUpload(null);
    await load();
    if (failed > 0) {
      Alert.alert("Upload", `${failed} of ${assets.length} files failed to upload.`);
    }
  };

  const confirmDelete = () => {
    const paths = [...selected];
    Alert.alert(
      "Delete media?",
      `${paths.length} item${paths.length > 1 ? "s" : ""} will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!client) return;
            try {
              await deleteMedia(client, paths);
              setSelected(new Set());
              await load();
            } catch (e: any) {
              Alert.alert("Failed", e?.response?.data?.error ?? e.message);
            }
          },
        },
      ]
    );
  };

  const handleDownloadSelected = async () => {
    if (!activeDevice || selected.size === 0) return;
    const paths = [...selected];
    setSelected(new Set());
    setDlStatus({ done: 0, total: paths.length });
    try {
      const res = await downloadSelected(
        activeDevice.baseUrl,
        activeDevice.apiKey,
        paths,
        (done, total) => setDlStatus({ done, total })
      );
      let msg = `${res.saved} file${res.saved === 1 ? "" : "s"} saved to Downloads/mooni.`;
      if (res.fallbacks > 0) {
        msg += `\n${res.fallbacks} saved inside the app instead (public save failed).`;
      }
      if (res.failed > 0) {
        msg += `\n${res.failed} failed.`;
      }
      Alert.alert("Download", msg);
    } finally {
      setDlStatus(null);
    }
  };

  const sections = useMemo<Section[]>(() => {
    const byDay = new Map<string, MediaItem[]>();
    for (const item of items) {
      const key = dayStart(new Date(item.modTime));
      const arr = byDay.get(String(key)) ?? [];
      arr.push(item);
      byDay.set(String(key), arr);
    }
    const out: Section[] = [];
    for (const [key, dayItems] of byDay) {
      out.push({ title: sectionTitle(new Date(Number(key))), data: chunkRows(dayItems) });
    }
    return out;
  }, [items]);

  const renderCell = (item: MediaItem, index: number) => {
    const ext = extOf(item.name);
    const isWebp = ext === "webp";
    const useThumb =
      item.kind === "image" ? !isWebp : !videoThumbFailed.has(item.path);
    const source = useThumb ? "thumb" : "preview";
    const isSelected = selected.has(item.path);
    return (
      <TouchableOpacity
        key={item.path}
        style={[styles.cell, { width: cellSize, height: cellSize }]}
        activeOpacity={0.8}
        onPress={() => onCellPress(item, index)}
        onLongPress={() => onLongPress(item)}
      >
        {item.kind === "video" && videoThumbFailed.has(item.path) ? (
          <View style={styles.videoCell}>
            <Ionicons name="play-circle" size={34} color="rgba(255,255,255,0.9)" />
          </View>
        ) : (
          <Image
            source={{
              uri: activeDevice ? mediaUrl(activeDevice, source, item.path) : "",
              headers: { "X-API-Key": activeDevice?.apiKey ?? "" },
            }}
            style={styles.cellImage}
            contentFit="cover"
            cachePolicy="disk"
            recyclingKey={item.path}
            onError={() => {
              if (item.kind === "video") {
                setVideoThumbFailed((prev) => new Set(prev).add(item.path));
              }
            }}
          />
        )}
        {item.kind === "video" && (
          <View style={styles.videoBadge}>
            <Ionicons name="videocam" size={10} color="#fff" />
          </View>
        )}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={26} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderRow = ({ item, index }: { item: Row; index: number }) => (
    <View style={styles.row}>
      {item.map((m, i) => renderCell(m, index * COLS + i))}
    </View>
  );

  const openFolder = (folder: MediaFolder) => {
    setSelected(new Set());
    navigation.push("Media", { path: folder.path });
  };

  const renderAlbum = ({ item }: { item: MediaFolder }) => (
    <TouchableOpacity
      style={[styles.albumCell, { width: cellSize }]}
      activeOpacity={0.8}
      onPress={() => openFolder(item)}
    >
      {item.cover && activeDevice ? (
        <Image
          source={{
            uri: mediaUrl(activeDevice, "thumb", item.cover.path),
            headers: { "X-API-Key": activeDevice.apiKey },
          }}
          style={styles.albumImage}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={item.path}
        />
      ) : (
        <View style={styles.albumPlaceholder}>
          <Ionicons name="folder" size={30} color={colors.textSecondary} />
        </View>
      )}
      <Text style={styles.albumName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.albumCount}>
        {item.count} item{item.count === 1 ? "" : "s"}
      </Text>
    </TouchableOpacity>
  );

  const albumStrip = () =>
    folders.length === 0 ? null : (
      <View>
        <Text style={styles.albumsTitle}>Folders</Text>
        {Array.from({ length: Math.ceil(folders.length / COLS) }, (_, r) => {
          const rowFolders = folders.slice(r * COLS, r * COLS + COLS);
          return (
            <View key={rowFolders[0].path} style={styles.albumsRow}>
              {rowFolders.map((f) => renderAlbum({ item: f }))}
            </View>
          );
        })}
      </View>
    );

  if (!activeDevice || !client) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>No device selected.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {selecting && (
        <View style={styles.topBar}>
          <Text style={styles.selectionCount}>{selected.size} selected</Text>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              onPress={() => setSelected(new Set(items.map((i) => i.path)))}
              style={styles.topBarBtn}
            >
              <Text style={styles.topBarBtnText}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.topBarBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {upload && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator color={colors.onPrimary} size="small" />
          <Text style={styles.uploadingText}>
            Uploading {upload.done}/{upload.total}…
          </Text>
        </View>
      )}

      {dlStatus && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator color={colors.onPrimary} size="small" />
          <Text style={styles.uploadingText}>
            Downloading {dlStatus.done}/{dlStatus.total}…
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 && folders.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.text} />
          }
        >
          <View style={styles.center}>
            <Ionicons name="images-outline" size={52} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {currentPath ? "This folder has no media." : "No media yet."}
            </Text>
            {!currentPath && (
              <Text style={styles.emptyHint}>
                Tap + to add photos and videos from your gallery.
              </Text>
            )}
          </View>
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row, i) => `${row[0]?.path}-${i}`}
          renderItem={renderRow}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          ListHeaderComponent={albumStrip()}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.text} />
          }
        />
      )}

      {selecting ? (
        <View style={styles.selectionBar}>
          <TouchableOpacity style={styles.selectionBtn} onPress={handleDownloadSelected}>
            <Ionicons name="download-outline" size={20} color={colors.text} />
            <Text style={styles.selectionBtnText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.selectionBtn, { borderLeftWidth: 1, borderLeftColor: colors.border }]} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={[styles.selectionBtnText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={handleUpload} activeOpacity={0.85}>
          <Ionicons name="add" size={30} color={colors.onPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    emptyScroll: { flexGrow: 1 },
    emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: "center", marginTop: 12 },
    emptyHint: { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 6 },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.cardAlt,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    selectionCount: { color: colors.text, fontSize: 16, fontWeight: "700" },
    topBarActions: { flexDirection: "row", alignItems: "center", gap: 16 },
    topBarBtn: { padding: 2 },
    topBarBtnText: { color: colors.primary, fontSize: 15, fontWeight: "600" },

    uploadingBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      paddingVertical: 8,
    },
    uploadingText: { color: colors.onPrimary, fontSize: 13, fontWeight: "600" },

    sectionHeader: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 8,
      backgroundColor: colors.background,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },

    albumsTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    albumsRow: { flexDirection: "row", marginBottom: 12 },
    albumCell: { alignItems: "center", marginHorizontal: 1 },
    albumImage: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    albumPlaceholder: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    albumName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
      marginTop: 5,
    },
    albumCount: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
    listContent: { paddingBottom: 96 },
    row: { flexDirection: "row", marginBottom: 2 },
    cell: {
      marginHorizontal: 1,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    cellImage: { width: "100%", height: "100%" },
    videoCell: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    videoBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 4,
      padding: 2,
    },
    selectedOverlay: {
      position: "absolute",
      top: 6,
      left: 6,
      right: 6,
      bottom: 6,
      backgroundColor: "rgba(0,120,255,0.35)",
      borderWidth: 2,
      borderColor: "#fff",
      borderRadius: 4,
      alignItems: "flex-end",
      justifyContent: "flex-start",
      padding: 4,
    },

    errorText: { color: colors.dangerText, fontSize: 14, textAlign: "center" },
    retryBtn: {
      marginTop: 14,
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
    },
    retryText: { color: colors.onPrimary, fontWeight: "700", fontSize: 14 },

    fab: {
      position: "absolute",
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    selectionBar: {
      flexDirection: "row",
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 10,
    },
    selectionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 8,
    },
    selectionBtnText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  });
}
