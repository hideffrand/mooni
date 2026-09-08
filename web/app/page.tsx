import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import {
  Activity,
  BellRing,
  Download,
  FolderOpen,
  Images,
  Power,
  QrCode,
} from "lucide-react";
import StatsWidget from "@/app/components/StatsWidget";
import Reveal from "@/app/components/Reveal";
import { ConstellationField, SignalLink, QRScan } from "@/app/components/Illustrations";

const GITHUB_URL = "https://github.com/hideffrand/mooni";
const APK_URL = "/mooni.apk";

const heading = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Mooni — your server, in your pocket",
  description:
    "A self-hosted Android companion for the Linux machine you already run. Files, media, live health, and power control, over your own Tailscale network.",
  openGraph: {
    title: "Mooni — your server, in your pocket",
    description:
      "A self-hosted Android companion for the Linux machine you already run, over your own Tailscale network. No cloud in the middle.",
    images: ["/mooni-hero.jpg"],
  },
};

type Feature = {
  icon: typeof FolderOpen;
  title: string;
  text: string;
  illustration?: "qr";
};

const FEATURES: Feature[] = [
  {
    icon: FolderOpen,
    title: "File manager",
    text: "Grab a file without getting up. Browse, upload, rename, move, or delete — photos and videos get thumbnails, everything else gets a colored tag so you know what it is at a glance.",
  },
  {
    icon: Images,
    title: "Media library",
    text: "Your server's photos, in your pocket. A day-by-day timeline over a folder you choose, with pinch-to-zoom, albums, and upload straight from your camera roll.",
  },
  {
    icon: Activity,
    title: "System health",
    text: "Know before it's a problem. CPU, memory, disk, load, and temperature, read straight from the machine and refreshed while you're looking at it.",
  },
  {
    icon: BellRing,
    title: "Threshold alerts",
    text: "Set a limit once, then forget about it. Cross it, and your phone buzzes — a single notification with a cooldown, not a flood.",
  },
  {
    icon: Power,
    title: "Power control",
    text: "Reboot, shut down, or lock the screen from wherever you are. A confirm step and your fingerprint sit between you and a stray tap.",
  },
  {
    icon: QrCode,
    title: "QR pairing",
    text: "One scan, no typing. Point your camera at the code the agent shows you, and keep as many servers paired as you run.",
    illustration: "qr",
  },
];

