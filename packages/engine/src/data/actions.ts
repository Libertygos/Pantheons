/**
 * Action cards catalogue (T-07). Subtypes: Non / Multiple / Spéciale.
 * ⟨TRANSCRIBE⟩ — each card's exact effect text is DEFINED BY ITS PNG. Registry keyed by
 * effectKey; real effects wired in Phase 2. rules.md §4 describes the *categories*, this
 * file will carry the *individual* effects once the PNGs land.
 */
import type { ActionSubtype, GameState, Phase, UserId } from '../types.js';

export interface ActionDef {
  effectKey: string;
  subtype: ActionSubtype;
  /** Verbatim FR label from the PNG. ⟨TRANSCRIBE⟩. */
  label: string;
  /** For 'speciale': phase at whose start it triggers. ⟨TRANSCRIBE⟩ per card. */
  triggerPhase?: Phase;
  /** Effect handler. Stub until Phase 2. Pure over (state, actor). */
  apply?: (state: GameState, actor: UserId) => void;
}

/** Registry — populate from the asset manifest (T-07 / Phase 2). Empty until transcribed. */
export const ACTIONS: Record<string, ActionDef> = {};

export function getAction(effectKey: string): ActionDef | undefined {
  return ACTIONS[effectKey];
}
