/**
 * Canonical god data (T-06). SOURCE OF TRUTH for the 12 gods × {genre, couleurYeux, pantheon}.
 *
 * ⟨TRANSCRIBE⟩ — `genre` and `couleurYeux` MUST be read off the pense-bête IMAGE, not
 * inferred. The image is not yet in the repo. Values below are PLACEHOLDERS so the engine
 * compiles and is end-to-end testable; they are NOT authoritative. `pantheon` is the only
 * field known without the image (from the roster grouping) and is final.
 *
 * When transcribing: replace each placeholder, then flip TRANSCRIBED to true. Tests assert
 * structural validity (12 gods, 3-per-pantheon) regardless of TRANSCRIBED.
 */
import type { God, GodId } from '../types.js';

export const TRANSCRIBED = false as const;

export const GODS: Record<GodId, God> = {
  // Hindou
  brahma:    { id: 'brahma',    label: 'Brahma',    pantheon: 'hindou',   genre: 'masculin', couleurYeux: 'marron' },
  ganesh:    { id: 'ganesh',    label: 'Ganesh',    pantheon: 'hindou',   genre: 'masculin', couleurYeux: 'noir' },
  sarasvati: { id: 'sarasvati', label: 'Sarasvati', pantheon: 'hindou',   genre: 'feminin',  couleurYeux: 'marron' },
  // Grec
  zeus:      { id: 'zeus',      label: 'Zeus',      pantheon: 'grec',     genre: 'masculin', couleurYeux: 'bleu' },
  athena:    { id: 'athena',    label: 'Athena',    pantheon: 'grec',     genre: 'feminin',  couleurYeux: 'vert' },
  artemis:   { id: 'artemis',   label: 'Artemis',   pantheon: 'grec',     genre: 'feminin',  couleurYeux: 'bleu' },
  // Égyptien
  re:        { id: 're',        label: 'Rê',        pantheon: 'egyptien', genre: 'masculin', couleurYeux: 'noir' },
  bastet:    { id: 'bastet',    label: 'Bastet',    pantheon: 'egyptien', genre: 'feminin',  couleurYeux: 'vert' },
  isis:      { id: 'isis',      label: 'Isis',      pantheon: 'egyptien', genre: 'feminin',  couleurYeux: 'marron' },
  // Nordique
  loki:      { id: 'loki',      label: 'Loki',      pantheon: 'nordique', genre: 'masculin', couleurYeux: 'vert' },
  odin:      { id: 'odin',      label: 'Odin',      pantheon: 'nordique', genre: 'masculin', couleurYeux: 'bleu' },
  frigg:     { id: 'frigg',     label: 'Frigg',     pantheon: 'nordique', genre: 'feminin',  couleurYeux: 'bleu' },
};

export const ALL_GODS: God[] = Object.values(GODS);
