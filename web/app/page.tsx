import Image from "next/image";
import type { Metadata } from "next";
import {
  Activity,
  BellRing,
  Download,
  FolderOpen,
  Images,
  Power,
  QrCode,
} from "lucide-react";
import styles from "./page.module.css";

const GITHUB_URL = "https://github.com/hideffrand/mooni";
const APK_URL = "/mooni.apk";

export const metadata: Metadata = {
  title: "Mooni — control your Linux server from your phone",
  description:
    "Self-hosted Android companion app for your Linux server. File manager, media library, system health, alerts, and power control — all over Tailscale.",
  openGraph: {
    title: "Mooni — control your Linux server from your phone",
    description:
      "Self-hosted Android companion app for your Linux server, over your private Tailscale network. No cloud in the middle.",
    images: ["/mooni-hero.jpg"],
  },
};

const FEATURES = [
  {
    icon: FolderOpen,
    title: "File Manager",
    text: "Browse folders, upload, download, rename, copy, move and delete. Images and videos get thumbnails; documents get colored type badges (PDF, XLS, ZIP...) at a glance.",
  },
  {
    icon: Images,
    title: "Media Library",
    text: "A Photos-style timeline grouped by date over a dedicated server folder. Full-screen swipeable viewer with pinch-zoom, drag-to-dismiss, albums, multi-select and gallery upload.",
  },
  {
    icon: Activity,
    title: "System Health",
    text: "Live dashboard of CPU, memory, disk, load average, uptime and temperature - auto-refreshing straight from /proc, with color-coded meters.",
  },
  {
    icon: BellRing,
    title: "Threshold Alerts",
    text: "Set CPU/RAM/disk/temperature limits per device and get a push notification on your phone the moment one is crossed. Edge-triggered, with cooldown.",
  },
  {
    icon: Power,
    title: "Power Control",
    text: "Reboot or shut down your machine from the app - guarded by your phone's fingerprint/PIN plus a single-use confirm token, so a stray tap or leaked key can't do damage.",
  },
  {
    icon: QrCode,
    title: "QR Pairing & Multi-Device",
    text: "Scan one QR code to connect - no IPs or API keys to type. Keep several servers paired and switch between them from the dashboard.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Install the agent",
    text: "Run the Mooni agent binary on your Linux machine (see the repo README for setup).",
  },
  {
    step: "02",
    title: "Join Tailscale",
    text: "Connect both your server and phone to the same Tailscale network. No ports to open, nothing exposed to the public internet.",
  },
  {
    step: "03",
    title: "Scan & pair",
    text: "Open the app, scan the QR code shown by the agent, and you're connected.",
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
    <>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.brand}>
            mooni<span className={styles.brandDot}>.</span>
          </span>
          <nav className={styles.navLinks} aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#download">Download</a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.navGithub}
              aria-label="View Mooni source on GitHub"
            >
              <GitHubIcon /> GitHub
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero} id="download">
          <div>
            <span className={styles.heroTag}>Open source · Self-hosted · Tailscale</span>
            <h1 className={styles.heroTitle}>
              Control your Linux server from your phone.
            </h1>
            <p className={styles.heroText}>
              Mooni is an Android companion app for your own machine - browse
              files, stream media, watch system health and manage power, all
              over your private Tailscale network. No ports opened, no cloud in
              the middle.
            </p>
            <div className={styles.heroActions}>
              {/* Drop the release binary at web/public/mooni.apk */}
              <a className={styles.btnPrimary} href={APK_URL} download>
                <Download size={17} strokeWidth={2.4} /> Download APK
              </a>
              <a
                className={styles.btnGhost}
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHubIcon /> View on GitHub
              </a>
            </div>
            <p className={styles.heroNote}>
              Requires the Mooni agent running on your Linux machine (see the
              repo README) and Tailscale on both devices.
            </p>
          </div>
          <div className={styles.heroShotWrap}>
            <Image
              src="/mooni-hero.jpg"
              alt="Mooni dashboard showing file manager, media library and system health screens"
              width={1200}
              height={1200}
              priority
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        </section>

        <section className={styles.features} id="features">
          <h2 className={styles.sectionTitle}>Everything in one app</h2>
          <p className={styles.sectionSub}>
            One agent on your server, one app on your phone.
          </p>
          <div className={styles.grid}>
            {FEATURES.map((f) => (
              <article className={styles.card} key={f.title}>
                <div className={styles.cardIcon}>
                  <f.icon size={20} strokeWidth={2.2} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.features} id="how-it-works">
          <h2 className={styles.sectionTitle}>Set up in three steps</h2>
          <p className={styles.sectionSub}>
            No IPs, no exposed ports, no manual key entry.
          </p>
          <div className={styles.grid}>
            {STEPS.map((s) => (
              <article className={styles.card} key={s.step}>
                <div className={styles.cardIcon}>{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>
            mooni<span style={{ color: "var(--primary)" }}>.</span> - your
            server, your pocket.
          </span>
          <span>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{" "}
            · © {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </>
  );
}
