import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "mooni.theme.v1";

export type ThemeMode = "dark" | "light";

export interface ThemeColors {
  background: string;
  card: string;
  cardAlt: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  textSoft: string;
  textLighter: string;
  primary: string;
  primarySoft: string;
  danger: string;
  dangerText: string;
  onPrimary: string;
  overlay: string;
}

export const darkColors: ThemeColors = {
  background: "#0d1117",
  card: "#151b23",
  cardAlt: "#11161d",
  surface: "#232d38",
  border: "#222b36",
  text: "#e6edf3",
  textSecondary: "#9ba8b5",
  textMuted: "#708091",
  textDim: "#c2ccd5",
  textSoft: "#a5b1bd",
  textLighter: "#d5dde5",
  primary: "#3df2a6",
  primarySoft: "#14352b",
  danger: "#dc2626",
  dangerText: "#f87171",
  onPrimary: "#06251a",
  overlay: "rgba(0,0,0,0.5)",
};

export const lightColors: ThemeColors = {
  background: "#f7f9fa",
  card: "#ffffff",
  cardAlt: "#f0f4f7",
  surface: "#e4eaef",
  border: "#dce3ea",
  text: "#171b1f",
  textSecondary: "#4a5560",
  textMuted: "#6e7a86",
  textDim: "#2b323a",
  textSoft: "#545f6a",
  textLighter: "#39434d",
  primary: "#0b8f63",
  primarySoft: "#d9f3e7",
  danger: "#dc2626",
  dangerText: "#dc2626",
  onPrimary: "#fff",
  overlay: "rgba(0,0,0,0.4)",
};

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  loading: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
export { ThemeContext };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
          setModeState(stored);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors: mode === "dark" ? darkColors : lightColors,
        loading,
        setMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
