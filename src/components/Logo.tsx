export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#ffffff" fillOpacity="0.12" />
      <g transform="rotate(-38 256 256)">
        <path d="M160 96 L352 96 L302 302 L210 302 Z" fill="#ffffff" />
        <path
          d="M200 100 L230 298 M256 100 L256 298 M312 100 L282 298"
          stroke="#1f2a44"
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.3"
        />
        <rect x="202" y="294" width="108" height="26" rx="9" fill="#e0574f" />
        <path d="M208 320 H304 V328 A48 48 0 0 1 208 328 Z" fill="#f4efe6" />
      </g>
    </svg>
  );
}
