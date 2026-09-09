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
  background: "#111318",
  card: "#1c1f26",
  cardAlt: "#161920",
  surface: "#2a2e37",
  border: "#242832",
  text: "#f2f3f5",
  textSecondary: "#8a8f98",
  textMuted: "#6b7280",
  textDim: "#c7cbd3",
  textSoft: "#9ca3af",
  textLighter: "#e5e7eb",
  primary: "#3b82f6",
  primarySoft: "#1e3a5f",
  danger: "#dc2626",
  dangerText: "#f87171",
  onPrimary: "#fff",
  overlay: "rgba(0,0,0,0.5)",
};

export const lightColors: ThemeColors = {
  background: "#f4f5f7",
  card: "#ffffff",
  cardAlt: "#e9ebef",
  surface: "#e2e5ea",
  border: "#d5d9e0",
  text: "#17181c",
  textSecondary: "#5b6470",
  textMuted: "#8a919c",
  textDim: "#3f4650",
  textSoft: "#6b7280",
  textLighter: "#4b5563",
  primary: "#3b82f6",
  primarySoft: "#dbeafe",
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
