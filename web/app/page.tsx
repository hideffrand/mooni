import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { ChevronRight, Download } from "lucide-react";
import StatsWidget from "@/app/components/StatsWidget";
import FeatureTour from "@/app/components/FeatureTour";
import Reveal from "@/app/components/Reveal";
import InstallCommand from "@/app/components/InstallCommand";
import { ConstellationField, SignalLink } from "@/app/components/Illustrations";

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

const INSTALL_STEPS = [
  {
    title: "Run the command",
    text: "Paste the one-liner above into your server's terminal. It downloads the agent for your architecture and verifies the checksum.",
  },
  {
    title: "Answer a few prompts",
    text: "Pick the folder the app may manage, choose a port and a name. It generates the API key and, optionally, enables reboot/shutdown.",
  },
  {
    title: "Scan the QR",
    text: "The agent finishes by printing a QR code and pairing code. Open the app, scan it, and your server appears.",
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
              href="#install"
              className="rounded-sm transition-colors hover:text-[#E7EEFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8FB6FF]"
            >
              Install
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
              className="fade-up font-[family-name:var(--font-heading)] text-3xl leading-[1.1] tracking-tight text-[#E7EEFC] sm:text-4xl lg:text-5xl"
              style={{ animationDelay: "90ms" }}
            >
              Your server never sleeps.
              <br />
              Now you don&apos;t have to check on it either.
            </h1>

            <p
              className="fade-up mt-4 max-w-md text-base leading-relaxed text-[#B9C4D1]"
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

        <div className="mx-auto border-t border-[#1E2733]">
          <FeatureTour />
        </div>

        <section id="how-it-works" className="border-t border-[#1E2733]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="mx-auto max-w-xl text-center">
                <h2 className="font-[family-name:var(--font-heading)] text-3xl text-[#E7EEFC]">
                  Set up in three steps
                </h2>
                <p className="mt-3 text-[#77879A]">
                  No IPs, no exposed ports, no key you have to type in by hand.
                </p>
              </div>
            </Reveal>

            <ol className="mt-14 flex flex-col items-center md:flex-row md:items-stretch md:gap-3">
              {STEPS.map((s, i) => (
                <Reveal
                  key={s.title}
                  className="flex w-full flex-col items-center gap-6 md:flex-1 md:flex-row md:items-center md:gap-3"
                >
                  <li className="group flex w-full max-w-sm flex-1 flex-col items-center rounded-2xl border border-[#1E2733] bg-[#101620]/60 px-6 py-8 text-center transition-colors duration-200 hover:border-[#8FB6FF]/40">
                    <span className="relative flex h-14 w-14 items-center justify-center">
                      <span
                        aria-hidden
                        className="absolute inline-flex h-full w-full rounded-full bg-[#8FB6FF]/10 transition-transform duration-300 group-hover:scale-110"
                      />
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[#8FB6FF]/50 font-[family-name:var(--font-heading)] text-lg text-[#8FB6FF] transition-all duration-300 group-hover:border-[#8FB6FF] group-hover:bg-[#8FB6FF] group-hover:text-[#0B0F14]">
                        {i + 1}
                      </span>
                    </span>
                    <h3 className="mt-5 font-[family-name:var(--font-heading)] text-lg text-[#E7EEFC]">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#B9C4D1]">
                      {s.text}
                    </p>
                  </li>
                  {i < STEPS.length - 1 && (
                    <li aria-hidden className="flex shrink-0 items-center text-[#8FB6FF]">
                      <ChevronRight size={24} className="rotate-90 md:rotate-0" />
                    </li>
                  )}
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="install" className="border-t border-[#1E2733]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <div className="mx-auto max-w-xl text-center">
                <h2 className="font-[family-name:var(--font-heading)] text-3xl text-[#E7EEFC]">
                  Install the agent in one line
                </h2>
                <p className="mt-3 text-[#77879A]">
                  Run this on your Linux server. It downloads the agent, verifies
                  it, and starts the interactive setup for you.
                </p>
              </div>
            </Reveal>

            <Reveal className="mx-auto mt-10 max-w-2xl">
              <InstallCommand />
              <p className="mt-3 text-center text-sm text-[#77879A]">
                No Go, no compilation. Linux amd64 and arm64. Skip it with a
                command? It&apos;s in the{" "}
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8FB6FF] hover:underline"
                >
                  README
                </a>
                .
              </p>
            </Reveal>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {INSTALL_STEPS.map((s, i) => (
                <Reveal key={s.title}>
                  <div className="flex h-full flex-col rounded-2xl border border-[#1E2733] bg-[#101620]/60 p-6">
                    <span className="font-[family-name:var(--font-heading)] text-sm text-[#8FB6FF]">
                      {i + 1}
                    </span>
                    <h3 className="mt-3 font-[family-name:var(--font-heading)] text-lg text-[#E7EEFC]">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#B9C4D1]">
                      {s.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
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
