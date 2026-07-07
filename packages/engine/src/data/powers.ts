/**
 * Pouvoirs catalogue (T-07). The 12 powers, keyed on the asset filenames
 * (card_pouvoirs_<key>.webp) — see docs/card-catalog.md §4.
 *
 * ⟨BLOQUÉ:LFS⟩ — each power's effect text is DEFINED BY ITS card face; the faces are Git
 * LFS objects the repo currently cannot fetch (LFS budget exceeded). Identities and labels
 * below come from the filenames; `apply` handlers stay stubs until the faces are readable
 * (labels marked with ⟨face fait foi⟩ must be re-checked against the art then).
 *
 * Keeping this as a keyed registry means adding a real effect later is a local edit — no
 * change to the rules engine surface.
 */
import type { GameState, UserId } from '../types.js';

export interface PowerDef {
  effectKey: string;
  /** FR label; verbatim spelling on the card face takes precedence once readable. */
  label: string;
  /** Applied when the power resolves. Stub until faces are transcribed. Pure over (state,userId). */
  apply?: (state: GameState, owner: UserId) => void;
}

export const POWERS: Record<string, PowerDef> = {
  sabotage:      { effectKey: 'sabotage',      label: 'Sabotage' },
  clonage:       { effectKey: 'clonage',       label: 'Clonage' },
  etude:         { effectKey: 'etude',         label: 'Étude' },
  concentration: { effectKey: 'concentration', label: 'Concentration' },
  refus_royal:   { effectKey: 'refus_royal',   label: 'Refus royal' },
  connaissance:  { effectKey: 'connaissance',  label: 'Connaissance' },
  execution:     { effectKey: 'execution',     label: 'Exécution' },
  ames_soeurs_1: { effectKey: 'ames_soeurs_1', label: 'Âmes sœurs (1)' },
  ames_soeurs_2: { effectKey: 'ames_soeurs_2', label: 'Âmes sœurs (2)' },
  deduction:     { effectKey: 'deduction',     label: 'Déduction' },
  optimisse:     { effectKey: 'optimisse',     label: 'Optimisse' }, // ⟨face fait foi⟩ graphie inhabituelle
  espionnage:    { effectKey: 'espionnage',    label: 'Espionnage' },
};

export const POWER_KEYS = Object.keys(POWERS);

export function getPower(effectKey: string): PowerDef | undefined {
  return POWERS[effectKey];
}
