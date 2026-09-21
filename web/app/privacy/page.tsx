import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import ThemeToggle from "@/app/components/ThemeToggle";
import Link from "next/link";

const heading = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Mooni — Privacy Policy & Terms of Service",
  description:
    "Privacy policy and terms of service for the Mooni Android app. No analytics, no tracking, no cloud.",
};

const TERMS = [
  {
    title: "What Mooni is",
    body: "Mooni is a companion app for the self-hosted Mooni server. It lets you browse, preview, and transfer files to and from a server that you run yourself, and optionally trigger a reboot or shutdown of that machine.",
  },
  {
    title: "Acceptance of terms",
    body: "By installing and using Mooni you agree to these terms. If you do not agree, uninstall the app. The app is provided free of charge, without any account, and can be removed at any time.",
  },
  {
    title: "What Mooni does not do",
    body: "Mooni does not collect, store, or transmit any data to us. It contains no advertising, no analytics, and no third-party tracking SDKs. There is no account system and no cloud backend operated by us.",
  },
  {
    title: "Your data stays on your hardware",
    body: "Files you browse or transfer are stored on your own server. The app connects to that server over your local network or a Tailscale VPN, using an API key you create during pairing. Access is only possible with that key, and only while the app has it stored on your device.",
  },
  {
    title: "Security and your responsibilities",
    body: "The API key grants access to everything under the server's configured file root and includes the power-control feature. Treat it like a password. You are responsible for keeping your server, network, and Tailscale configuration secure, and for choosing the file root you expose. Depending on your network, the app may communicate over plain HTTP, so prefer pairing over an encrypted connection such as Tailscale.",
  },
  {
    title: "Removal of your data",
    body: "To revoke app access, remove the device from the app's device list or uninstall Mooni -- this deletes the stored API key. Files on your server are not touched and are yours to manage. Power control can also be disabled by removing the passwordless-sudo rule on the server.",
  },
  {
    title: "No warranty and limitation of liability",
    body: "Mooni is provided \"as is\", without warranties of any kind. To the maximum extent permitted by law, the developers are not liable for any damages arising from its use, including file loss or hardware control. You use the power-control feature at your own risk and should test it on non-essential hardware first.",
  },
  {
    title: "Changes and open source",
    body: "These terms may be updated as the app evolves; continued use after a change constitutes acceptance. Mooni is open source, and its source code is available for review.",
  },
];

const PRIVACY = [
  {
    title: "Information we collect",
    body: "We do not collect any personal information. Mooni has no analytics, no crash reporting service, and no remote servers of our own. It does not even phone home to verify its own version.",
  },
  {
    title: "Information stored on your device",
    body: "The app stores, locally on your device: the list of paired servers (name and address) in AsyncStorage, and each server's API key in the device's encrypted SecureStore. Nothing is transmitted except direct requests to the servers you paired. You can delete everything by removing devices and uninstalling the app.",
  },
  {
    title: "Information sent to your server",
    body: "Requests to your own server carry the API key you generated during pairing and file paths you navigate or transfer. This traffic stays between your phone and your server; we never see it.",
  },
  {
    title: "Camera and biometrics",
    body: "Camera access is used only to scan the pairing QR code produced by the server. Nothing is recorded or uploaded. Device lock (fingerprint or PIN) is used only on-device to confirm power-control actions; it is never transmitted.",
  },
  {
    title: "Permissions requested",
    body: "Mooni requests only the Android permissions it needs: camera (pairing QR scan) and biometric (power control confirmation). No storage, microphone, or overlay permissions are used.",
  },
  {
    title: "Children's privacy",
    body: "Mooni is not directed at children under 13, and since it collects no personal information, no such data is knowingly gathered from anyone.",
  },
  {
    title: "Contact",
    body: "For questions about this policy or the app, contact us via GitHub Issues.",
  },
];

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
      <h3 className="text-[15px] font-bold text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">
        {body}
      </p>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className={`${heading.variable} bg-[var(--bg)] font-sans antialiased`}>
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--text)] transition-colors hover:text-[var(--accent)]"
          >
            mooni
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--text)] sm:text-3xl">
          Privacy Policy &amp; Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[var(--text-3)]">
          Last updated September 2026
        </p>

        <p className="mt-6 text-sm leading-relaxed text-[var(--text-2)]">
          These terms and this privacy policy cover the Mooni Android app. They
          are written in plain language; they describe what the app does with
          your data and what you can expect from it.
        </p>

        <h2 className="mb-4 mt-10 text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
          Terms of Service
        </h2>
        <div className="space-y-3">
          {TERMS.map((block) => (
            <Card key={block.title} {...block} />
          ))}
        </div>

        <h2 className="mb-4 mt-10 text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
          Privacy Policy
        </h2>
        <div className="space-y-3">
          {PRIVACY.map((block) => (
            <Card key={block.title} {...block} />
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-[var(--text-3)]">
          Mooni is open source.{" "}
          <a
            href="https://github.com/hideffrand/mooni"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-[var(--accent)]"
          >
            View source on GitHub
          </a>
          .
        </p>
      </main>
    </div>
  );
}
