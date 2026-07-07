/**
 * Displays an immutable card face exactly as shipped (Decision 5 — no compositing, no text
 * overlay). While the LFS budget keeps the .webp files as pointer text, <img> fails and we
 * fall back to a typographic tile in the pense-bête's own language (mono caps on navy,
 * givre type strip, optional legend band). The tile is chrome, never card copy.
 */
import { useState } from 'react';

export function CardImage({
  src,
  alt,
  typeLabel,
  bodyLabel,
  bandColor,
  className,
}: {
  src: string;
  alt: string;
  /** Fallback tile header, e.g. "Attribut" / "Pouvoir". */
  typeLabel: string;
  /** Fallback tile body, e.g. "Yeux verts" / "Sabotage". */
  bodyLabel: string;
  /** Optional legend-band color strip at the tile's foot (eye-colour language). */
  bandColor?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <div className={`carte-tuile ${className ?? ''}`} role="img" aria-label={alt}>
        <span className="carte-tuile__type">{typeLabel}</span>
        <span className="carte-tuile__corps">{bodyLabel}</span>
        {bandColor && <span className="carte-tuile__bande" style={{ background: bandColor }} />}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`carte ${className ?? ''}`}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
