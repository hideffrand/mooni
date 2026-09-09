"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  EllipsisVertical,
  File,
  Folder,
  Grid3X3,
  Home,
  List,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { usePhone } from "../theme";
import { DemoEntry, FILE_TREE, fileTypeVisual, formatSize, thumbGradient } from "../demo";
import { Spinner } from "../chrome";

const FOLDER_GOLD = "#E6B84C";

// Live mock tree: uploads/mkdirs persist across navigation within the demo.
const liveTree: Record<string, DemoEntry[]> = JSON.parse(JSON.stringify(FILE_TREE));

type SortField = "name" | "size" | "date";
type SortDir = "asc" | "desc";
const SORT_OPTIONS: { label: string; field: SortField; dir: SortDir }[] = [
  { label: "Name (A → Z)", field: "name", dir: "asc" },
  { label: "Name (Z → A)", field: "name", dir: "desc" },
  { label: "Size (small → large)", field: "size", dir: "asc" },
  { label: "Size (large → small)", field: "size", dir: "desc" },
  { label: "Date (oldest first)", field: "date", dir: "asc" },
  { label: "Date (newest first)", field: "date", dir: "desc" },
];

function formatBytesRow(bytes: number): string {
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

// One entry visual: gradient thumb for images/videos, colored ext badge, or glyph.
function FileTypeIcon({ name, isDir, variant }: { name: string; isDir: boolean; variant: "list" | "grid" }) {
  const { colors } = usePhone();
  if (isDir) {
    return (
      <div className="flex items-center justify-center" style={variant === "list" ? { width: 40, height: 40 } : { width: "100%", height: "100%" }}>
        <Folder size={variant === "grid" ? 38 : 22} color={FOLDER_GOLD} />
      </div>
    );
  }
  const visual = fileTypeVisual(name);
  const box = variant === "list" ? { width: 40, height: 40 } : { width: "100%", height: "100%" };
  if (visual.kind === "thumb") {
    return (
      <div
        className="flex items-center justify-center"
        style={{ ...box, background: thumbGradient(name), borderRadius: variant === "grid" ? 8 : 6 }}
      >
        {visual.media === "video" && <File size={20} color="rgba(255,255,255,0.85)" />}
      </div>
    );
  }
  if (visual.kind === "badge") {
    return (
      <div className="flex items-center justify-center" style={box}>
        <span
          style={{
            color: "#fff",
            fontSize: variant === "list" ? 10 : 13,
            fontWeight: 800,
            letterSpacing: 0.5,
            padding: variant === "list" ? "3px 5px" : "6px 8px",
            borderRadius: 6,
            backgroundColor: visual.color,
          }}
        >
          {visual.label}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center" style={box}>
      <File size={variant === "grid" ? 38 : 22} color={colors.textSecondary} />
    </div>
  );
}

function BottomSheet({
  title,
  options,
  onClose,
}: {
  title: string;
  options: { label: string; danger?: boolean; onSelect: () => void }[];
  onClose: () => void;
}) {
  const { colors } = usePhone();
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" style={{ background: colors.overlay }} onClick={onClose}>
      <div
        className="rounded-t-[20px] pb-6 pt-3"
        style={{ backgroundColor: colors.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full" style={{ backgroundColor: colors.surface }} />
        <div className="px-5 pb-2" style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 700 }}>
          {title}
        </div>
        {options.map((o) => (
          <button
            key={o.label}
            onClick={() => {
              onClose();
              o.onSelect();
            }}
            className="w-full px-5 py-3.5 text-left text-[15px] active:opacity-70"
            style={{ color: o.danger ? colors.dangerText : colors.text, fontWeight: 500, borderTop: `1px solid ${colors.border}` }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FileBrowserScreen({ path }: { path: string }) {
  const { colors, push, reset } = usePhone();
  const [entries, setEntries] = useState<DemoEntry[]>(() => liveTree[path] ?? []);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [fabMenuVisible, setFabMenuVisible] = useState(false);
  const [entryMenu, setEntryMenu] = useState<DemoEntry | null>(null);
  const [uploads, setUploads] = useState<{ id: number; name: string; progress: number }[]>([]);
  const [busy, setBusy] = useState(false);

  // Re-read the tree when drilling into another folder instance.
  useEffect(() => {
    setEntries(liveTree[path] ?? []);
  }, [path]);

  const sorted = useMemo(() => {
    const cmp = (a: DemoEntry, b: DemoEntry) => {
      let result = 0;
      if (sortField === "name") result = a.name.localeCompare(b.name);
      else if (sortField === "size") result = a.size - b.size;
      else result = new Date(a.modTime).getTime() - new Date(b.modTime).getTime();
      return sortDir === "asc" ? result : -result;
    };
    return [...entries.filter((e) => e.isDir).sort(cmp), ...entries.filter((e) => !e.isDir).sort(cmp)];
  }, [entries, sortField, sortDir]);

  const openEntry = (e: DemoEntry) => {
    const nextPath = path ? `${path}/${e.name}` : e.name;
    if (e.isDir) push({ s: "files", path: nextPath });
    else push({ s: "preview", path: nextPath, name: e.name });
  };

  const patchUpload = (id: number, patch: Partial<{ progress: number }>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  // Mock upload: simulated progress, then the file appears in the list.
  const mockUpload = () => {
    const id = Date.now();
    const name = `IMG_0${(id % 90) + 10}.jpg`;
    setUploads((prev) => [...prev, { id, name, progress: 0 }]);
    let p = 0;
    const timer = setInterval(() => {
      p += 0.14 + Math.random() * 0.2;
      if (p >= 1) {
        clearInterval(timer);
        setUploads((prev) => prev.filter((u) => u.id !== id));
        const entry: DemoEntry = { name, size: 3.4 * 1024 ** 2, modTime: new Date().toISOString(), isDir: false };
        liveTree[path] = [...(liveTree[path] ?? []), entry];
        setEntries((prev) => [...prev, entry]);
      } else {
        patchUpload(id, { progress: p });
      }
    }, 350);
  };

  const mockMkdir = () => {
    setBusy(true);
    window.setTimeout(() => {
      const base = liveTree[path] ?? [];
      const name = `new-folder${base.filter((e) => e.name.startsWith("new-folder")).length || ""}`;
      const entry: DemoEntry = { name, size: 0, modTime: new Date().toISOString(), isDir: true };
      liveTree[path] = [...base, entry];
      setEntries((prev) => [...prev, entry]);
      setBusy(false);
    }, 700);
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.field === sortField && o.dir === sortDir)?.label ?? "Sort";

  return (
    <div className="relative" style={{ backgroundColor: colors.background, minHeight: "100%" }}>
      {/* top bar: home / path / filter / view toggle */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-1.5">
        <button
          onClick={() => reset({ s: "home" })}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full active:opacity-70"
          style={{ backgroundColor: colors.card }}
        >
          <Home size={18} color={colors.textLighter} />
        </button>
        <div className="min-w-0 flex-1 truncate" style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 500 }}>
          {path || "/"}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortMenuVisible(true)}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: colors.card }}
          >
            <SlidersHorizontal size={18} color={colors.textLighter} />
          </button>
          <button
            onClick={() => setViewMode((m) => (m === "list" ? "grid" : "list"))}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: colors.card }}
          >
            {viewMode === "list" ? <Grid3X3 size={18} color={colors.textLighter} /> : <List size={18} color={colors.textLighter} />}
          </button>
        </div>
      </div>
      <div style={{ color: colors.textMuted, fontSize: 11, padding: "0 16px 8px" }}>
        Sorted by {currentSortLabel}
      </div>

      {busy && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <Spinner size={14} color={colors.primary} />
          <span style={{ color: colors.textSoft, fontSize: 12 }}>Processing…</span>
        </div>
      )}

      {viewMode === "list" ? (
        <div className="pb-24">
          {sorted.map((e) => (
            <div
              key={e.name}
              className="flex items-center border-b py-3 pl-4 pr-2 active:bg-black/5"
              style={{ borderColor: colors.border }}
              onClick={() => openEntry(e)}
            >
              <div className="mr-3">
                <FileTypeIcon name={e.name} isDir={e.isDir} variant="list" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ color: colors.text, fontSize: 15, fontWeight: 500 }}>
                  {e.name}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {e.isDir ? "Folder" : formatSize(e.size)} ·{" "}
                  {new Date(e.modTime).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  setEntryMenu(e);
                }}
                className="px-1.5 py-2.5 active:opacity-60"
              >
                <EllipsisVertical size={18} color={colors.textSecondary} />
              </button>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="flex flex-col items-center pt-24" style={{ color: colors.textMuted }}>
              <Folder size={52} color={colors.textSecondary} style={{ opacity: 0.4 }} />
              <span className="mt-3 text-sm">This folder is empty.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 px-2 pb-24 pt-2">
          {sorted.map((e) => (
            <button
              key={e.name}
              onClick={() => openEntry(e)}
              className="text-left active:opacity-80"
              style={{ backgroundColor: colors.card, borderRadius: 12, padding: 8 }}
            >
              <div
                className="mb-1.5 flex aspect-square items-center justify-center overflow-hidden rounded-lg"
                style={{ backgroundColor: colors.background }}
              >
                <FileTypeIcon name={e.name} isDir={e.isDir} variant="grid" />
              </div>
              <div className="truncate" style={{ color: colors.text, fontSize: 12, fontWeight: 500 }}>
                {e.name}
              </div>
              <div style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>
                {e.isDir ? "Folder" : formatBytesRow(e.size)}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setFabMenuVisible(true)}
        className="absolute bottom-6 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{ backgroundColor: colors.primary, boxShadow: "0 3px 6px rgba(0,0,0,0.25)" }}
      >
        <Plus size={26} color={colors.onPrimary} />
      </button>

      {/* upload progress panels */}
      <div className="absolute bottom-[90px] left-3 right-3 z-10 flex flex-col gap-2">
        {uploads.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: colors.card, boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate" style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>
                {u.name}
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.surface }}>
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${Math.min(100, u.progress * 100)}%`, backgroundColor: colors.primary }}
                />
              </div>
            </div>
            <span className="w-8 text-right" style={{ color: colors.textSecondary, fontSize: 11, fontWeight: 600 }}>
              {Math.round(Math.min(1, u.progress) * 100)}%
            </span>
          </div>
        ))}
      </div>

      {sortMenuVisible && (
        <BottomSheet
          title="Sort by"
          options={SORT_OPTIONS.map((o) => ({
            label: o.label,
            onSelect: () => {
              setSortField(o.field);
              setSortDir(o.dir);
            },
          }))}
          onClose={() => setSortMenuVisible(false)}
        />
      )}

      {fabMenuVisible && (
        <BottomSheet
          title="Add to this folder"
          options={[
            { label: "Upload file", onSelect: mockUpload },
            { label: "New folder", onSelect: mockMkdir },
          ]}
          onClose={() => setFabMenuVisible(false)}
        />
      )}

      {entryMenu && (
        <BottomSheet
          title={entryMenu.name}
          options={[
            { label: entryMenu.isDir ? "Open" : "Preview", onSelect: () => openEntry(entryMenu) },
            { label: "Download", onSelect: () => {} },
            { label: "Rename", onSelect: () => {} },
            { label: "Delete", danger: true, onSelect: () => {} },
          ]}
          onClose={() => setEntryMenu(null)}
        />
      )}
    </div>
  );
}

// -- file preview (image thumbs get a big gradient; others a document card) --

export function FilePreviewScreen({ name }: { name: string }) {
  const { colors } = usePhone();
  const visual = fileTypeVisual(name);
  const isThumb = visual.kind === "thumb";

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: colors.background }}>
      <div className="flex-1 overflow-y-auto p-4 mooni-no-scrollbar">
        {isThumb ? (
          <div
            className="aspect-square w-full rounded-xl"
            style={{ background: thumbGradient(name) }}
          />
        ) : (
          <div
            className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
          >
            <File size={64} color={colors.textSecondary} />
            <span style={{ color: colors.textMuted, fontSize: 12 }}>
              {visual.kind === "badge" ? `${visual.label} document` : "No preview available"}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: colors.card }}>
          <div className="min-w-0">
            <div className="truncate" style={{ color: colors.text, fontSize: 15, fontWeight: 600 }}>
              {name}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {isThumb ? "Full size stream · HTTP Range" : "Preview"}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 rounded-xl px-4 py-3" style={{ backgroundColor: colors.card }}>
          <ChevronLeft size={14} color={colors.textMuted} className="rotate-180" />
          <span style={{ color: colors.textMuted, fontSize: 12 }}>
            Demo file — actions are decorative here.
          </span>
        </div>
      </div>
    </div>
  );
}

