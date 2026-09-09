"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Roboto } from "next/font/google";
import { ChevronLeft, Home, List, Settings } from "lucide-react";
import {
  PhoneCtx,
  darkColors,
  lightColors,
  Route,
  DemoMode,
} from "./theme";
import HomeScreen from "./screens/Home";
import { FileBrowserScreen, FilePreviewScreen } from "./screens/Browse";
import { MediaScreen, MediaViewerScreen } from "./screens/Media";
import { SettingsScreen, AlertSettingsScreen, ScanQRScreen } from "./screens/Misc";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-roboto",
});

export type DemoTarget = "home" | "files" | "media" | "alerts" | "settings" | "qr" | "power";

function titleFor(route: Route): string {
  switch (route.s) {
    case "home":
      return "homelab";
    case "files":
      return route.path || "/ (root)";
    case "preview":
      return route.name;
    case "media": {
      const name = route.path.split("/").filter(Boolean).pop();
      return name ?? "Media";
    }
    case "settings":
      return "Settings";
    case "alerts":
      return "Threshold Alerts";
    case "qr":
      return "Scan QR";
    default:
      return "Mooni";
  }
}

function ScreenBody({ route }: { route: Route }) {
  switch (route.s) {
    case "home":
      return <HomeScreen power={route.power} />;
    case "files":
      return <FileBrowserScreen path={route.path} />;
    case "preview":
      return <FilePreviewScreen name={route.name} />;
    case "media":
      return <MediaScreen path={route.path} />;
    case "viewer":
      return null; // handled by the shell (full-screen, no header)
    case "settings":
      return <SettingsScreen />;
    case "alerts":
      return <AlertSettingsScreen />;
    case "qr":
      return <ScanQRScreen />;
  }
}

