"use client";

import { useEffect, useRef, useState } from "react";

type Metric = {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
};

const INITIAL: Metric[] = [
  { label: "CPU", value: 12, unit: "%", min: 6, max: 34 },
  { label: "Memory", value: 41, unit: "%", min: 30, max: 58 },
  { label: "Temp", value: 47, unit: "°C", min: 42, max: 55 },
];

function wander(value: number, min: number, max: number) {
  const step = (Math.random() - 0.5) * 6;
  return Math.min(max, Math.max(min, Math.round(value + step)));
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

const BAR_COLORS = ["var(--accent-2)", "var(--accent)", "var(--accent-3)"];

export default function StatsWidget() {
  const [metrics, setMetrics] = useState(INITIAL);
  const [uptime, setUptime] = useState(1_186_920); // arbitrary starting uptime
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion.current) return;

    const id = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) => ({ ...m, value: wander(m.value, m.min, m.max) }))
      );
      setUptime((u) => u + 2);
    }, 2000);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="group relative">
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,_var(--widget-glow),_transparent)] blur-2xl transition-opacity duration-500 group-hover:opacity-140"
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-transform duration-300 hover:-translate-y-1">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-2)] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent-2)]" />
            </span>
            <span className="text-sm text-[var(--text)]">home-server</span>
          </div>
          <span className="font-mono text-xs text-[var(--text-3)]">
            up {formatUptime(uptime)}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-4">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="rounded-lg p-1.5 transition-colors duration-200 hover:bg-[var(--bg)]"
            >
              <dt className="text-xs text-[var(--text-3)]">{m.label}</dt>
              <dd className="mt-1 font-mono text-2xl text-[var(--text)]">
                {m.value}
                <span className="text-sm text-[var(--text-3)]">{m.unit}</span>
              </dd>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full transition-[width] duration-[1800ms] ease-out"
                  style={{
                    width: `${Math.min(
                      100,
                      (m.value / m.max) * 100
                    )}%`,
                    backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
