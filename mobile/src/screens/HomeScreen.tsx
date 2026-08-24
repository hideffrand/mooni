import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Animated,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useDevices } from "../context/DevicesContext";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";
import { createClient } from "../api/client";
import { getConfirmToken, getSystemStats, powerAction, PowerAction } from "../api/system";
import { SystemStats } from "../types";
import { authenticateWithDeviceLock, biometricAuthAvailable } from "../utils/biometricAuth";
import TypeToConfirmModal from "./components/TypeToConfirmModal";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const REFRESH_MS = 5000;

const WORDS = [
  "ORBIT",
  "FALCON",
  "NOBLE",
  "EMERALD",
  "THUNDER",
  "COBALT",
  "RAVEN",
  "PHOENIX",
  "SAILOR",
  "HARBOR",
  "MONARCH",
  "VELVET",
];

function makeConfirmToken(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 90) + 10}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(" ") || "<1m";
}

// Color ramps: severity -> color.

type ColorStop = { p: number; c: string };

const LOAD_STOPS: ColorStop[] = [
  { p: 0, c: "#22C55E" }, // calm green
  { p: 60, c: "#EAB308" }, // amber
  { p: 85, c: "#F97316" }, // orange
  { p: 100, c: "#EF4444" }, // red
];

// Temps gauged against a 0–95°C scale (sane consumer-hardware ceiling).
const TEMP_MAX_C = 95;
const TEMP_STOPS: ColorStop[] = [
  { p: 0, c: "#38BDF8" }, // cool blue
  { p: 45, c: "#22C55E" }, // green
  { p: 70, c: "#EAB308" }, // amber
  { p: 90, c: "#EF4444" }, // red
];

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function interpolateColor(percent: number, stops: ColorStop[]): string {
  const p = Math.max(0, Math.min(100, percent));
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].p && p <= stops[i + 1].p) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const span = upper.p - lower.p || 1;
  const t = (p - lower.p) / span;
  const a = hexToRgb(lower.c);
  const b = hexToRgb(upper.c);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// A gentle looping pulse, used to make "this is running hot" felt, not just read.
function usePulse(active: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, value]);
  const scale = value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  return { scale, opacity };
}

// Meter: solid fill bar banded into 5 ranges (not a gradient).

const METER_RANGES: { max: number; color: string }[] = [
  { max: 20, color: "#22C55E" }, // green
  { max: 40, color: "#84CC16" }, // lime
  { max: 60, color: "#EAB308" }, // yellow
  { max: 80, color: "#F97316" }, // orange
  { max: 100, color: "#EF4444" }, // red
];

function getRangeColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  for (const band of METER_RANGES) {
    if (p <= band.max) return band.color;
  }
  return METER_RANGES[METER_RANGES.length - 1].color;
}

