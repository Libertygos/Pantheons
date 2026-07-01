/**
 * Asset manifest — identity → immutable PNG path (Decision 5: faces are finished PNGs the
 * client only DISPLAYS; there is no compositing). Real PNGs land via Git LFS with a filename
 * manifest (⟨INPUT⟩). Until then CardImage falls back to a labelled placeholder tile so the
 * UI is exercisable without art.
 */
import type { GodId } from '@pantheons/engine';

/** Base under which card PNGs live once pushed (public/ or CDN). */
export const ASSET_BASE = import.meta.env.VITE_ASSET_BASE ?? '/assets';

export function godCardSrc(id: GodId): string {
  return `${ASSET_BASE}/personnages/${id}.png`;
}
export function godMiniatureSrc(id: GodId): string {
  return `${ASSET_BASE}/miniatures/${id}.png`;
}
export function cardBackSrc(): string {
  return `${ASSET_BASE}/dos.png`;
}
/** Attribut/action/pouvoir card faces keyed by card id or effect key (⟨INPUT⟩ manifest). */
export function cardFaceSrc(key: string): string {
  return `${ASSET_BASE}/cartes/${key}.png`;
}
export function boardSrc(): string {
  return `${ASSET_BASE}/plateau.png`;
}
