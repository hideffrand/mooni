"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Cpu,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Images,
  Layers,
  Lock,
  Monitor,
  Plus,
  Power,
  RefreshCw,
  Server,
  Thermometer as ThermometerIcon,
} from "lucide-react";
import { usePhone, FILE_TYPE_COLORS } from "../theme";
import {
  DemoStats,
  MOCK_STATS,
  STAT_BOUNDS,
  formatBytes,
  formatUptime,
  loadColor,
  makeConfirmToken,
  tempColor,
  TEMP_MAX_C,
} from "../demo";
import { GradientMeter, PhoneAlert, Spinner, TypeToConfirm } from "../chrome";

type PowerAction = "reboot" | "shutdown" | "lock";

// CPU: little chip with pin rows, glowing by load (port of ChipGauge).
function ChipGauge({ percent, color }: { percent: number; color: string }) {
  const danger = percent > 90;
  return (
    <div className="mt-1.5 flex flex-col items-center">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={`t${i}`} className="h-1 w-1.5 rounded-[1px] opacity-60" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="relative my-1 flex items-center justify-center">
        <div
          className={`absolute h-[52px] w-[52px] rounded-full ${danger ? "mooni-halo" : ""}`}
          style={{ backgroundColor: color, opacity: danger ? undefined : 0.22 }}
        />
        <div
          className="flex h-[52px] w-[52px] items-center justify-center rounded-xl"
          style={{ borderWidth: 2.5, borderColor: color, backgroundColor: "var(--m-surface)" }}
        >
          <Cpu size={26} color={color} />
        </div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={`b${i}`} className="h-1 w-1.5 rounded-[1px] opacity-60" style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
}

const THERMO_TUBE_HEIGHT = 58;

// Temperature: thermometer with rising mercury and glowing bulb.
function Thermometer({ celsius }: { celsius: number }) {
  const { colors } = usePhone();
  const percent = (celsius / TEMP_MAX_C) * 100;
  const color = tempColor(percent);
  const fillHeight = Math.max(6, (Math.max(0, Math.min(100, percent)) / 100) * THERMO_TUBE_HEIGHT);
  const danger = celsius >= 85;
  return (
    <div className="mt-1.5 flex flex-col items-center">
      <div
        className="flex w-3.5 justify-end overflow-hidden rounded-full"
        style={{ height: THERMO_TUBE_HEIGHT, backgroundColor: colors.surface }}
      >
        <div
          className="w-full rounded-full transition-[height] duration-700"
          style={{ height: fillHeight, backgroundColor: color }}
        />
      </div>
      <div className="relative -mt-2 flex items-center justify-center">
        <div
          className={`absolute h-[26px] w-[26px] rounded-full ${danger ? "mooni-halo" : ""}`}
          style={{ backgroundColor: color, opacity: danger ? undefined : 0.22 }}
        />
        <div
          className="flex h-[26px] w-[26px] items-center justify-center rounded-full"
          style={{ backgroundColor: color, borderWidth: 3, borderColor: colors.card }}
        >
          <ThermometerIcon size={14} color={colors.onPrimary} />
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8, color }}>{Math.round(celsius)}°C</div>
    </div>
  );
}

function StatsBody({ stats }: { stats: DemoStats }) {
  const { colors } = usePhone();
  const card = { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12 };
  const rowLabel = { color: colors.textDim, fontSize: 14, fontWeight: 600 };
  const maxTemp = stats.tempsCelsius.length > 0 ? Math.max(...stats.tempsCelsius) : null;

  return (
    <>
      <div style={card}>
        <div style={{ color: colors.text, fontSize: 17, fontWeight: 700 }}>{stats.hostname}</div>
        <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{stats.os}</div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: colors.surface }}>
            <Clock size={12} color={colors.textDim} />
            <span style={{ color: colors.textDim, fontSize: 12 }}>{formatUptime(stats.uptimeSeconds)}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: colors.surface }}>
            <Layers size={12} color={colors.textDim} />
            <span style={{ color: colors.textDim, fontSize: 12 }}>{stats.processes} processes</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col items-center" style={card}>
          <div style={rowLabel}>CPU</div>
          <ChipGauge percent={stats.cpuPercent} color={loadColor(stats.cpuPercent)} />
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 10, color: loadColor(stats.cpuPercent) }}>
            {stats.cpuPercent.toFixed(1)}%
          </div>
          <div className="truncate" style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: "center", maxWidth: "100%" }}>
            {stats.loadAvg.map((v) => v.toFixed(2)).join(" · ")}
          </div>
        </div>

        {maxTemp !== null && (
          <div className="flex flex-1 flex-col items-center" style={card}>
            <div style={rowLabel}>Temp</div>
            <Thermometer celsius={maxTemp} />
            <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: "center" }}>
              Peak sensor
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers size={15} color={colors.textDim} />
            <span style={rowLabel}>Memory</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: loadColor(stats.memory.usedPercent) }}>
            {stats.memory.usedPercent.toFixed(1)}%
          </div>
        </div>
        <GradientMeter percent={stats.memory.usedPercent} />
        <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: "center" }}>
          {formatBytes(stats.memory.totalBytes - stats.memory.availableBytes)} of{" "}
          {formatBytes(stats.memory.totalBytes)}
        </div>
      </div>

      <div style={card}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Server size={15} color={colors.textDim} />
            <span style={rowLabel}>Disk</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: loadColor(stats.disk.usedPercent) }}>
            {stats.disk.usedPercent.toFixed(1)}%
          </div>
        </div>
        <GradientMeter percent={stats.disk.usedPercent} />
        <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: "center" }}>
          {formatBytes(stats.disk.availableBytes)} free of {formatBytes(stats.disk.totalBytes)}
        </div>
      </div>
    </>
  );
}

