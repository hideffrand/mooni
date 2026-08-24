import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useDevices } from "../context/DevicesContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";
import { createClient, fileUrl } from "../api/client";
import {
  listFiles,
  mkdir,
  rename,
  copyItem,
  moveItem,
  deleteItem,
  uploadFile,
} from "../api/files";
import { FileEntry } from "../types";
import PromptModal from "./components/PromptModal";
import ActionSheet from "./components/ActionSheet";

type Props = NativeStackScreenProps<RootStackParamList, "FileBrowser">;

type ViewMode = "list" | "grid";
type SortField = "name" | "size" | "date";
type SortDir = "asc" | "desc";
type UploadStatus = "uploading" | "done" | "error";
interface UploadItem {
  id: string;
  name: string;
  progress: number; // 0..1
  status: UploadStatus;
  error?: string;
}

const VIDEO_EXT = ["mp4", "mov", "m4v", "webm", "mkv"];
// webp: server thumbnailer can't decode it, so those still stream full preview.
const SERVER_THUMB_EXT = ["jpg", "jpeg", "png", "gif", "bmp"];

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

function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

function extOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

const SORT_OPTIONS: { label: string; field: SortField; dir: SortDir }[] = [
  { label: "Name (A → Z)", field: "name", dir: "asc" },
  { label: "Name (Z → A)", field: "name", dir: "desc" },
  { label: "Size (small → large)", field: "size", dir: "asc" },
  { label: "Size (large → small)", field: "size", dir: "desc" },
  { label: "Date (oldest first)", field: "date", dir: "asc" },
  { label: "Date (newest first)", field: "date", dir: "desc" },
];

