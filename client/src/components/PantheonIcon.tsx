/**
 * The four pantheon glyphs of the pense-bête footer — thin white line icons in a circle
 * (ॐ / ionic column / eye of Horus / triskelion), redrawn as inline SVG so they scale with
 * the UI and stay pixel-crisp. Stroke inherits currentColor.
 */
import type { Pantheon } from '@pantheons/engine';

const GLYPHS: Record<Pantheon, React.ReactNode> = {
  hindou: (
    <text
      x="16"
      y="21.5"
      textAnchor="middle"
      fontSize="15"
      fill="currentColor"
      stroke="none"
      fontFamily="serif"
    >
      {'ॐ'}
    </text>
  ),
  grec: (
    <g>
      <path d="M9 22.5h14M10.5 20h11" />
      <path d="M12.5 20v-8M16 20v-8M19.5 20v-8" />
      <path d="M9 12c1.8 0 2.6-2.5 1-2.5-1.2 0-.6 2 2 2h8c2.6 0 3.2-2 2-2-1.6 0-.8 2.5 1 2.5" />
    </g>
  ),
  egyptien: (
    <g>
      <path d="M7 15.5c3-3.4 6-5 9-5s6 1.6 9 5c-3 3.4-6 5-9 5s-6-1.6-9-5Z" />
      <circle cx="16" cy="15.5" r="2.4" />
      <path d="M20.5 20.5 23 23M13 20.4c-.4 2-1.8 3-3.6 2.6" />
    </g>
  ),
  nordique: (
    <g>
      <path d="M16 16c2.5-1 4-3 3.4-5.4M16 16c-2.6.4-4.5 1.9-5 4.3M16 16c.2-2.7-.8-4.9-3.2-5.8" />
      <circle cx="19.8" cy="9.8" r="1.6" />
      <circle cx="10.4" cy="20.9" r="1.6" />
      <circle cx="12.3" cy="9.6" r="1.6" />
    </g>
  ),
};

export function PantheonIcon({ pantheon, size = 32 }: { pantheon: Pantheon; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14.5" />
      {GLYPHS[pantheon]}
    </svg>
  );
}
