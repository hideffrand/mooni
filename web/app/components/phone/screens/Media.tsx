"use client";

import { useEffect, useMemo, useState } from "react";
import { Folder, Plus, Video, X } from "lucide-react";
import { usePhone } from "../theme";
import {
  DemoMediaItem,
  MEDIA_ALBUMS,
  MEDIA_ITEMS,
  dayStart,
  extOf,
  sectionTitle,
  thumbGradient,
} from "../demo";

const COLS = 3;

// Root: album strip + flat "All" grid grouped by day (MediaScreen layout).
export function MediaScreen({ path }: { path: string }) {
  const { colors, push } = usePhone();

  const scoped = useMemo(() => {
    if (!path) return MEDIA_ITEMS;
    const album = path.split("/").pop();
    return MEDIA_ITEMS.filter((m) => m.album === album);
  }, [path]);  const sections = useMemo(() => {
    const byDay = new Map<number, typeof scoped>();
    for (const item of scoped) {
      const key = dayStart(new Date(item.modTime));
      const arr = byDay.get(key) ?? [];
      arr.push(item);
      byDay.set(key, arr);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([key, items]) => ({ title: sectionTitle(new Date(key)), items }));
  }, [scoped]);

  return (
    <div style={{ backgroundColor: colors.background, minHeight: "100%" }}>
      {!path && (
        <div className="px-2 pt-2">
          <div style={{ color: colors.text, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 8px 8px" }}>
            Folders
          </div>
          <div className="grid grid-cols-3 gap-x-0.5 gap-y-1">
            {MEDIA_ALBUMS.map((a) => (
              <button
                key={a.name}
                onClick={() => push({ s: "media", path: a.name })}
                className="text-left active:opacity-80"
              >
                {a.cover ? (
                  <div
                    className="aspect-square w-full overflow-hidden rounded-md"
                    style={{ background: thumbGradient(a.cover) }}
                  />
                ) : (
                  <div
                    className="flex aspect-square w-full items-center justify-center rounded-md"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <Folder size={30} color={colors.textSecondary} />
                  </div>
                )}
                <div className="mt-1 truncate" style={{ color: colors.text, fontSize: 12, fontWeight: 500 }}>
                  {a.name}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: 11 }}>
                  {a.count} item{a.count === 1 ? "" : "s"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {sections.map((sec) => (
        <div key={sec.title}>
          <div className="px-4 pb-1.5 pt-4" style={{ color: colors.text, fontSize: 13, fontWeight: 700 }}>
            {sec.title}
          </div>
          <div className="grid grid-cols-3 gap-x-0.5 gap-y-0.5 px-0.5">
            {sec.items.map((item, i) => (
              <button
                key={`${item.path}-${i}`}
                onClick={() => push({ s: "viewer", path: item.path })}
                className="relative aspect-square w-full overflow-hidden active:opacity-85"
                style={{ background: thumbGradient(item.name) }}
              >
                {item.kind === "video" && (
                  <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/45 p-1">
                    <Video size={10} color="#fff" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {scoped.length === 0 && (
        <div className="flex flex-col items-center pt-24" style={{ color: colors.textMuted }}>
          <Folder size={52} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <span className="mt-3 text-sm">This folder has no media.</span>
        </div>
      )}

      <div className="px-4 pb-6 pt-5 text-center" style={{ color: colors.textMuted, fontSize: 11 }}>
        Demo photos — in the real app each tile is a server thumbnail.
      </div>

      {/* FAB (upload) */}
      <button
        className="absolute bottom-6 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{ backgroundColor: colors.primary, boxShadow: "0 3px 6px rgba(0,0,0,0.25)" }}
      >
        <Plus size={26} color={colors.onPrimary} />
      </button>
    </div>
  );
}

// Full-screen viewer (MediaViewerScreen): no header, tap to dismiss.
export function MediaViewerScreen({ path, onDismiss }: { path: string; onDismiss: () => void }) {
  const item = MEDIA_ITEMS.find((m) => m.path === path);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative flex h-full flex-col bg-black">
      <div className="absolute inset-0 flex items-center justify-center">
        {/* grid thumb paints first; the "large tier" fades in when ready */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ background: thumbGradient(path), opacity: ready ? 0 : 1, filter: "blur(2px)" }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: ready ? 1 : 0, background: thumbGradient(path + "hd") }}
        >
          {item?.kind === "video" && (
            <span className="rounded-full bg-white/20 p-5 backdrop-blur">
              <Video size={44} color="#fff" />
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 z-10 rounded-full bg-black/45 p-2 active:opacity-70"
      >
        <X size={22} color="#fff" />
      </button>

      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{item?.name ?? path}</div>
          <div className="text-xs text-white/60">
            {item?.album ?? "Media"} · {extOf(item?.name ?? "").toUpperCase()}
          </div>
        </div>
        <button className="rounded-full bg-black/45 px-4 py-2 text-xs font-semibold text-white active:opacity-70">
          Download
        </button>
      </div>
    </div>
  );
}
