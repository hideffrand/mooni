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
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  keyboardType?: "default" | "numeric";
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export default function PromptModal({
  visible,
  title,
  placeholder,
  initialValue = "",
  confirmLabel = "OK",
  keyboardType = "default",
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            keyboardType={keyboardType}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={onCancel}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => onConfirm(value.trim())}
            >
              <Text style={[styles.btnText, styles.btnPrimaryText]}>
                {confirmLabel}
              </Text>
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
    title: { color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 12 },
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
    btnPrimary: { backgroundColor: colors.primary },
    btnText: { color: colors.textDim, fontSize: 15 },
    btnPrimaryText: { color: colors.onPrimary, fontWeight: "600" },
  });
}
