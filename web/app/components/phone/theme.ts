import { createContext, useContext } from "react";

// Keep in sync with mobile/src/context/ThemeContext.tsx — this is the exact
// palette the real app uses.
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

// mobile/src/screens/HomeScreen.tsx FILE_TYPE_COLORS (FM card dot cluster).
export const FILE_TYPE_COLORS = {
  image: "#38BDF8",
  doc: "#EAB308",
  archive: "#A855F7",
};

// mobile/src/utils/fileTypes.ts badge colors.
export const BADGE_COLOR: Record<string, string> = {
  pdf: "#E53935",
  doc: "#1E88E5",
  sheet: "#43A047",
  slide: "#FB8C00",
  archive: "#F9A825",
  audio: "#8E24AA",
  code: "#546E7A",
};

// In-phone navigation routes (mirrors the RN stack).
export type Route =
  | { s: "home"; power?: boolean }
  | { s: "files"; path: string }
  | { s: "preview"; path: string; name: string }
  | { s: "media"; path: string }
  | { s: "viewer"; path: string }
  | { s: "settings" }
  | { s: "alerts" }
  | { s: "qr" };

export type DemoMode = "dark" | "light";

export interface PhoneCtxValue {
  colors: ThemeColors;
  mode: DemoMode;
  setMode: (m: DemoMode) => void;
  stack: Route[];
  push: (r: Route) => void;
  pop: () => void;
  reset: (r: Route) => void;
}

export const PhoneCtx = createContext<PhoneCtxValue | null>(null);

export function usePhone(): PhoneCtxValue {
  const ctx = useContext(PhoneCtx);
  if (!ctx) throw new Error("usePhone outside MooniPhone");
  return ctx;
}
