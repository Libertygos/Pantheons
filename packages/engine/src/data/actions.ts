/**
 * Action cards catalogue (T-07). Subtypes: Non / Multiple / Spéciale — 9 of each, one copy
 * per card (docs/card-catalog.md §3). Identities keyed on the asset filenames
 * (card_actions_<subtype>_<n>.webp).
 *
 * ⟨BLOQUÉ:LFS⟩ — each card's exact effect text (and each Multiple's 4-god set, each
 * Spéciale's trigger phase) is DEFINED BY ITS card face; the faces are Git LFS objects the
 * repo currently cannot fetch (LFS budget exceeded). Effects stay stubs until then.
 */
import type { ActionSubtype, GameState, Phase, UserId } from '../types.js';

export interface ActionDef {
  effectKey: string;
  subtype: ActionSubtype;
  /** FR label; verbatim text on the card face takes precedence once readable. */
  label: string;
  /** For 'speciale': phase at whose start it triggers. ⟨BLOQUÉ:LFS⟩ per card. */
  triggerPhase?: Phase;
  /** Effect handler. Stub until faces are transcribed. Pure over (state, actor). */
  apply?: (state: GameState, actor: UserId) => void;
}

function series(subtype: ActionSubtype, prefix: string, label: string): [string, ActionDef][] {
  return Array.from({ length: 9 }, (_, i) => {
    const key = `${prefix}_${i + 1}`;
    return [key, { effectKey: key, subtype, label: `${label} ${i + 1}` }] as [string, ActionDef];
  });
}

/** The 27 real action-card identities. Effects ⟨BLOQUÉ:LFS⟩ — see docs/card-catalog.md §3. */
export const ACTIONS: Record<string, ActionDef> = Object.fromEntries([
  ...series('non', 'action_non', 'Non'),
  ...series('multiple', 'action_multiple', 'Multiple'),
  ...series('speciale', 'action_special', 'Spéciale'),
]);

export function getAction(effectKey: string): ActionDef | undefined {
  return ACTIONS[effectKey];
}
