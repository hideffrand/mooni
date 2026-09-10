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
    <div className="flex items-center gap-2 rounded-xl border border-[#1E2733] bg-[#101620]/80 px-4 py-3">
      <code className="flex-1 break-all font-mono text-[13px] leading-relaxed text-[#E7EEFC]">
        <span className="select-none text-[#8FB6FF]">$ </span>
        {command}
      </code>
      <button
        onClick={copy}
        aria-label="Copy install command"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#1E2733] px-3 py-1.5 text-xs text-[#B9C4D1] transition-colors hover:border-[#8FB6FF] hover:text-[#E7EEFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FB6FF]"
      >
        {copied ? (
          <Check size={14} className="text-[#7FE3A1]" />
        ) : (
          <Copy size={14} />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}