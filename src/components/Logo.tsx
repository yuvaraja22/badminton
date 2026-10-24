/** App mark: a shuttle mid-smash (volt speed streaks) on a court-green tile with faint court lines. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="120" fill="#11624b" />
      <path d="M0 150 H512 M0 362 H512 M256 0 V150 M256 362 V512" stroke="#f6f3ea" strokeOpacity="0.14" strokeWidth="12" fill="none" />
      <g transform="rotate(-38 256 256) translate(0 16)">
        <path d="M196 64 V20 M256 50 V-6 M316 64 V20" stroke="#d4f53c" strokeWidth="22" strokeLinecap="round" />
        <path d="M160 96 L352 96 L302 302 L210 302 Z" fill="#f6f3ea" />
        <path d="M206 102 L234 296 M256 102 L256 296 M306 102 L278 296" stroke="#11624b" strokeWidth="10" strokeLinecap="round" opacity="0.4" />
        <rect x="200" y="292" width="112" height="28" rx="10" fill="#d4f53c" />
        <path d="M208 320 H304 V330 A48 48 0 0 1 208 330 Z" fill="#f6f3ea" />
      </g>
    </svg>
  );
}

/** Just the shuttlecock, in the current text colour (spinners, empty states, decoration). */
export function Shuttle({ className }: { className?: string }) {
  return (
    <svg viewBox="150 86 212 300" className={className} aria-hidden>
      <path d="M160 96 L352 96 L302 302 L210 302 Z" fill="currentColor" opacity="0.9" />
      <path d="M206 102 L234 296 M256 102 L256 296 M306 102 L278 296" stroke="var(--bg)" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
      <rect x="200" y="292" width="112" height="28" rx="10" fill="var(--volt)" />
      <path d="M208 320 H304 V330 A48 48 0 0 1 208 330 Z" fill="currentColor" />
    </svg>
  );
}
