"use client";

import { useState } from "react";
import {
  Bell,
  ChevronRight,
  FileText,
  Minus,
  Moon,
  Palette,
  Plus,
  Sun,
} from "lucide-react";
import { usePhone } from "../theme";

// -- Settings (port of SettingsScreen.tsx) --

export function SettingsScreen() {
  const { colors, mode, setMode, push } = usePhone();
  const MODES: { value: "dark" | "light"; label: string; Icon: typeof Moon }[] = [
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "light", label: "Light", Icon: Sun },
  ];

  const section = { padding: 16 };
  const sectionTitle = {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  };
  const group = {
    backgroundColor: colors.card,
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    overflow: "hidden" as const,
  };

  return (
    <div style={{ backgroundColor: colors.background, minHeight: "100%" }}>
      <div style={section}>
        <div style={sectionTitle}>Preferences</div>
        <div style={group}>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2.5">
              <Palette size={20} color={colors.textSecondary} />
              <span style={{ color: colors.text, fontSize: 15, fontWeight: 500 }}>Appearance</span>
            </div>
            <div className="flex rounded-[10px] p-[3px]" style={{ backgroundColor: colors.surface }}>
              {MODES.map(({ value, label, Icon }) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    className="flex items-center gap-1.5 rounded-lg px-3.5 py-[7px] active:opacity-80"
                    style={{
                      backgroundColor: active ? colors.primarySoft : "transparent",
                    }}
                  >
                    <Icon size={16} color={active ? colors.primary : colors.textSecondary} />
                    <span
                      style={{
                        color: active ? colors.primary : colors.textSecondary,
                        fontSize: 13,
                        fontWeight: active ? 700 : 600,
                      }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>Device</div>
        <div style={group}>
          <button
            onClick={() => push({ s: "alerts" })}
            className="flex w-full items-center justify-between p-4 active:opacity-75"
          >
            <span className="flex items-center gap-2.5">
              <Bell size={20} color={colors.textSecondary} />
              <span style={{ color: colors.text, fontSize: 15, fontWeight: 500 }}>Threshold Alerts</span>
            </span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>
        </div>
      </div>

      <div style={{ ...section, paddingBottom: 32 }}>
        <div style={sectionTitle}>Legal</div>
        <div style={group}>
          <button className="flex w-full items-center justify-between p-4 active:opacity-75">
            <span className="flex items-center gap-2.5">
              <FileText size={20} color={colors.textSecondary} />
              <span style={{ color: colors.text, fontSize: 15, fontWeight: 500 }}>Terms &amp; Privacy</span>
            </span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Threshold alerts (port of AlertSettingsScreen.tsx) --

type MetricKey = "cpu" | "memory" | "temp" | "disk";
type AlertConfig = {
  enabled: boolean;
  cpu: number;
  memory: number;
  temp: number;
  disk: number;
  cooldownMinutes: number;
};

const METRICS: { key: MetricKey; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "cpu", label: "CPU load", unit: "%", min: 5, max: 100, step: 5 },
  { key: "memory", label: "Memory", unit: "%", min: 5, max: 100, step: 5 },
  { key: "temp", label: "Temperature", unit: "°C", min: 40, max: 100, step: 5 },
  { key: "disk", label: "Disk usage", unit: "%", min: 10, max: 100, step: 5 },
];

export function AlertSettingsScreen() {
  const { colors } = usePhone();
  const [cfg, setCfg] = useState<AlertConfig>({
    enabled: true,
    cpu: 90,
    memory: 90,
    temp: 85,
    disk: 95,
    cooldownMinutes: 15,
  });

  const apply = (patch: Partial<AlertConfig>) => setCfg((prev) => ({ ...prev, ...patch }));

  const bump = (row: (typeof METRICS)[number], delta: number) => {
    const cur = cfg[row.key];
    const next = cur === 0 && delta > 0 ? row.min : Math.max(0, Math.min(row.max, cur + delta * row.step));
    apply({ [row.key]: next < row.min ? 0 : next });
  };

  const bumpCooldown = (delta: number) =>
    apply({ cooldownMinutes: Math.max(1, Math.min(240, cfg.cooldownMinutes + delta)) });

  const section = { padding: 16, paddingTop: 12 };
  const sectionTitle = {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  };
  const group = {
    backgroundColor: colors.card,
    borderRadius: 14,
    border: `1px solid ${colors.border}`,
    overflow: "hidden" as const,
  };
  const row = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
  };
  const stepBtn = {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.surface,
  } as const;

  return (
    <div style={{ backgroundColor: colors.background, minHeight: "100%", paddingBottom: 32 }}>
      <div style={section}>
        <div style={group}>
          <div style={{ ...row, borderBottom: `1px solid ${colors.border}` }}>
            <span className="flex items-center gap-2.5">
              <Bell size={20} color={colors.textSecondary} />
              <span style={{ color: colors.text, fontSize: 15, fontWeight: 500 }}>Threshold alerts</span>
            </span>
            <Switch value={cfg.enabled} onChange={(v) => apply({ enabled: v })} />
          </div>
          <div style={{ padding: "10px 16px" }}>
            <span style={{ color: colors.textSecondary, fontSize: 13, lineHeight: "18px" }}>
              Pushes a notification to this phone when a threshold is crossed.
              Notifications repeat after they drop back and cross again.
            </span>
          </div>
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>Alert when</div>
        <div style={group}>
          {METRICS.map((row2) => {
            const value = cfg[row2.key];
            return (
              <div key={row2.key} style={{ ...row, borderTop: `1px solid ${colors.border}` }}>
                <span style={{ color: colors.text, fontSize: 15, fontWeight: 500 }}>{row2.label}</span>
                <span className="flex items-center gap-1">
                  <button
                    disabled={!cfg.enabled || value === 0}
                    onClick={() => bump(row2, -1)}
                    className="flex items-center justify-center active:opacity-70"
                    style={{ ...stepBtn, opacity: !cfg.enabled || value === 0 ? 0.4 : 1 }}
                  >
                    <Minus size={18} color={colors.text} />
                  </button>
                  <span className="min-w-[62px] text-center" style={{ color: colors.text, fontSize: 14, fontWeight: 600 }}>
                    {value === 0 ? "Off" : `${Math.round(value)}${row2.unit}`}
                  </span>
                  <button
                    disabled={!cfg.enabled}
                    onClick={() => bump(row2, +1)}
                    className="flex items-center justify-center active:opacity-70"
                    style={{ ...stepBtn, opacity: !cfg.enabled ? 0.4 : 1 }}
                  >
                    <Plus size={18} color={colors.text} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>Repeat protection</div>
        <div style={group}>
          <div style={row}>
            <span style={{ color: colors.text, fontSize: 15, fontWeight: 500 }}>
              Minimum time between alerts
            </span>
            <span className="flex items-center gap-1">
              <button onClick={() => bumpCooldown(-1)} className="flex items-center justify-center active:opacity-70" style={stepBtn}>
                <Minus size={18} color={colors.text} />
              </button>
              <span className="min-w-[62px] text-center" style={{ color: colors.text, fontSize: 14, fontWeight: 600 }}>
                {cfg.cooldownMinutes} min
              </span>
              <button onClick={() => bumpCooldown(+1)} className="flex items-center justify-center active:opacity-70" style={stepBtn}>
                <Plus size={18} color={colors.text} />
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = usePhone();
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative h-[26px] w-[46px] rounded-full transition-colors"
      style={{ backgroundColor: value ? colors.primary : colors.surface }}
    >
      <span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all"
        style={{ left: value ? 23 : 3 }}
      />
    </button>
  );
}

// -- Scan QR (port of ScanQRScreen.tsx, simplified camera mock) --

export function ScanQRScreen() {
  const { colors } = usePhone();
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: colors.background }}>
      <div className="flex-1 px-4 pb-4">
        <div
          className="relative flex-1 overflow-hidden rounded-2xl"
          style={{ backgroundColor: colors.cardAlt, border: `1px solid ${colors.border}` }}
        >
          {/* fake camera viewport */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #1a2028 0%, #10151b 100%)" }} />
          {/* viewfinder corners */}
          {[
            "left-10 top-16 border-l-2 border-t-2 rounded-tl-lg",
            "right-10 top-16 border-r-2 border-t-2 rounded-tr-lg",
            "left-10 bottom-16 border-l-2 border-b-2 rounded-bl-lg",
            "right-10 bottom-16 border-r-2 border-b-2 rounded-br-lg",
          ].map((cls) => (
            <span key={cls} className={`absolute h-10 w-10 border-[#8FB6FF] ${cls}`} />
          ))}
          {/* scan beam (uses the page's keyframes) */}
          <span className="scan-beam absolute left-6 right-6 h-0.5 rounded bg-[#8FB6FF]" />

          <div className="absolute bottom-5 left-0 right-0 text-center text-xs text-white/60">
            Point the camera at the code shown by the agent
          </div>
        </div>

        <div className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: colors.card }}>
          <div style={{ color: colors.textSecondary, fontSize: 12, lineHeight: "18px" }}>
            On the server run <span className="font-mono" style={{ color: colors.primary }}>`./mooni-backend -pair`</span>{" "}
            — the QR carries your server address and API key, so treat it like a password.
          </div>
        </div>
      </div>
    </div>
  );
}