export default function FileBrowserScreen({ route, navigation }: Props) {
  const currentPath = route.params?.path ?? "";
  const { activeDevice } = useDevices();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const client = activeDevice ? createClient(activeDevice) : null;

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [fabMenuVisible, setFabMenuVisible] = useState(false);

  const [mkdirVisible, setMkdirVisible] = useState(false);
  const [menuTarget, setMenuTarget] = useState<FileEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileEntry | null>(null);
  const [copyTarget, setCopyTarget] = useState<FileEntry | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  // Paths whose thumbnail request failed; those cells show a plain icon.
  const [thumbFailed, setThumbFailed] = useState<Set<string>>(new Set());

  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const dismissUpload = (id: string) =>
    setUploads((prev) => prev.filter((u) => u.id !== id));

  // Auto-clear finished uploads; failures stay until dismissed.
  useEffect(() => {
    const doneIds = uploads.filter((u) => u.status === "done").map((u) => u.id);
    if (doneIds.length === 0) return;
    const timer = setTimeout(() => {
      setUploads((prev) => prev.filter((u) => !doneIds.includes(u.id)));
    }, 1800);
    return () => clearTimeout(timer);
  }, [uploads]);

  const handleUpload = async () => {
    if (!activeDevice) return;
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const items: UploadItem[] = picked.assets.map((a) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: a.name,
      progress: 0,
      status: "uploading",
    }));
    setUploads((prev) => [...prev, ...items]);

    // Sequential: readable progress bars, no N-way parallel streams.
    for (let i = 0; i < picked.assets.length; i++) {
      const asset = picked.assets[i];
      const item = items[i];
      try {
        await uploadFile(
          activeDevice.baseUrl,
          activeDevice.apiKey,
          currentPath,
          asset.uri,
          (sent, total) => {
            patchUpload(item.id, { progress: total > 0 ? sent / total : 0 });
          }
        );
        patchUpload(item.id, { progress: 1, status: "done" });
      } catch (e: any) {
        patchUpload(item.id, {
          status: "error",
          error: e?.response?.data?.error ?? e.message ?? "Upload failed",
        });
      }
    }
    await load();
  };

  useEffect(() => {
    navigation.setOptions({ title: currentPath || "/ (root)" });
  }, [currentPath, navigation]);

  const load = useCallback(async () => {
    if (!client) return;
    setError(null);
    try {
      const res = await listFiles(client, currentPath);
      setEntries(res.entries);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e.message ?? "Failed to load folder");
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

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Folders always pinned above files; sort field/dir applies within each group.
  const sortedEntries = useMemo(() => {
    const cmp = (a: FileEntry, b: FileEntry) => {
      let result = 0;
      if (sortField === "name") {
        result = a.name.localeCompare(b.name);
      } else if (sortField === "size") {
        result = a.size - b.size;
      } else {
        result = new Date(a.modTime).getTime() - new Date(b.modTime).getTime();
      }
      return sortDir === "asc" ? result : -result;
    };
    const dirs = entries.filter((e) => e.isDir).sort(cmp);
    const files = entries.filter((e) => !e.isDir).sort(cmp);
    return [...dirs, ...files];
  }, [entries, sortField, sortDir]);

  const openEntry = (entry: FileEntry) => {
    if (entry.isDir) {
      navigation.push("FileBrowser", { path: entry.path });
    } else {
      navigation.push("FilePreview", { path: entry.path, name: entry.name });
    }
  };

  const confirmDelete = (entry: FileEntry) => {
    Alert.alert(
      "Delete item?",
      `"${entry.name}" will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!client) return;
            setBusy(true);
            try {
              await deleteItem(client, entry.path);
              await load();
            } catch (e: any) {
              Alert.alert("Failed", e?.response?.data?.error ?? e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const onLongPress = (entry: FileEntry) => setMenuTarget(entry);

  const pickAction = (kind: "rename" | "copy" | "move" | "delete") => {
    const target = menuTarget;
    setMenuTarget(null);
    if (!target) return;
    if (kind === "delete") {
      confirmDelete(target);
    } else if (kind === "rename") {
      setRenameTarget(target);
    } else if (kind === "copy") {
      setCopyTarget(target);
    } else {
      setMoveTarget(target);
    }
  };

  const renderListItem = ({ item }: { item: FileEntry }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => openEntry(item)}
      onLongPress={() => onLongPress(item)}
    >
      <Ionicons
        name={item.isDir ? "folder-outline" : "document-outline"}
        size={22}
        color={colors.textSecondary}
        style={styles.icon}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>
          {item.isDir ? "Folder" : formatSize(item.size)} ·{" "}
          {new Date(item.modTime).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderGridItem = ({ item }: { item: FileEntry }) => {
    const ext = extOf(item.name);
    const wantsThumb =
      !item.isDir && activeDevice && SERVER_THUMB_EXT.includes(ext);
    const isVideoThumb = !item.isDir && VIDEO_EXT.includes(ext) && !thumbFailed.has(item.path);
    const thumbUri =
      wantsThumb || isVideoThumb
        ? fileUrl(activeDevice!, "thumb", item.path)
        : !item.isDir && ext === "webp"
          ? fileUrl(activeDevice!, "preview", item.path)
          : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openEntry(item)}
        onLongPress={() => onLongPress(item)}
      >
        <View style={styles.cardThumb}>
          {thumbUri ? (
            <Image
              source={{ uri: thumbUri, headers: { "X-API-Key": activeDevice?.apiKey ?? "" } }}
              style={styles.cardImage}
              contentFit="cover"
              cachePolicy="disk"
              recyclingKey={item.path}
              onError={() =>
                setThumbFailed((prev) => new Set(prev).add(item.path))
              }
            />
          ) : (
            <Ionicons
              name={item.isDir ? "folder" : "document-outline"}
              size={38}
              color={colors.textSecondary}
            />
          )}
        </View>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.isDir ? "Folder" : formatSize(item.size)}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!activeDevice || !client) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>No device selected.</Text>
      </View>
    );
  }

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.field === sortField && o.dir === sortDir)?.label ?? "Sort";

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Home")}>
          <Ionicons name="home-outline" size={18} color={colors.textLighter} />
        </TouchableOpacity>

        <Text style={styles.pathText} numberOfLines={1}>
          {currentPath || "/"}
        </Text>

        <View style={styles.topBarActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setSortMenuVisible(true)}>
            <Ionicons name="filter-outline" size={18} color={colors.textLighter} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setViewMode((m) => (m === "list" ? "grid" : "list"))}
          >
            <Ionicons
              name={viewMode === "list" ? "grid-outline" : "list-outline"}
              size={18}
              color={colors.textLighter}
            />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.sortCaption}>Sorted by {currentSortLabel}</Text>

      {busy && (
        <View style={styles.busyBar}>
          <ActivityIndicator color={colors.onPrimary} size="small" />
          <Text style={styles.busyText}>Processing...</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.toolbarBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : sortedEntries.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
          }
        >
          <Text style={styles.emptyText}>This folder is empty</Text>
        </ScrollView>
      ) : (
        <FlatList
          key={viewMode}
          data={sortedEntries}
          keyExtractor={(item) => item.path || item.name}
          renderItem={viewMode === "list" ? renderListItem : renderGridItem}
          numColumns={viewMode === "grid" ? 3 : 1}
          columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
          contentContainerStyle={viewMode === "grid" ? styles.gridContent : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
          }
        />
      )}

      <PromptModal
        visible={mkdirVisible}
        title="Create new folder"
        placeholder="folder-name"
        confirmLabel="Create"
        onCancel={() => setMkdirVisible(false)}
        onConfirm={async (name) => {
          setMkdirVisible(false);
          if (!name) return;
          try {
            await mkdir(client, joinPath(currentPath, name));
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e?.response?.data?.error ?? e.message);
          }
        }}
      />

      <PromptModal
        visible={!!renameTarget}
        title={`Rename "${renameTarget?.name ?? ""}"`}
        initialValue={renameTarget?.name}
        confirmLabel="Rename"
        onCancel={() => setRenameTarget(null)}
        onConfirm={async (newName) => {
          const target = renameTarget;
          setRenameTarget(null);
          if (!target || !newName) return;
          try {
            await rename(client, target.path, joinPath(currentPath, newName));
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e?.response?.data?.error ?? e.message);
          }
        }}
      />

      <PromptModal
        visible={!!copyTarget}
        title={`Copy "${copyTarget?.name ?? ""}" to relative path`}
        placeholder="e.g. backup/new-name.txt"
        confirmLabel="Copy"
        onCancel={() => setCopyTarget(null)}
        onConfirm={async (dst) => {
          const target = copyTarget;
          setCopyTarget(null);
          if (!target || !dst) return;
          try {
            await copyItem(client, target.path, dst);
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e?.response?.data?.error ?? e.message);
          }
        }}
      />

      <PromptModal
        visible={!!moveTarget}
        title={`Move "${moveTarget?.name ?? ""}" to relative path`}
        placeholder="e.g. subfolder/name.txt"
        confirmLabel="Move"
        onCancel={() => setMoveTarget(null)}
        onConfirm={async (dst) => {
          const target = moveTarget;
          setMoveTarget(null);
          if (!target || !dst) return;
          try {
            await moveItem(client, target.path, dst);
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e?.response?.data?.error ?? e.message);
          }
        }}
      />

      <ActionSheet
        visible={!!menuTarget}
        title={menuTarget?.name}
        actions={[
          { label: "Rename", onPress: () => pickAction("rename") },
          { label: "Copy to...", onPress: () => pickAction("copy") },
          { label: "Move to...", onPress: () => pickAction("move") },
          { label: "Delete", destructive: true, onPress: () => pickAction("delete") },
        ]}
        onCancel={() => setMenuTarget(null)}
      />

      <ActionSheet
        visible={sortMenuVisible}
        title="Sort by"
        actions={SORT_OPTIONS.map((opt) => ({
          label: opt.field === sortField && opt.dir === sortDir ? `✓ ${opt.label}` : opt.label,
          onPress: () => {
            setSortField(opt.field);
            setSortDir(opt.dir);
            setSortMenuVisible(false);
          },
        }))}
        onCancel={() => setSortMenuVisible(false)}
      />

      <ActionSheet
        visible={fabMenuVisible}
        title="Add"
        actions={[
          {
            label: "New Folder",
            onPress: () => {
              setFabMenuVisible(false);
              setMkdirVisible(true);
            },
          },
          {
            label: "Upload Files",
            onPress: () => {
              setFabMenuVisible(false);
              handleUpload();
            },
          },
        ]}
        onCancel={() => setFabMenuVisible(false)}
      />

      {uploads.length > 0 && (
        <View style={styles.uploadPanel} pointerEvents="box-none">
          {uploads.map((u) => (
            <View key={u.id} style={styles.uploadRow}>
              <Ionicons
                name={
                  u.status === "done"
                    ? "checkmark-circle"
                    : u.status === "error"
                      ? "alert-circle"
                      : "cloud-upload-outline"
                }
                size={18}
                color={
                  u.status === "done"
                    ? colors.primary
                    : u.status === "error"
                      ? colors.dangerText
                      : colors.textSecondary
                }
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.uploadName} numberOfLines={1}>
                  {u.name}
                </Text>
                {u.status === "error" ? (
                  <Text style={styles.uploadError} numberOfLines={1}>
                    {u.error}
                  </Text>
                ) : (
                  <View style={styles.uploadTrack}>
                    <View
                      style={[
                        styles.uploadFill,
                        {
                          width: `${Math.round(u.progress * 100)}%`,
                          backgroundColor: u.status === "done" ? colors.primary : colors.primary,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>

              {u.status === "uploading" && (
                <Text style={styles.uploadPct}>{Math.round(u.progress * 100)}%</Text>
              )}
              {u.status === "done" && (
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              )}
              {u.status === "error" && (
                <TouchableOpacity onPress={() => dismissUpload(u.id)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setFabMenuVisible(true)}
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    uploadPanel: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 90, // sits just above the FAB
      gap: 8,
    },
    uploadRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
      elevation: 4,
    },
    uploadName: { color: colors.text, fontSize: 13, fontWeight: "600" },
    uploadError: { color: colors.dangerText, fontSize: 11, marginTop: 2 },
    uploadTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surface,
      marginTop: 6,
      overflow: "hidden",
    },
    uploadFill: { height: "100%", borderRadius: 2 },
    uploadPct: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      width: 32,
      textAlign: "right",
    },

    // -- top bar (home / current path / filter / view toggle) --
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
    },
    pathText: { flex: 1, color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
    topBarActions: { flexDirection: "row", gap: 8 },
    iconBtn: {
      backgroundColor: colors.card,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    sortCaption: {
      color: colors.textMuted,
      fontSize: 11,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },

    // -- floating add button --
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
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 5,
    },

    emptyScrollContent: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },

    toolbarBtnText: { color: colors.textLighter, fontSize: 13, fontWeight: "600" },
    busyBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    busyText: { color: colors.textSoft, fontSize: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    icon: { fontSize: 22, marginRight: 12 },
    name: { color: colors.text, fontSize: 15, fontWeight: "500" },
    meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    errorText: { color: colors.dangerText, textAlign: "center", marginBottom: 12 },
    emptyText: { color: colors.textMuted },
    retryBtn: { backgroundColor: colors.card, padding: 10, borderRadius: 8 },

    listContent: { paddingBottom: 90 },
    gridContent: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 90 },
    gridRow: { gap: 8, marginBottom: 8 },
    card: {
      flex: 1 / 3,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 8,
      marginHorizontal: 4,
    },
    cardThumb: {
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      marginBottom: 6,
    },
    cardImage: { width: "100%", height: "100%" },
    cardName: { color: colors.text, fontSize: 12, fontWeight: "500" },
    cardMeta: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
  });
}