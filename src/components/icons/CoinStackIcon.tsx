import type { SVGProps } from 'react';

/**
 * Stacked-coins glyph aligned with product reference (oval top + cylindrical stack / ridges).
 * Uses currentColor for stroke.
 */
export function CoinStackIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <g
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Top coin face */}
        <ellipse cx="7" cy="3.25" rx="4.35" ry="1.32" />
        {/* Side rails */}
        <path d="M2.65 3.55v5.35" />
        <path d="M11.35 3.55v5.35" />
        {/* Second & third coin tops (ridges) */}
        <path d="M2.65 6.2c0 0.72 1.95 1.3 4.35 1.3s4.35-0.58 4.35-1.3" />
        <path d="M2.65 8.85c0 0.72 1.95 1.3 4.35 1.3s4.35-0.58 4.35-1.3" />
      </g>
    </svg>
  );
}
