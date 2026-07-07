/**
 * Canonical god data (T-06). SOURCE OF TRUTH for the 12 gods × {genre, couleurYeux, pantheon}.
 *
 * TRANSCRIBED from the pense-bête image (conversion_cartes/Pense_Bête.webp) per
 * docs/card-catalog.md §1 — the band colour behind each portrait is the eye-colour legend
 * (matches the drawn iris on 11/12 legible portraits). One residual caveat: Ganesh's drawn
 * iris is stylised (gold/red make-up) and illegible at pense-bête resolution; `bleus` is
 * taken from his turquoise band and must be re-confirmed against
 * card_personnages_ganesh.webp once the LFS budget is restored.
 */
import type { God, GodId } from '../types.js';

export const TRANSCRIBED = true as const;

export const GODS: Record<GodId, God> = {
  // Hindou
  brahma:    { id: 'brahma',    label: 'Brahma',    pantheon: 'hindou',   genre: 'masculin', couleurYeux: 'rouges' },
  ganesh:    { id: 'ganesh',    label: 'Ganesh',    pantheon: 'hindou',   genre: 'masculin', couleurYeux: 'bleus' },
  sarasvati: { id: 'sarasvati', label: 'Sarasvati', pantheon: 'hindou',   genre: 'feminin',  couleurYeux: 'verts' },
  // Grec
  zeus:      { id: 'zeus',      label: 'Zeus',      pantheon: 'grec',     genre: 'masculin', couleurYeux: 'bleus' },
  athena:    { id: 'athena',    label: 'Athena',    pantheon: 'grec',     genre: 'feminin',  couleurYeux: 'rouges' },
  artemis:   { id: 'artemis',   label: 'Artemis',   pantheon: 'grec',     genre: 'feminin',  couleurYeux: 'bleus' },
  // Égyptien
  re:        { id: 're',        label: 'Rê',        pantheon: 'egyptien', genre: 'masculin', couleurYeux: 'rouges' },
  bastet:    { id: 'bastet',    label: 'Bastet',    pantheon: 'egyptien', genre: 'feminin',  couleurYeux: 'rouges' },
  isis:      { id: 'isis',      label: 'Isis',      pantheon: 'egyptien', genre: 'feminin',  couleurYeux: 'verts' },
  // Nordique
  loki:      { id: 'loki',      label: 'Loki',      pantheon: 'nordique', genre: 'masculin', couleurYeux: 'verts' },
  odin:      { id: 'odin',      label: 'Odin',      pantheon: 'nordique', genre: 'masculin', couleurYeux: 'bleus' },
  frigg:     { id: 'frigg',     label: 'Frigg',     pantheon: 'nordique', genre: 'feminin',  couleurYeux: 'verts' },
};

export const ALL_GODS: God[] = Object.values(GODS);
