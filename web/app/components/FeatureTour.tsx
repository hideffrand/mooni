"use client";

import { useRef, useState } from "react";
import {
  Activity,
  BellRing,
  FolderOpen,
  Images,
  Power,
  QrCode,
} from "lucide-react";
import MooniPhone, { DemoTarget } from "./phone/MooniPhone";
import { QRScan } from "./Illustrations";
import Reveal from "./Reveal";

type Feature = {
  icon: typeof FolderOpen;
  title: string;
  text: string;
  demo: DemoTarget;
  illustration?: "qr";
};

const FEATURES: Feature[] = [
  {
    icon: FolderOpen,
    title: "File manager",
    text: "Grab a file without getting up. Browse, upload, rename, move, or delete — photos and videos get thumbnails, everything else gets a colored tag so you know what it is at a glance.",
    demo: "files",
  },
  {
    icon: Images,
    title: "Media library",
    text: "Your server's photos, in your pocket. A day-by-day timeline over a folder you choose, with pinch-to-zoom, albums, and upload straight from your camera roll.",
    demo: "media",
  },
  {
    icon: Activity,
    title: "System health",
    text: "Know before it's a problem. CPU, memory, disk, load, and temperature, read straight from the machine and refreshed while you're looking at it.",
    demo: "home",
  },
  {
    icon: BellRing,
    title: "Threshold alerts",
    text: "Set a limit once, then forget about it. Cross it, and your phone buzzes — a single notification with a cooldown, not a flood.",
    demo: "alerts",
  },
  {
    icon: Power,
    title: "Power control",
    text: "Reboot, shut down, or lock the screen from wherever you are. A confirm step and your fingerprint sit between you and a stray tap.",
    demo: "power",
  },
  {
    icon: QrCode,
    title: "QR pairing",
    text: "One scan, no typing. Point your camera at the code the agent shows you, and keep as many servers paired as you run.",
    illustration: "qr",
    demo: "qr",
  },
];

export default function FeatureTour({ children }: { children?: React.ReactNode }) {
  const [focus, setFocus] = useState<{ target: DemoTarget; nonce: number }>({
    target: "home",
    nonce: 0,
  });
  const phoneRef = useRef<HTMLDivElement>(null);

  const go = (target: DemoTarget) => {
    setFocus((prev) => ({ target, nonce: prev.nonce + 1 }));
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      phoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-12">
      {/* left: features + how-it-works (children) — also the sticky phone's
          travel room: it spans both sections */}
      <div className="min-w-0 order-last lg:order-none">
        <section id="features" className="py-24">
          <Reveal>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl text-[#E7EEFC]">
              Everything, without leaving your phone
            </h2>
            <p className="mt-3 max-w-md text-[#77879A]">
              One agent on your server, one app on your phone, nothing else
              in between. Click a feature — the phone follows along.
            </p>
          </Reveal>

          <div className="mt-8">
            {FEATURES.map((f) => (
              <Reveal key={f.title}>
                <button
                  onClick={() => go(f.demo)}
                  className="group flex w-full items-center gap-5 rounded-xl border-b border-[#1E2733] px-2 py-8 text-left transition-colors duration-200 last:border-none hover:bg-[#101620]"
                >
                  {f.illustration === "qr" ? (
                    <QRScan className="shrink-0 transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1E2733] text-[#8FB6FF] transition-all duration-300 group-hover:scale-110 group-hover:border-[#8FB6FF] group-hover:bg-[#8FB6FF] group-hover:text-[#0B0F14]">
                      <f.icon size={19} strokeWidth={2} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-lg text-[#E7EEFC]">
                      {f.title}
                    </h3>
                    <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#B9C4D1]">
                      {f.text}
                    </p>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </section>

        {children}
      </div>

      {/* right: the live phone. Sticky on the grid item itself (its containing
          block = the grid area above, spanning both sections). */}
      <Reveal className="order-first w-full self-start lg:order-none lg:sticky lg:top-10 lg:shrink-0">
        <div
          ref={phoneRef}
          className="flex scroll-mt-24 flex-col items-center gap-4 pt-6 lg:pt-24"
        >
          <MooniPhone focus={focus} />
          <div className="flex items-center gap-2 text-xs text-[#77879A]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8FB6FF] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#8FB6FF]" />
            </span>
            Interactive demo — the real app UI, mock data. Go ahead, tap around.
          </div>
        </div>
      </Reveal>
    </div>
  );
}
