"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const command =
    "curl -fsSL https://web-mooni.vercel.app/install.sh | bash";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = command;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3">
      <code className="flex-1 break-all font-mono text-[13px] leading-relaxed text-[var(--text)]">
        <span className="select-none text-[var(--accent-2)]">$ </span>
        {command}
      </code>
      <button
        onClick={copy}
        aria-label="Copy install command"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {copied ? (
          <Check size={14} className="text-[var(--accent)]" />
        ) : (
          <Copy size={14} />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}