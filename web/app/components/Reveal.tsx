import type { ReactNode } from "react";

// Pure CSS reveal — the animation lives in globals.css and is gated behind
// `@supports (animation-timeline: view())` + `prefers-reduced-motion`.
// Content is visible by default in every browser, JS or not.
export default function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`reveal ${className}`}>{children}</div>;
}
