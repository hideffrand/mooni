// Presentational illustrations. No client hooks — animation is pure CSS,
// gated behind `@media (prefers-reduced-motion: no-preference)` in the
// <style> block declared once in app/page.tsx.

const DOTS = [
  [40, 60], [140, 30], [230, 90], [320, 40], [400, 110],
  [70, 180], [180, 220], [260, 170], [360, 230], [460, 150],
  [520, 60], [610, 120], [690, 50], [740, 190], [610, 260],
];

const LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [5, 6],
  [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
  [11, 12], [12, 13], [4, 9], [1, 5],
];

export function ConstellationField({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 780 300"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-70 ${className}`}
    >
      {LINKS.map(([a, b], i) => (
        <line
          key={i}
          x1={DOTS[a][0]}
          y1={DOTS[a][1]}
          x2={DOTS[b][0]}
          y2={DOTS[b][1]}
          stroke="#1E2733"
          strokeWidth="1"
        />
      ))}
      {DOTS.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 2.2 : 1.4}
          fill="#8FB6FF"
          className="twinkle"
          style={{ animationDelay: `${(i * 340) % 3400}ms` }}
        />
      ))}
    </svg>
  );
}

export function SignalLink({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 90"
      className={`w-full max-w-[280px] ${className}`}
    >
      {/* server */}
      <g stroke="#77879A" strokeWidth="1.4" fill="none">
        <rect x="14" y="24" width="34" height="42" rx="3" />
        <line x1="14" y1="37" x2="48" y2="37" />
        <line x1="14" y1="50" x2="48" y2="50" />
      </g>
      <circle cx="21" cy="30.5" r="1.6" fill="#8FB6FF" className="twinkle" />
      <circle cx="21" cy="43.5" r="1.6" fill="#8FB6FF" className="twinkle" style={{ animationDelay: "600ms" }} />

      {/* signal path */}
      <line
        x1="52"
        y1="45"
        x2="268"
        y2="45"
        stroke="#8FB6FF"
        strokeWidth="1.4"
        strokeDasharray="5 6"
        strokeLinecap="round"
        className="dash-move"
      />

      {/* phone */}
      <g stroke="#77879A" strokeWidth="1.4" fill="none">
        <rect x="272" y="18" width="30" height="54" rx="5" />
        <line x1="283" y1="65" x2="291" y2="65" />
      </g>
      <circle cx="287" cy="45" r="1.6" fill="#FFB067" className="twinkle" style={{ animationDelay: "1.1s" }} />
    </svg>
  );
}

const QR_PATTERN = [
  1, 0, 1, 1, 0, 1,
  1, 1, 0, 0, 1, 0,
  0, 1, 1, 0, 1, 1,
  1, 0, 0, 1, 0, 1,
  0, 1, 1, 0, 1, 0,
  1, 0, 1, 1, 0, 1,
];

export function QRScan({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative grid h-11 w-11 grid-cols-6 grid-rows-6 gap-[2px] overflow-hidden rounded-md border border-[#1E2733] bg-[#0B0F14] p-1.5 ${className}`}
    >
      {QR_PATTERN.map((on, i) => (
        <span
          key={i}
          className={`rounded-[1px] ${on ? "bg-[#77879A]" : "bg-transparent"}`}
        />
      ))}
      <span
        aria-hidden
        className="scan-beam pointer-events-none absolute inset-x-0 h-3 bg-gradient-to-b from-transparent via-[#8FB6FF]/70 to-transparent"
      />
    </div>
  );
}
