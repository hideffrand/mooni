import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme, ThemeColors } from "../../context/ThemeContext";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  token?: string;
  busy?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

// Destructive-action confirm: with a token requires typing it exactly;
// without, a plain confirm dialog.
export default function TypeToConfirmModal({
  visible,
  title,
  message,
  token,
  busy = false,
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (visible) setValue("");
  }, [visible, token]);

  const matches = !token || value.trim().toUpperCase() === token.toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {token && (
            <>
              <Text style={styles.token}>{token}</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="Type the text above"
                placeholderTextColor={colors.textSecondary}
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!busy}
              />
            </>
          )}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={onCancel} disabled={busy}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger, !matches && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={!matches || busy}
            >
              <Text style={[styles.btnText, styles.btnDangerText]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      padding: 24,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 20,
    },
    title: { color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 8 },
    message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    token: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 1,
      textAlign: "center",
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingVertical: 12,
      marginBottom: 12,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    row: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16, gap: 12 },
    btn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
    btnDanger: { backgroundColor: colors.danger },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: colors.textDim, fontSize: 15 },
    btnDangerText: { color: colors.onPrimary, fontWeight: "600" },
  });
}