function FileManagerCard({ stats, onPress }: { stats: DemoStats | null; onPress: () => void }) {
  const { colors } = usePhone();
  const diskPercent = stats?.disk.usedPercent ?? null;

  return (
    <button
      onClick={onPress}
      className="w-full text-left active:opacity-75"
      style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12 }}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]"
          style={{ backgroundColor: colors.primarySoft }}
        >
          <FolderOpen size={24} color={colors.primary} />
          <div className="absolute -bottom-1.5 -left-1 flex">
            {[
              { bg: FILE_TYPE_COLORS.image, Icon: ImageIcon, z: 3 },
              { bg: FILE_TYPE_COLORS.doc, Icon: FileText, z: 2 },
              { bg: FILE_TYPE_COLORS.archive, Icon: Archive, z: 1 },
            ].map(({ bg, Icon, z }, i) => (
              <span
                key={i}
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${i > 0 ? "-ml-2" : ""}`}
                style={{ backgroundColor: bg, border: `2px solid ${colors.card}`, zIndex: z }}
              >
                <Icon size={9} color="#fff" />
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div style={{ color: colors.text, fontSize: 16, fontWeight: 600 }}>File Manager</div>
          <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2, lineHeight: "18px" }}>
            Browse, upload, download and manage files
          </div>
        </div>

        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full" style={{ backgroundColor: colors.primarySoft }}>
          <ChevronRight size={18} color={colors.primary} />
        </div>
      </div>

      {diskPercent !== null && stats && (
        <div className="mt-3.5">
          <GradientMeter percent={diskPercent} height={6} />
          <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>
            {formatBytes(stats.disk.availableBytes)} free of {formatBytes(stats.disk.totalBytes)}
          </div>
        </div>
      )}
    </button>
  );
}

function MediaLibraryCard({ onPress }: { onPress: () => void }) {
  const { colors } = usePhone();
  return (
    <button
      onClick={onPress}
      className="w-full text-left active:opacity-75"
      style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12 }}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: colors.primarySoft }}>
          <Images size={24} color={colors.primary} />
        </div>
        <div className="min-w-0 flex-1">
          <div style={{ color: colors.text, fontSize: 16, fontWeight: 600 }}>Media</div>
          <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2, lineHeight: "18px" }}>
            Photos and videos library, like Google Photos
          </div>
        </div>
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full" style={{ backgroundColor: colors.primarySoft }}>
          <ChevronRight size={18} color={colors.primary} />
        </div>
      </div>
    </button>
  );
}

export default function HomeScreen({ power }: { power?: boolean }) {
  const { colors, push } = usePhone();
  const sectionTitle = {
    color: colors.text,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  };

  const [stats, setStats] = useState<DemoStats>(MOCK_STATS);
  const [powerAction_, setPowerAction_] = useState<PowerAction | null>(null);
  const [powerToken, setPowerToken] = useState("");
  const [powerBusy, setPowerBusy] = useState(false);
  const [powerExpanded, setPowerExpanded] = useState(false);
  const [doneAlert, setDoneAlert] = useState<{ title: string; message: string } | null>(null);
  const bounds = useRef(STAT_BOUNDS);

  useEffect(() => {
    if (power) setPowerExpanded(true);
  }, [power]);

  // Live-feeling stats: gentle wander every 2s (the real app polls every 5s).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setStats((prev) => {
        const b = bounds.current;
        const cpu = wander(prev.cpuPercent, b.cpu.min, b.cpu.max);
        const mem = wander(prev.memory.usedPercent, b.mem.min, b.mem.max);
        const temp = wander(prev.tempsCelsius[0], b.temp.min, b.temp.max);
        return {
          ...prev,
          uptimeSeconds: prev.uptimeSeconds + 2,
          cpuPercent: cpu,
          loadAvg: [cpu / 24, prev.loadAvg[1], prev.loadAvg[2]] as [number, number, number],
          memory: {
            ...prev.memory,
            usedPercent: mem,
            availableBytes: prev.memory.totalBytes * (1 - mem / 100),
          },
          tempsCelsius: [temp, Math.max(38, temp - 4)],
        };
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const confirmPower = () => {
    if (!powerAction_) return;
    setPowerBusy(true);
    const action = powerAction_;
    window.setTimeout(() => {
      setPowerBusy(false);
      setPowerAction_(null);
      setDoneAlert({
        title: action === "reboot" ? "Rebooting" : action === "shutdown" ? "Shutting down" : "Locking",
        message:
          action === "reboot"
            ? "The device is restarting. It will reappear when it's back online.\n\n(Demo — nothing was sent to a real machine.)"
            : action === "shutdown"
            ? "The device is powering off.\n\n(Demo — nothing was sent to a real machine.)"
            : "The screen is now locked.\n\n(Demo — nothing was sent to a real machine.)",
      });
    }, 900);
  };

  return (
    <div style={{ backgroundColor: colors.background, paddingBottom: 32 }}>
      {/* device chips */}
      <div style={{ backgroundColor: colors.cardAlt, borderBottom: `1px solid ${colors.border}` }}>
        <div className="mooni-no-scrollbar flex gap-2 overflow-x-auto px-3 py-2.5">
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2"
            style={{ backgroundColor: colors.primarySoft, border: `1px solid ${colors.primary}`, maxWidth: 180 }}
          >
            <Monitor size={14} color={colors.primary} />
            <span className="truncate" style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>
              homelab
            </span>
          </div>
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, maxWidth: 180 }}
          >
            <Monitor size={14} color={colors.textSecondary} />
            <span className="truncate" style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 600 }}>
              pi-4
            </span>
          </div>
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.primary}` }}
          >
            <Plus size={16} color={colors.primary} />
            <span style={{ color: colors.primary, fontSize: 13, fontWeight: 600 }}>Add</span>
          </div>
        </div>
      </div>

      {/* system status */}
      <div className="p-4 pb-1">
        <div className="mb-2.5" style={sectionTitle}>
          System Status
        </div>
        <StatsBody stats={stats} />
      </div>

      {/* quick actions */}
      <div className="p-4 pb-1">
        <FileManagerCard stats={stats} onPress={() => push({ s: "files", path: "" })} />
        <MediaLibraryCard onPress={() => push({ s: "media", path: "" })} />
      </div>

      {/* power */}
      <div className="px-4 pt-1 pb-4">
        <button
          onClick={() => setPowerExpanded((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <span style={sectionTitle}>Power</span>
          {powerExpanded ? (
            <ChevronUp size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
        </button>
        {powerExpanded && (
          <div style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginTop: 10 }}>
            <div style={{ color: colors.textSecondary, fontSize: 13, lineHeight: "18px" }}>
              These commands will affect the whole machine, not just this app.
            </div>
            <div className="mt-3.5 flex gap-3">
              <button
                onClick={() => {
                  setPowerToken(makeConfirmToken());
                  setPowerAction_("reboot");
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 active:opacity-80"
                style={{ backgroundColor: colors.primary }}
              >
                <RefreshCw size={18} color={colors.onPrimary} />
                <span style={{ color: colors.onPrimary, fontWeight: 700, fontSize: 15 }}>Reboot</span>
              </button>
              <button
                onClick={() => {
                  setPowerToken(makeConfirmToken());
                  setPowerAction_("shutdown");
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 active:opacity-80"
                style={{ backgroundColor: colors.danger }}
              >
                <Power size={18} color={colors.onPrimary} />
                <span style={{ color: colors.onPrimary, fontWeight: 700, fontSize: 15 }}>Shutdown</span>
              </button>
              <button
                onClick={() => {
                  setPowerToken(makeConfirmToken());
                  setPowerAction_("lock");
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 active:opacity-80"
                style={{ backgroundColor: colors.primary }}
              >
                <Lock size={18} color={colors.onPrimary} />
                <span style={{ color: colors.onPrimary, fontWeight: 700, fontSize: 15 }}>Lock</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {powerAction_ && (
        <TypeToConfirm
          title={
            powerAction_ === "reboot"
              ? "Reboot device?"
              : powerAction_ === "shutdown"
              ? "Shut down device?"
              : "Lock device screen?"
          }
          message={
            powerAction_ === "reboot"
              ? "This will restart the machine. Any unsaved work on it will be lost."
              : powerAction_ === "shutdown"
              ? "This will power the machine off. It stays off until someone starts it again."
              : "This will lock the desktop session on the machine. Requires an active screen session."
          }
          token={powerToken}
          busy={powerBusy}
          confirmLabel={powerAction_ === "reboot" ? "Reboot" : powerAction_ === "shutdown" ? "Shutdown" : "Lock"}
          onCancel={() => setPowerAction_(null)}
          onConfirm={confirmPower}
        />
      )}

      {doneAlert && (
        <PhoneAlert
          title={doneAlert.title}
          message={doneAlert.message}
          onClose={() => setDoneAlert(null)}
        />
      )}

      {powerBusy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: colors.overlay }}>
          <Spinner size={30} color={colors.primary} />
        </div>
      )}
    </div>
  );
}

function wander(value: number, min: number, max: number) {
  const step = (Math.random() - 0.5) * 5;
  return Math.min(max, Math.max(min, value + step));
}