const STEPS = [
  {
    title: "Install the agent",
    text: "One binary, one line to run on your Linux machine. Full setup is in the repo README.",
  },
  {
    title: "Join Tailscale",
    text: "Add your phone and your server to the same private network. Nothing opens to the public internet.",
  },
  {
    title: "Scan and pair",
    text: "Point your camera at the QR code the agent shows you. That's it — you're connected.",
  },
];

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className={`${heading.variable} bg-[#0B0F14] font-sans antialiased`}>
      <style>{`
        .twinkle { opacity: 0.9; }
        .dash-move { }
        .scan-beam { top: -20%; opacity: 0; }
        .fade-up { opacity: 1; transform: none; }

        @media (prefers-reduced-motion: no-preference) {
          .twinkle {
            animation: twinkle 3.4s ease-in-out infinite;
          }
          .dash-move {
            animation: dash-move 1.6s linear infinite;
          }
          .scan-beam {
            animation: scan 2.6s ease-in-out infinite;
            opacity: 1;
          }
          .fade-up {
            animation: fade-up 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
          }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }
        @keyframes dash-move {
          to { stroke-dashoffset: -22; }
        }
        @keyframes scan {
          0% { top: -20%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="border-b border-[#1E2733]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-[family-name:var(--font-heading)] text-lg text-[#E7EEFC]">
            mooni<span className="text-[#8FB6FF]">.</span>
          </span>
          <nav
            className="flex items-center gap-8 text-sm text-[#B9C4D1]"
            aria-label="Primary"
          >
            <a
              href="#features"
              className="rounded-sm transition-colors hover:text-[#E7EEFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8FB6FF]"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="rounded-sm transition-colors hover:text-[#E7EEFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8FB6FF]"
            >
              How it works
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-sm transition-colors hover:text-[#E7EEFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8FB6FF]"
            >
              <GitHubIcon /> GitHub
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl items-center gap-16 overflow-hidden px-6 pb-24 pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:pb-32 lg:pt-28">
          <ConstellationField className="[mask-image:radial-gradient(ellipse_60%_80%_at_30%_40%,black,transparent)]" />

          <div className="relative z-10">
            <div
              className="fade-up mb-6 flex items-center gap-2 text-sm text-[#8FB6FF]"
              style={{ animationDelay: "0ms" }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8FB6FF] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#8FB6FF]" />
              </span>
              Reaches your server only over Tailscale
            </div>

            <h1
              className="fade-up font-[family-name:var(--font-heading)] text-4xl leading-[1.1] tracking-tight text-[#E7EEFC] sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "90ms" }}
            >
              Your server never sleeps.
              <br />
              Now you don&apos;t have to check on it either.
            </h1>

            <p
              className="fade-up mt-6 max-w-md text-lg leading-relaxed text-[#B9C4D1]"
              style={{ animationDelay: "180ms" }}
            >
              Mooni is a companion app for the Linux machine you already run —
              files, media, live health, and power control, all from your
              phone. Nothing opens to the public internet.
            </p>

            <div
              className="fade-up mt-9 flex flex-wrap items-center gap-4"
              style={{ animationDelay: "270ms" }}
            >
              <a
                href={APK_URL}
                download
                className="flex items-center gap-2 rounded-full bg-[#FFB067] px-6 py-3 text-sm font-medium text-[#1A1204] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FFC08A] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8FB6FF]"
              >
                <Download size={16} strokeWidth={2.4} />
                Download for Android
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-[#1E2733] px-6 py-3 text-sm text-[#B9C4D1] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#8FB6FF] hover:text-[#E7EEFC] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8FB6FF]"
              >
                <GitHubIcon /> View the code
              </a>
            </div>

            <p
              className="fade-up mt-5 text-sm text-[#77879A]"
              style={{ animationDelay: "340ms" }}
            >
              Needs the Mooni agent running on your server and Tailscale on
              both ends. Setup details are in the README.
            </p>
          </div>

          <div
            className="fade-up relative z-10 flex flex-col items-center gap-5"
            style={{ animationDelay: "220ms" }}
          >
            <StatsWidget />
            <div className="flex flex-col items-center gap-2 opacity-80">
              <SignalLink />
              <span className="text-xs text-[#77879A]">
                your machine ⇄ your pocket, over Tailscale
              </span>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-3xl border-t border-[#1E2733] px-6 py-24"
        >
          <Reveal>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl text-[#E7EEFC]">
              Everything, without leaving your phone
            </h2>
            <p className="mt-3 max-w-md text-[#77879A]">
              One agent on your server, one app on your phone, nothing else
              in between.
            </p>
          </Reveal>

          <div className="mt-8">
            {FEATURES.map((f) => (
              <Reveal key={f.title}>
                <div className="group flex items-center gap-5 rounded-xl border-b border-[#1E2733] px-2 py-8 transition-colors duration-200 last:border-none hover:bg-[#101620]">
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
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto max-w-3xl px-6 py-24"
        >
          <Reveal>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl text-[#E7EEFC]">
              Set up in three steps
            </h2>
            <p className="mt-3 max-w-md text-[#77879A]">
              No IPs, no exposed ports, no key you have to type in by hand.
            </p>
          </Reveal>

          <ol className="mt-10">
            {STEPS.map((s, i) => (
              <Reveal key={s.title}>
                <li className="group relative flex gap-6 pb-10 last:pb-0">
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-[#1E2733]"
                    />
                  )}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1E2733] font-[family-name:var(--font-heading)] text-sm text-[#8FB6FF] transition-all duration-300 group-hover:scale-110 group-hover:border-[#8FB6FF] group-hover:bg-[#8FB6FF] group-hover:text-[#0B0F14]">
                    {i + 1}
                  </span>
                  <div className="pt-0.5">
                    <h3 className="font-[family-name:var(--font-heading)] text-lg text-[#E7EEFC]">
                      {s.title}
                    </h3>
                    <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-[#B9C4D1]">
                      {s.text}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-[#1E2733]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-[#77879A] sm:flex-row sm:items-center">
          <span>
            mooni<span className="text-[#8FB6FF]">.</span> — your server, in
            your pocket.
          </span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-colors hover:text-[#E7EEFC]"
          >
            <GitHubIcon /> GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
