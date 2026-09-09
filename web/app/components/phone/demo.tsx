// Mock server data for the landing-page phone demo. Everything lives
// client-side; nothing here talks to a backend.

export type DemoEntry = {
  name: string;
  size: number;
  modTime: string;
  isDir: boolean;
};

export type DemoMediaItem = {
  name: string;
  path: string;
  kind: "image" | "video";
  modTime: string;
  album: string;
};

export type DemoStats = {
  hostname: string;
  os: string;
  uptimeSeconds: number;
  processes: number;
  cpuPercent: number;
  loadAvg: [number, number, number];
  memory: { usedPercent: number; totalBytes: number; availableBytes: number };
  disk: { usedPercent: number; totalBytes: number; availableBytes: number };
  tempsCelsius: number[];
};

// -- byte/time formatting (port of the RN helpers) --

export function formatBytes(bytes: number): string {
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

export function formatSize(bytes: number): string {
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

export function formatUptime(seconds: number): string {
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

// -- color ramps (port of HomeScreen.tsx) --

export type ColorStop = { p: number; c: string };

const LOAD_STOPS: ColorStop[] = [
  { p: 0, c: "#22C55E" },
  { p: 60, c: "#EAB308" },
  { p: 85, c: "#F97316" },
  { p: 100, c: "#EF4444" },
];

export const TEMP_MAX_C = 95;
const TEMP_STOPS: ColorStop[] = [
  { p: 0, c: "#38BDF8" },
  { p: 45, c: "#22C55E" },
  { p: 70, c: "#EAB308" },
  { p: 90, c: "#EF4444" },
];

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function interpolateColor(percent: number, stops: ColorStop[]): string {
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

export const loadColor = (p: number) => interpolateColor(p, LOAD_STOPS);
export const tempColor = (p: number) => interpolateColor(p, TEMP_STOPS);

export function getRangeColor(percent: number): string {
  const bands: { max: number; color: string }[] = [
    { max: 20, color: "#22C55E" },
    { max: 40, color: "#84CC16" },
    { max: 60, color: "#EAB308" },
    { max: 80, color: "#F97316" },
    { max: 100, color: "#EF4444" },
  ];
  const p = Math.max(0, Math.min(100, percent));
  for (const band of bands) if (p <= band.max) return band.color;
  return "#EF4444";
}

// -- file type visuals (port of mobile/src/utils/fileTypes.ts) --

import { BADGE_COLOR } from "./theme";


export type FileTypeVisual =
  | { kind: "thumb"; media: "image" | "video" }
  | { kind: "badge"; label: string; color: string }
  | { kind: "icon" };

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "bmp"]);
const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm", "mkv"]);

const KIND_EXT: Record<string, string[]> = {
  doc: ["doc", "docx", "rtf", "txt", "md", "odt"],
  sheet: ["xls", "xlsx", "csv", "ods"],
  slide: ["ppt", "pptx", "odp"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
  audio: ["mp3", "wav", "aac", "flac", "ogg", "m4a", "opus"],
  code: ["json", "xml", "js", "ts", "tsx", "jsx", "py", "go", "sh", "yml", "yaml", "html", "css", "sql", "java", "c", "cpp", "rs"],
};

const EXT_TO_GROUP = new Map<string, string>();
for (const [group, exts] of Object.entries(KIND_EXT)) {
  for (const e of exts) EXT_TO_GROUP.set(e, group);
}

export function extOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function fileTypeVisual(name: string): FileTypeVisual {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return { kind: "thumb", media: "image" };
  if (VIDEO_EXT.has(ext)) return { kind: "thumb", media: "video" };
  const group = EXT_TO_GROUP.get(ext);
  if (group) {
    return {
      kind: "badge",
      label: ext === "7z" ? "7Z" : ext.slice(0, 3).toUpperCase(),
      color: BADGE_COLOR[group],
    };
  }
  if (!ext) return { kind: "icon" };
  return ext.length <= 4 && /^[a-z0-9]+$/.test(ext)
    ? { kind: "badge", label: ext.slice(0, 3).toUpperCase(), color: BADGE_COLOR.code }
    : { kind: "icon" };
}

// Deterministic gradient placeholder for a media/file thumbnail (the demo
// has no real photos; hue is hashed from the name so cells stay stable).
export function thumbGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 48% 52%), hsl(${(h + 42) % 360} 55% 30%))`;
}

export function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function sectionTitle(d: Date): string {
  const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// -- mock content --

const daysAgo = (n: number, h = 14): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 23, 0, 0);
  return d.toISOString();
};

export const MOCK_STATS: DemoStats = {
  hostname: "homelab",
  os: "Debian GNU/Linux 12 (bookworm)",
  uptimeSeconds: 34 * 86400 + 7 * 3600 + 52 * 60,
  processes: 214,
  cpuPercent: 12.4,
  loadAvg: [0.42, 0.38, 0.35],
  memory: { usedPercent: 41.2, totalBytes: 16 * 1024 ** 3, availableBytes: 9.4 * 1024 ** 3 },
  disk: { usedPercent: 63.8, totalBytes: 512 * 1024 ** 3, availableBytes: 185.2 * 1024 ** 3 },
  tempsCelsius: [47.5, 44.0],
};

// Live-ish wander bounds for the gauges.
export const STAT_BOUNDS = {
  cpu: { min: 4, max: 38 },
  mem: { min: 36, max: 49 },
  temp: { min: 42, max: 58 },
};

export const FILE_TREE: Record<string, DemoEntry[]> = {
  "": [
    { name: "backups", size: 0, modTime: daysAgo(2), isDir: true },
    { name: "docs", size: 0, modTime: daysAgo(1), isDir: true },
    { name: "media", size: 0, modTime: daysAgo(0), isDir: true },
    { name: "projects", size: 0, modTime: daysAgo(6), isDir: true },
    { name: "mooni.apk", size: 28.4 * 1024 ** 2, modTime: daysAgo(0), isDir: false },
    { name: "notes.md", size: 4.2 * 1024, modTime: daysAgo(0), isDir: false },
    { name: "docker-compose.yml", size: 1.8 * 1024, modTime: daysAgo(3), isDir: false },
    { name: "syslog.log", size: 12.6 * 1024 ** 2, modTime: daysAgo(0), isDir: false },
  ],
  backups: [
    { name: "home-2026-09-08.tar.gz", size: 3.2 * 1024 ** 3, modTime: daysAgo(1), isDir: false },
    { name: "home-2026-09-01.tar.gz", size: 3.1 * 1024 ** 3, modTime: daysAgo(8), isDir: false },
    { name: "db.sql", size: 184 * 1024 ** 2, modTime: daysAgo(1), isDir: false },
  ],
  docs: [
    { name: "report.pdf", size: 2.7 * 1024 ** 2, modTime: daysAgo(4), isDir: false },
    { name: "budget.xlsx", size: 84 * 1024, modTime: daysAgo(9), isDir: false },
    { name: "pitch.pptx", size: 9.4 * 1024 ** 2, modTime: daysAgo(12), isDir: false },
    { name: "readme.txt", size: 2 * 1024, modTime: daysAgo(2), isDir: false },
  ],
  media: [
    { name: "photos", size: 0, modTime: daysAgo(0), isDir: true },
    { name: "wallpapers", size: 0, modTime: daysAgo(5), isDir: true },
    { name: "trip-recap.mp4", size: 412 * 1024 ** 2, modTime: daysAgo(2), isDir: false },
    { name: "podcast-ep12.ogg", size: 58 * 1024 ** 2, modTime: daysAgo(3), isDir: false },
  ],
  "media/photos": [
    { name: "IMG_0341.jpg", size: 3.8 * 1024 ** 2, modTime: daysAgo(0), isDir: false },
    { name: "IMG_0342.jpg", size: 4.1 * 1024 ** 2, modTime: daysAgo(0), isDir: false },
    { name: "sunset.png", size: 6.2 * 1024 ** 2, modTime: daysAgo(1), isDir: false },
  ],
  "media/wallpapers": [
    { name: "aurora.png", size: 11.8 * 1024 ** 2, modTime: daysAgo(5), isDir: false },
    { name: "mountains.jpg", size: 8.9 * 1024 ** 2, modTime: daysAgo(5), isDir: false },
  ],
  projects: [
    { name: "mooni", size: 0, modTime: daysAgo(0), isDir: true },
    { name: "dotfiles", size: 0, modTime: daysAgo(6), isDir: true },
    { name: "scratch.go", size: 3 * 1024, modTime: daysAgo(0), isDir: false },
    { name: "deploy.sh", size: 1 * 1024, modTime: daysAgo(4), isDir: false },
    { name: "backup.zip", size: 214 * 1024 ** 2, modTime: daysAgo(6), isDir: false },
  ],
  "projects/mooni": [
    { name: "agent", size: 0, modTime: daysAgo(0), isDir: true },
    { name: "mobile", size: 0, modTime: daysAgo(0), isDir: true },
    { name: "README.md", size: 8 * 1024, modTime: daysAgo(0), isDir: false },
  ],
  "projects/dotfiles": [
    { name: "zshrc", size: 6 * 1024, modTime: daysAgo(6), isDir: false },
    { name: "hyprland.conf", size: 9 * 1024, modTime: daysAgo(6), isDir: false },
  ],
};

// Media library: albums + a flat "All" grid grouped by day.
export const MEDIA_ALBUMS: { name: string; count: number; cover?: string }[] = [
  { name: "Camera", count: 14, cover: "IMG_0341.jpg" },
  { name: "Screenshots", count: 6, cover: "shot-terminal.png" },
  { name: "Wallpapers", count: 2, cover: "aurora.png" },
];

const mk = (name: string, kind: "image" | "video", dayOffset: number, album: string): DemoMediaItem => ({
  name,
  path: `${album}/${name}`,
  kind,
  modTime: daysAgo(dayOffset, dayOffset === 0 ? 9 : 15),
  album,
});

export const MEDIA_ITEMS: DemoMediaItem[] = [
  mk("IMG_0341.jpg", "image", 0, "Camera"),
  mk("IMG_0342.jpg", "image", 0, "Camera"),
  mk("desk-setup.jpg", "image", 0, "Camera"),
  mk("cable-arty.mp4", "video", 0, "Camera"),
  mk("shot-terminal.png", "image", 0, "Screenshots"),
  mk("shot-htop.png", "image", 0, "Screenshots"),
  mk("IMG_0338.jpg", "image", 1, "Camera"),
  mk("IMG_0339.jpg", "image", 1, "Camera"),
  mk("dog-park.mp4", "video", 1, "Camera"),
  mk("shot-logs.png", "image", 1, "Screenshots"),
  mk("aurora.png", "image", 4, "Wallpapers"),
  mk("mountains.jpg", "image", 4, "Wallpapers"),
  mk("server-rack.jpg", "image", 5, "Camera"),
  mk("coffee.jpg", "image", 5, "Camera"),
  mk("IMG_0321.jpg", "image", 6, "Camera"),
  mk("night-sky.png", "image", 6, "Camera"),
  mk("shot-config.png", "image", 7, "Screenshots"),
  mk("roadtrip.mp4", "video", 8, "Camera"),
  mk("IMG_0302.jpg", "image", 8, "Camera"),
  mk("lake.jpg", "image", 9, "Camera"),
];

export const POWER_WORDS = [
  "ORBIT", "FALCON", "NOBLE", "EMERALD", "THUNDER", "COBALT",
  "RAVEN", "PHOENIX", "SAILOR", "HARBOR", "MONARCH", "VELVET",
];

export function makeConfirmToken(): string {
  const pick = () => POWER_WORDS[Math.floor(Math.random() * POWER_WORDS.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 90) + 10}`;
}
