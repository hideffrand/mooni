import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "../../context/ThemeContext";

/** Grey wash over the current screen with a "device is offline" pill. */
export default function OfflineOverlay({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.wash} pointerEvents="box-only">
      <View style={styles.pill}>
        <Ionicons name="cloud-offline-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.text}>Device is offline</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(127,127,127,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      paddingVertical: 10,
      paddingLeft: 16,
      paddingRight: 8,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },
    text: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    retryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    retryText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
  });
