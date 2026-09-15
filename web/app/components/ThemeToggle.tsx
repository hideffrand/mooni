"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "mooni.web-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (localStorage.getItem(KEY) === "light") setTheme("light");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
