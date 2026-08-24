import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AlertConfig } from "../types";
import { getAlertConfig, updateAlertConfig } from "../api/system";
import { createClient } from "../api/client";
import { useDevices } from "../context/DevicesContext";
import { useTheme } from "../context/ThemeContext";
import PromptModal from "./components/PromptModal";

type MetricRow = {
  key: "cpuPercent" | "memPercent" | "diskPercent" | "tempCelsius";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  unit: string;
  step: number;
  min: number;
  max: number;
};

const METRICS: MetricRow[] = [
  { key: "cpuPercent", label: "CPU usage above", icon: "speedometer-outline", unit: "%", step: 5, min: 5, max: 100 },
  { key: "memPercent", label: "RAM usage above", icon: "server-outline", unit: "%", step: 5, min: 5, max: 100 },
  { key: "diskPercent", label: "Disk usage above", icon: "disc-outline", unit: "%", step: 5, min: 5, max: 100 },
  { key: "tempCelsius", label: "Temperature above", icon: "thermometer-outline", unit: "°C", step: 5, min: 30, max: 120 },
];

const COOLDOWN_MIN = 1;
const COOLDOWN_MAX = 240;

export default function AlertSettingsScreen() {
  const { activeDevice } = useDevices();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [cfg, setCfg] = useState<AlertConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDevice) return;
    let alive = true;
    getAlertConfig(createClient(activeDevice))
      .then((c) => {
        if (alive) setCfg(c);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [activeDevice]);

  // Optimistic save: every change is pushed to the backend immediately.
  // The UI never blocks on the network; a failed save just means the
  // backend keeps its old values until the next change.
  const apply = useCallback(
    (patch: Partial<AlertConfig>) => {
      setCfg((prev) => {
        if (!prev || !activeDevice) return prev;
        const next = { ...prev, ...patch };
        updateAlertConfig(createClient(activeDevice), next).catch(() => {});
        return next;
      });
    },
    [activeDevice]
  );

  const bump = (row: MetricRow, delta: number) => {
    if (!cfg) return;
    const cur = cfg[row.key];
    const next =
      cur === 0 && delta > 0 ? row.min : Math.max(0, Math.min(row.max, cur + delta * row.step));
    // Stepping down at/below the minimum switches the metric off.
    apply({ [row.key]: next < row.min ? 0 : next } as Partial<AlertConfig>);
  };

  const bumpCooldown = (delta: number) => {
    if (!cfg) return;
    const next = Math.max(COOLDOWN_MIN, Math.min(COOLDOWN_MAX, cfg.cooldownMinutes + delta));
    apply({ cooldownMinutes: next });
  };

  const commitEdit = (raw: string) => {
    setEditingKey(null);
    const n = parseInt(raw, 10);
    if (isNaN(n)) return;
    if (editingKey === "cooldown") {
      apply({ cooldownMinutes: Math.max(COOLDOWN_MIN, Math.min(COOLDOWN_MAX, n)) });
      return;
    }
    const row = METRICS.find((m) => m.key === editingKey);
    if (!row) return;
    // 0 (or below the minimum) switches the metric off.
    const next = n < row.min ? 0 : Math.min(row.max, n);
    apply({ [row.key]: next } as Partial<AlertConfig>);
  };

  if (!cfg) {
    return (
      <View style={[styles.container, styles.center]}>
        {loadError ? (
          <Text style={styles.error}>Could not load alert settings.</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.section}>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.rowTitle}>Threshold alerts</Text>
            </View>
            <Switch value={cfg.enabled} onValueChange={(v) => apply({ enabled: v })} />
          </View>
          <View style={styles.noteRow}>
            <Text style={styles.noteText}>
              Pushes a notification to this phone when a threshold is crossed.
              Notifications repeat after they drop back and cross again.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert when</Text>
        <View style={styles.group}>
          {METRICS.map((row) => {
            const value = cfg[row.key];
            return (
              <View key={row.key} style={styles.row}>
                <View style={styles.rowLabel}>
                  <Ionicons name={row.icon} size={20} color={colors.textSecondary} />
                  <Text style={styles.rowTitle}>{row.label}</Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    disabled={!cfg.enabled || value === 0}
                    onPress={() => bump(row, -1)}
                  >
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepValueWrap}
                    disabled={!cfg.enabled}
                    onPress={() => setEditingKey(row.key)}
                  >
                    <Text style={styles.stepValue} numberOfLines={1}>
                      {value === 0 ? "Off" : `${Math.round(value)}${row.unit}`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    disabled={!cfg.enabled}
                    onPress={() => bump(row, +1)}
                  >
                    <Ionicons name="add" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Repeat protection</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.rowTitle}>Minimum time between alerts</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => bumpCooldown(-1)}>
                <Ionicons name="remove" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepValueWrap}
                onPress={() => setEditingKey("cooldown")}
              >
                <Text style={styles.stepValue}>{cfg.cooldownMinutes} min</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stepBtn} onPress={() => bumpCooldown(+1)}>
                <Ionicons name="add" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <PromptModal
        visible={editingKey !== null}
        title={
          editingKey === "cooldown"
            ? "Minimum time between alerts (minutes)"
            : `${METRICS.find((m) => m.key === editingKey)?.label ?? ""} (0 to turn off)`
        }
        initialValue={
          editingKey === "cooldown"
            ? String(cfg?.cooldownMinutes ?? "")
            : editingKey && METRICS.some((m) => m.key === editingKey)
              ? String(Math.round(cfg?.[editingKey as MetricRow["key"]] ?? 0))
              : ""
        }
        keyboardType="numeric"
        onCancel={() => setEditingKey(null)}
        onConfirm={commitEdit}
      />
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: "center", justifyContent: "center" },
    section: { padding: 16, paddingTop: 12 },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    group: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    rowLabel: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
    rowTitle: { color: colors.text, fontSize: 15, fontWeight: "500" },
    noteRow: { paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    noteText: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
    stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
    stepBtn: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    stepValueWrap: { minWidth: 62 },
    stepValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
    },
    error: { color: colors.textSecondary, fontSize: 14 },
  });
}
