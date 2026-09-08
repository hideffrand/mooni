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
        className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,_rgba(143,182,255,0.16),_transparent)] blur-2xl transition-opacity duration-500 group-hover:opacity-140"
      />

      <div className="rounded-2xl border border-[#1E2733] bg-[#121821] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-transform duration-300 hover:-translate-y-1">
        <div className="flex items-center justify-between border-b border-[#1E2733] pb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8FB6FF] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#8FB6FF]" />
            </span>
            <span className="text-sm text-[#E7EEFC]">home-server</span>
          </div>
          <span className="font-mono text-xs text-[#77879A]">
            up {formatUptime(uptime)}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg p-1.5 transition-colors duration-200 hover:bg-[#0B0F14]"
            >
              <dt className="text-xs text-[#77879A]">{m.label}</dt>
              <dd className="mt-1 font-mono text-2xl text-[#E7EEFC]">
                {m.value}
                <span className="text-sm text-[#77879A]">{m.unit}</span>
              </dd>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#1E2733]">
                <div
                  className="h-full rounded-full bg-[#8FB6FF] transition-[width] duration-[1800ms] ease-out"
                  style={{
                    width: `${Math.min(
                      100,
                      (m.value / m.max) * 100
                    )}%`,
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