export default function MooniPhone({ focus }: { focus?: { target: DemoTarget; nonce: number } }) {
  const [mode, setMode] = useState<DemoMode>("dark");
  const colors = mode === "dark" ? darkColors : lightColors;

  const [stack, setStack] = useState<Route[]>([{ s: "home" }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const top = stack[stack.length - 1];
  const isViewer = top.s === "viewer";

  const push = (r: Route) => setStack((prev) => [...prev, r]);
  const pop = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const reset = (r: Route) => setStack([r]);

  // Feature-card sync: navigating from the landing page resets the stack.
  useEffect(() => {
    if (!focus || focus.nonce === 0) return;
    switch (focus.target) {
      case "power":
        setStack([{ s: "home", power: true }]);
        break;
      case "alerts":
        setStack([{ s: "alerts" }]);
        break;
      case "files":
        setStack([{ s: "files", path: "" }]);
        break;
      case "media":
        setStack([{ s: "media", path: "" }]);
        break;
      default:
        setStack([{ s: focus.target }]);
    }
  }, [focus?.target, focus?.nonce]);

  // Status-bar clock: rendered client-side only — a server-rendered Date()
  // would bake the build-time time into the static HTML and break hydration
  // (React error #418).
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Every navigation starts the new screen at the top — except the Power
  // feature target, where the point is the Power section (bottom of Home).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (top.s === "home" && top.power) {
      el.scrollTo({ top: el.scrollHeight });
    } else {
      el.scrollTo({ top: 0 });
    }
  }, [stack.length, top.s, (top as { path?: string }).path, (top as { power?: boolean }).power]);

  const ctx = useMemo(
    () => ({ colors, mode, setMode, stack, push, pop, reset }),
    [colors, mode, stack]
  );

  const showBack = stack.length > 1 && !isViewer;
  const rightActions: { key: string; node: React.ReactNode; onClick?: () => void; dim?: boolean }[] =
    top.s === "home"
      ? [
          { key: "settings", node: <Settings size={22} color={colors.primary} />, onClick: () => reset({ s: "settings" }) },
          { key: "devices", node: <List size={22} color={colors.primary} />, dim: true },
        ]
      : top.s === "files"
      ? [{ key: "home", node: <Home size={22} color={colors.primary} />, onClick: () => reset({ s: "home" }) }]
      : [];

  return (
    <div
      className={`${roboto.variable} relative select-none`}
      style={{ fontFamily: "var(--font-roboto), Roboto, system-ui, sans-serif" }}
    >
      <style>{`
        .mooni-no-scrollbar::-webkit-scrollbar { display: none; }
        .mooni-no-scrollbar { scrollbar-width: none; }
        @media (prefers-reduced-motion: no-preference) {
          .mooni-halo { animation: mooni-halo 1.4s ease-in-out infinite; }
          @keyframes mooni-halo {
            0%, 100% { transform: scale(1); opacity: 0.45; }
            50% { transform: scale(1.35); opacity: 0; }
          }
          .scan-beam {
            animation: mooni-scan 2.6s ease-in-out infinite;
          }
          @keyframes mooni-scan {
            0% { top: 12%; opacity: 0; }
            15% { opacity: 1; }
            85% { opacity: 1; }
            100% { top: 86%; opacity: 0; }
          }
        }
      `}</style>

      {/* casing */}
      <div
        className="rounded-[46px] p-[10px]"
        style={{
          background: "linear-gradient(160deg, #3a3f47 0%, #14171c 30%, #14171c 70%, #3a3f47 100%)",
          boxShadow:
            "0 24px 60px -12px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.06), inset 0 0 0 6px rgba(0,0,0,0.35)",
        }}
      >
        {/* side buttons */}
        <span aria-hidden className="absolute -left-[3px] top-[120px] h-16 w-[3px] rounded-l bg-[#2a2e35]" />
        <span aria-hidden className="absolute -right-[3px] top-[150px] h-20 w-[3px] rounded-r bg-[#2a2e35]" />

        {/* screen */}
        <div
          className="relative flex h-[640px] w-[310px] flex-col overflow-hidden rounded-[36px]"
          style={{ backgroundColor: colors.background }}
        >
          {/* status bar */}
          <div
            className="flex h-8 shrink-0 items-center justify-between px-5"
            style={{ backgroundColor: colors.cardAlt, color: colors.text }}
          >
            <span className="text-[11px] font-semibold">{clock}</span>
            <span className="flex items-center gap-1.5">
              {/* signal bars */}
              <span className="flex items-end gap-[2px]">
                {[4, 6, 8, 10].map((h) => (
                  <span key={h} className="w-[3px] rounded-sm" style={{ height: h, backgroundColor: colors.text }} />
                ))}
              </span>
              <svg width="15" height="11" viewBox="0 0 16 12" fill="none">
                <path d="M8 9.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z" fill={colors.text} />
                <path d="M3.5 7.2 5 8.8a4.4 4.4 0 0 1 6 0l1.5-1.6a6.6 6.6 0 0 0-9 0Z" fill={colors.text} />
                <path d="M.8 4.4 2.3 6a8.7 8.7 0 0 1 11.4 0l1.5-1.6a10.9 10.9 0 0 0-14.4 0Z" fill={colors.text} />
              </svg>
              {/* battery */}
              <span className="flex items-center gap-[2px]">
                <span className="relative inline-block h-[10px] w-[18px] rounded-[3px] border" style={{ borderColor: colors.text }}>
                  <span className="absolute left-[1.5px] top-[1.5px] h-[5px] rounded-[1px]" style={{ width: 11, backgroundColor: colors.text }} />
                </span>
                <span className="h-[4px] w-[2px] rounded-r" style={{ backgroundColor: colors.text }} />
              </span>
            </span>
          </div>

          {/* punch-hole camera */}
          <span
            aria-hidden
            className="absolute left-1/2 top-[14px] z-20 h-[14px] w-[14px] -translate-x-1/2 rounded-full"
            style={{ backgroundColor: "#0a0c0f", boxShadow: "inset 0 0 2px rgba(255,255,255,0.25)" }}
          />

          <PhoneCtx.Provider value={ctx}>
            {isViewer ? (
              <MediaViewerScreen path={(top as { path: string }).path} onDismiss={pop} />
            ) : (
              <>
                {/* app bar */}
                <div
                  className="flex h-[52px] shrink-0 items-center px-1.5"
                  style={{ backgroundColor: colors.cardAlt, borderBottom: `1px solid ${colors.border}` }}
                >
                  {showBack ? (
                    <button onClick={pop} className="flex h-10 w-10 items-center justify-center active:opacity-60">
                      <ChevronLeft size={24} color={colors.primary} />
                    </button>
                  ) : (
                    <span className="h-10 w-10" />
                  )}
                  <span
                    className="min-w-0 flex-1 truncate pl-1"
                    style={{ color: colors.text, fontSize: 17, fontWeight: 600 }}
                  >
                    {titleFor(top)}
                  </span>
                  <div className="flex items-center gap-4 pr-2">
                    {rightActions.map((h) =>
                      h.onClick ? (
                        <button key={h.key} onClick={h.onClick} className="active:opacity-60">
                          {h.node}
                        </button>
                      ) : (
                        <span key={h.key} className="opacity-50">
                          {h.node}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* scrollable screen body */}
                <div
                  ref={scrollRef}
                  className={`relative min-h-0 flex-1 overflow-y-auto mooni-no-scrollbar ${
                    top.s === "preview" || top.s === "qr" ? "flex" : ""
                  }`}
                  style={{ overscrollBehavior: "contain" }}
                >
                  <ScreenBody route={top} />
                </div>
              </>
            )}
          </PhoneCtx.Provider>

          {/* home indicator / gesture bar */}
          <div className="absolute bottom-1.5 left-1/2 z-20 h-1 w-28 -translate-x-1/2 rounded-full bg-white/25" />
        </div>
      </div>
    </div>
  );
}
