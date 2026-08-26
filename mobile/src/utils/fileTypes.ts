import { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

/** Extension without dot, lowercased ("" when the name has none). */
export function extOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

// Must stay in sync with agent/internal/thumbs/thumbs.go (what the thumbnailer supports).
const IMAGE_THUMB_EXT = new Set(["jpg", "jpeg", "png", "gif", "bmp"]);
const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm", "mkv"]);

export type FileTypeVisual =
  /** Server thumbnail available; "preview" streams the original (webp). */
  | { kind: "thumb"; endpoint: "thumb" | "preview" }
  | { kind: "icon"; name: IoniconsName }
  | { kind: "badge"; label: string; color: string };

// Badge colors are fixed brand-like hues so formats stay recognizable across themes.
const BADGE_COLOR: Record<string, string> = {
  pdf: "#E53935",
  doc: "#1E88E5",
  sheet: "#43A047",
  slide: "#FB8C00",
  archive: "#F9A825",
  audio: "#8E24AA",
  code: "#546E7A",
};

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

/**
 * How to visually represent a file: server thumbnail (images/videos),
 * a colored extension badge (docs/archives/audio/code), or a plain glyph.
 */
export function fileTypeVisual(name: string): FileTypeVisual {
  const ext = extOf(name);
  if (IMAGE_THUMB_EXT.has(ext)) return { kind: "thumb", endpoint: "thumb" };
  if (ext === "webp") return { kind: "thumb", endpoint: "preview" }; // thumbnailer can't decode webp
  if (VIDEO_EXT.has(ext)) return { kind: "thumb", endpoint: "thumb" }; // needs ffmpeg; falls back on error

  const group = EXT_TO_GROUP.get(ext);
  if (group) {
    return {
      kind: "badge",
      label: ext === "7z" ? "7Z" : ext.slice(0, 3).toUpperCase(),
      color: BADGE_COLOR[group],
    };
  }
  if (!ext) return { kind: "icon", name: "document-outline" };
  // Known-but-uncategorized extensions get their own badge; unknown ones a glyph.
  return ext.length <= 4 && /^[a-z0-9]+$/.test(ext)
    ? { kind: "badge", label: ext.slice(0, 3).toUpperCase(), color: BADGE_COLOR.code }
    : { kind: "icon", name: "document-outline" };
}

/** Plain Ionicons name for surfaces that only show glyphs (share sheet rows). */
export function ionIconFor(name: string): IoniconsName {
  const v = fileTypeVisual(name);
  if (v.kind === "icon") return v.name;
  if (v.kind === "thumb") {
    const ext = extOf(name);
    return VIDEO_EXT.has(ext) ? "videocam-outline" : "image-outline";
  }
  if (EXT_TO_GROUP.get(extOf(name)) === "audio") return "musical-notes-outline";
  return "document-text-outline";
}
