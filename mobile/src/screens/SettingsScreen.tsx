import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useTheme, ThemeMode } from "../context/ThemeContext";

const MODES: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
];

export default function SettingsScreen() {
  const { mode, colors, setMode } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Ionicons name="color-palette-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.rowTitle}>Appearance</Text>
            </View>
            <View style={styles.segmented}>
              {MODES.map((m) => {
                const active = mode === m.value;
                return (
                  <TouchableOpacity
                    key={m.value}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => setMode(m.value)}
                  >
                    <Ionicons
                      name={m.icon}
                      size={16}
                      color={active ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("AlertSettings")}
          >
            <View style={styles.rowLabel}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.rowTitle}>Threshold Alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("Legal")}
          >
            <View style={styles.rowLabel}>
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.rowTitle}>Terms & Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    section: { padding: 16 },
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
      padding: 16,
    },
    rowLabel: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowTitle: { color: colors.text, fontSize: 15, fontWeight: "500" },
    segmented: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 3,
    },
    segment: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 8,
    },
    segmentActive: { backgroundColor: colors.primarySoft },
    segmentText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    segmentTextActive: { color: colors.primary, fontWeight: "700" },
  });
}