function GradientMeter({
  percent,
  colors,
  height = 12,
}: {
  percent: number;
  colors: ThemeColors;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color = getRangeColor(clamped);
  return (
    <View style={[meterStyles.track, { height, borderRadius: height / 2, backgroundColor: colors.surface }]}>
      <View
        style={[
          meterStyles.fill,
          { width: `${clamped}%`, height: "100%", borderRadius: height / 2, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const meterStyles = StyleSheet.create({
  track: { overflow: "hidden", width: "100%" },
  fill: {},
});

// CPU: little chip with pin rows, glowing by load.

function ChipGauge({ percent, colors }: { percent: number; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  const color = interpolateColor(percent, LOAD_STOPS);
  const danger = percent > 90;
  const { scale, opacity } = usePulse(danger);
  const pins = Array.from({ length: 5 });

  return (
    <View style={styles.chipCol}>
      <View style={styles.chipPinRow}>
        {pins.map((_, i) => (
          <View key={`t${i}`} style={[styles.chipPin, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={styles.chipBodyWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.chipHalo,
            { backgroundColor: color, opacity, transform: [{ scale }] },
          ]}
        />
        <View style={[styles.chipBody, { borderColor: color }]}>
          <Ionicons name="hardware-chip-outline" size={26} color={color} />
        </View>
      </View>
      <View style={styles.chipPinRow}>
        {pins.map((_, i) => (
          <View key={`b${i}`} style={[styles.chipPin, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

// Temperature: thermometer with rising mercury and glowing bulb.

const THERMO_TUBE_HEIGHT = 58;

function Thermometer({ celsius, colors }: { celsius: number; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  const percent = (celsius / TEMP_MAX_C) * 100;
  const color = interpolateColor(percent, TEMP_STOPS);
  const fillHeight = Math.max(6, (Math.max(0, Math.min(100, percent)) / 100) * THERMO_TUBE_HEIGHT);
  const danger = celsius >= 85;
  const { scale, opacity } = usePulse(danger);

  return (
    <View style={styles.thermoCol}>
      <View style={styles.thermoTube}>
        <View style={[styles.thermoFill, { height: fillHeight, backgroundColor: color }]} />
      </View>
      <View style={styles.thermoBulbWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.chipHalo,
            { backgroundColor: color, opacity, transform: [{ scale }] },
          ]}
        />
        <View style={[styles.thermoBulb, { backgroundColor: color }]}>
          <Ionicons name="thermometer-outline" size={14} color={colors.onPrimary} />
        </View>
      </View>
      <Text style={[styles.thermoValue, { color }]}>{Math.round(celsius)}°C</Text>
    </View>
  );
}

// ---

function StatsBody({ stats, colors }: { stats: SystemStats; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  const maxTemp = stats.tempsCelsius.length > 0 ? Math.max(...stats.tempsCelsius) : null;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.hostname}>{stats.hostname}</Text>
        <Text style={styles.sub}>{stats.os}</Text>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Ionicons name="time-outline" size={12} color={colors.textDim} />
            <Text style={styles.chipText}>{formatUptime(stats.uptimeSeconds)}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="layers-outline" size={12} color={colors.textDim} />
            <Text style={styles.chipText}>{stats.processes} processes</Text>
          </View>
        </View>
      </View>

      <View style={styles.gaugeRow}>
        <View style={[styles.card, styles.gaugeCard]}>
          <Text style={styles.rowLabel}>CPU</Text>
          <ChipGauge percent={stats.cpuPercent} colors={colors} />
          <Text style={[styles.gaugeValue, { color: interpolateColor(stats.cpuPercent, LOAD_STOPS) }]}>
            {stats.cpuPercent.toFixed(1)}%
          </Text>
          <Text style={styles.load} numberOfLines={1}>
            {stats.loadAvg.map((v) => v.toFixed(2)).join(" · ")}
          </Text>
        </View>

        {maxTemp !== null && (
          <View style={[styles.card, styles.gaugeCard]}>
            <Text style={styles.rowLabel}>Temp</Text>
            <Thermometer celsius={maxTemp} colors={colors} />
            <Text style={styles.load}>Peak sensor</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLabelWithIcon}>
            <Ionicons name="layers-outline" size={15} color={colors.textDim} />
            <Text style={styles.rowLabel}>Memory</Text>
          </View>
          <Text style={[styles.rowValue, { color: interpolateColor(stats.memory.usedPercent, LOAD_STOPS) }]}>
            {stats.memory.usedPercent.toFixed(1)}%
          </Text>
        </View>
        <GradientMeter percent={stats.memory.usedPercent} colors={colors} />
        <Text style={styles.load}>
          {formatBytes(stats.memory.totalBytes - stats.memory.availableBytes)} of{" "}
          {formatBytes(stats.memory.totalBytes)}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLabelWithIcon}>
            <Ionicons name="server-outline" size={15} color={colors.textDim} />
            <Text style={styles.rowLabel}>Disk</Text>
          </View>
          <Text style={[styles.rowValue, { color: interpolateColor(stats.disk.usedPercent, LOAD_STOPS) }]}>
            {stats.disk.usedPercent.toFixed(1)}%
          </Text>
        </View>
        <GradientMeter percent={stats.disk.usedPercent} colors={colors} />
        <Text style={styles.load}>
          {formatBytes(stats.disk.availableBytes)} free of {formatBytes(stats.disk.totalBytes)}
        </Text>
      </View>
    </>
  );
}

const FILE_TYPE_COLORS = {
  image: "#38BDF8",
  doc: "#EAB308",
  archive: "#A855F7",
};

function FileManagerCard({
  stats,
  colors,
  onPress,
}: {
  stats: SystemStats | null;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const styles = makeStyles(colors);
  const diskPercent = stats?.disk.usedPercent ?? null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.fmTopRow}>
        <View style={styles.fmBadge}>
          <Ionicons name="folder-open" size={24} color={colors.primary} />
          <View style={styles.fmTypeCluster}>
            <View style={[styles.fmTypeDot, { backgroundColor: FILE_TYPE_COLORS.image, zIndex: 3 }]}>
              <Ionicons name="image-outline" size={9} color="#fff" />
            </View>
            <View
              style={[
                styles.fmTypeDot,
                styles.fmTypeDotOverlap,
                { backgroundColor: FILE_TYPE_COLORS.doc, zIndex: 2 },
              ]}
            >
              <Ionicons name="document-text-outline" size={9} color="#fff" />
            </View>
            <View
              style={[
                styles.fmTypeDot,
                styles.fmTypeDotOverlap,
                { backgroundColor: FILE_TYPE_COLORS.archive, zIndex: 1 },
              ]}
            >
              <Ionicons name="archive-outline" size={9} color="#fff" />
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.menuTitle}>File Manager</Text>
          <Text style={styles.menuSub}>Browse, upload, download and manage files</Text>
        </View>

        <View style={styles.fmOpenBtn}>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </View>
      </View>

      {diskPercent !== null && stats && (
        <View style={styles.fmDiskRow}>
          <GradientMeter percent={diskPercent} colors={colors} height={6} />
          <Text style={styles.fmDiskCaption}>
            {formatBytes(stats.disk.availableBytes)} free of {formatBytes(stats.disk.totalBytes)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MediaLibraryCard({
  colors,
  onPress,
}: {
  colors: ThemeColors;
  onPress: () => void;
}) {
  const styles = makeStyles(colors);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.fmTopRow}>
        <View style={styles.fmBadge}>
          <Ionicons name="images" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuTitle}>Media</Text>
          <Text style={styles.menuSub}>Photos and videos library, like Google Photos</Text>
        </View>
        <View style={styles.fmOpenBtn}>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { devices, activeDevice, setActiveDeviceId } = useDevices();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const client = activeDevice ? createClient(activeDevice) : null;

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [powerAction_, setPowerAction_] = useState<PowerAction | null>(null);
  const [powerToken, setPowerToken] = useState("");
  const [powerBusy, setPowerBusy] = useState(false);
  const [powerExpanded, setPowerExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setError(null);
    try {
      setStats(await getSystemStats(client));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e.message ?? "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [client]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const executePower = async (action: PowerAction) => {
    if (!client) return;
    setPowerBusy(true);
    try {
      const token = await getConfirmToken(client);
      await powerAction(client, action, token);
      setPowerAction_(null);
      Alert.alert(
        action === "reboot" ? "Rebooting" : "Shutting down",
        action === "reboot"
          ? "The device is restarting. It will reappear when it's back online."
          : "The device is powering off."
      );
    } catch (e: any) {
      Alert.alert(
        "Failed",
        e?.response?.data?.error ?? e.message ?? `Could not ${action} the device.`
      );
    } finally {
      setPowerBusy(false);
    }
  };

  const openPower = async (action: PowerAction) => {
    if (!client) return;
    if (await biometricAuthAvailable()) {
      const ok = await authenticateWithDeviceLock(
        action === "reboot" ? "Reboot the device?" : "Shut down the device?"
      );
      if (ok) await executePower(action);
    } else {
      setPowerToken(makeConfirmToken());
      setPowerAction_(action);
    }
  };

  const confirmPower = async () => {
    if (!powerAction_) return;
    await executePower(powerAction_);
  };

  if (!activeDevice || !client) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>No device selected.</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => navigation.navigate("DeviceList")}
        >
          <Text style={styles.retryText}>Choose a device</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
      }
    >
      <View style={styles.deviceRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deviceChips}
        >
          {devices.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.deviceChip, activeDevice.id === d.id && styles.deviceChipActive]}
              onPress={() => setActiveDeviceId(d.id)}
            >
              <Ionicons
                name="desktop-outline"
                size={14}
                color={activeDevice.id === d.id ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.deviceChipText,
                  activeDevice.id === d.id && styles.deviceChipTextActive,
                ]}
                numberOfLines={1}
              >
                {d.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.deviceChip, styles.deviceChipAdd]}
            onPress={() => navigation.navigate("AddDevice", {})}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.deviceChipTextAdd}>Add</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Status</Text>
        {loading && !stats ? (
          <ActivityIndicator style={{ marginVertical: 32 }} color={colors.primary} />
        ) : error && !stats ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setLoading(true);
                load();
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : stats ? (
          <StatsBody stats={stats} colors={colors} />
        ) : null}
        {error && stats && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.section}>
        <FileManagerCard
          stats={stats}
          colors={colors}
          onPress={() => navigation.navigate("FileBrowser", { path: "" })}
        />
        <MediaLibraryCard
          colors={colors}
          onPress={() => navigation.navigate("Media")}
        />
      </View>

      <View style={styles.powerSection}>
        <TouchableOpacity
          style={styles.powerHeader}
          onPress={() => setPowerExpanded((v) => !v)}
        >
          <Text style={styles.sectionTitle}>Power</Text>
          <Ionicons
            name={powerExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {powerExpanded && (
          <View style={styles.card}>
            <Text style={styles.menuSub}>
              These commands will affect the whole machine, not just this app.
            </Text>
            <View style={styles.powerRow}>
              <TouchableOpacity style={[styles.powerBtn, styles.powerBtnReboot]} onPress={() => openPower("reboot")}>
                <Ionicons name="refresh" size={18} color={colors.onPrimary} />
                <Text style={styles.powerBtnText}>Reboot</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.powerBtn, styles.powerBtnShutdown]} onPress={() => openPower("shutdown")}>
                <Ionicons name="power" size={18} color={colors.onPrimary} />
                <Text style={styles.powerBtnText}>Shutdown</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <TypeToConfirmModal
        visible={!!powerAction_}
        title={powerAction_ === "reboot" ? "Reboot device?" : "Shut down device?"}
        message={
          powerAction_ === "reboot"
            ? "This will restart the machine. Any unsaved work on it will be lost."
            : "This will power the machine off. It stays off until someone starts it again."
        }
        token={powerToken}
        busy={powerBusy}
        confirmLabel={powerAction_ === "reboot" ? "Reboot" : "Shutdown"}
        onCancel={() => setPowerAction_(null)}
        onConfirm={confirmPower}
      />
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: "center" },

    deviceRow: {
      backgroundColor: colors.cardAlt,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    deviceChips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
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
      maxWidth: 180,
    },
    deviceChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    deviceChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", flexShrink: 1 },
    deviceChipTextActive: { color: colors.text },
    deviceChipAdd: { borderColor: colors.primary },
    deviceChipTextAdd: { color: colors.primary, fontSize: 13, fontWeight: "600" },

    section: { padding: 16, paddingBottom: 4 },
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
      padding: 16,
      marginBottom: 12,
    },
    hostname: { color: colors.text, fontSize: 17, fontWeight: "700" },
    sub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    chipText: { color: colors.textDim, fontSize: 12 },

    rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    rowLabelWithIcon: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowLabel: { color: colors.textDim, fontSize: 14, fontWeight: "600", textAlign: "center" },
    rowValue: { fontSize: 14, fontWeight: "700" },
    load: { color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: "center" },

    // -- gauge row (CPU + Temp) --
    gaugeRow: { flexDirection: "row", gap: 12 },
    gaugeCard: { flex: 1, alignItems: "center" },
    gaugeValue: { fontSize: 20, fontWeight: "800", marginTop: 10 },

    // -- CPU chip --
    chipCol: { alignItems: "center", marginTop: 6 },
    chipPinRow: { flexDirection: "row", gap: 4 },
    chipPin: { width: 6, height: 4, borderRadius: 1, opacity: 0.6 },
    chipBodyWrap: { alignItems: "center", justifyContent: "center", marginVertical: 3 },
    chipBody: {
      width: 52,
      height: 52,
      borderRadius: 12,
      borderWidth: 2.5,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    chipHalo: {
      position: "absolute",
      width: 52,
      height: 52,
      borderRadius: 26,
    },

    // -- thermometer --
    thermoCol: { alignItems: "center", marginTop: 6 },
    thermoTube: {
      width: 14,
      height: THERMO_TUBE_HEIGHT,
      borderRadius: 7,
      backgroundColor: colors.surface,
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    thermoFill: { width: "100%", borderRadius: 7 },
    thermoBulbWrap: { alignItems: "center", justifyContent: "center", marginTop: -8 },
    thermoBulb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: colors.card,
    },
    thermoValue: { fontSize: 15, fontWeight: "800", marginTop: 8 },

    errorText: { color: colors.dangerText, fontSize: 14, textAlign: "center", marginTop: 8 },
    retryBtn: {
      marginTop: 14,
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
    },
    retryText: { color: colors.onPrimary, fontWeight: "700", fontSize: 14 },

    menuTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
    menuSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 },

    // -- file manager card --
    fmTopRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    fmBadge: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    fmTypeCluster: {
      position: "absolute",
      bottom: -6,
      left: -4,
      flexDirection: "row",
    },
    fmTypeDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.card,
    },
    fmTypeDotOverlap: { marginLeft: -8 },
    fmOpenBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    fmDiskRow: { marginTop: 14 },
    fmDiskCaption: { color: colors.textSecondary, fontSize: 11, marginTop: 6 },

    powerSection: { padding: 16, paddingTop: 4 },
    powerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    powerRow: { flexDirection: "row", gap: 12, marginTop: 14 },
    powerBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 12,
    },
    powerBtnReboot: { backgroundColor: colors.primary },
    powerBtnShutdown: { backgroundColor: colors.danger },
    powerBtnText: { color: colors.onPrimary, fontWeight: "700", fontSize: 15 },
  });
}