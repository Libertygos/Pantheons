/**
 * Pouvoirs catalogue (T-07). 12 powers. ⟨TRANSCRIBE⟩ — each power's effect text is DEFINED
 * BY ITS PNG and must be transcribed into a machine-usable effect. The PNGs are not yet in
 * the repo, so `effect` handlers are stubs registered by key. Phase 2 wires real effects
 * onto the phase hooks exposed by rules.ts.
 *
 * Keeping this as a keyed registry means adding a real effect later is a local edit — no
 * change to the rules engine surface.
 */
import type { GameState, UserId } from '../types.js';

export interface PowerDef {
  effectKey: string;
  /** Verbatim FR label from the PNG. ⟨TRANSCRIBE⟩. */
  label: string;
  /** Applied when the power resolves. Stub until Phase 2. Must be pure over (state,userId). */
  apply?: (state: GameState, owner: UserId) => void;
}

/** 12 placeholder power slots. Replace labels + effects from the PNGs (T-07 / Phase 2). */
export const POWERS: Record<string, PowerDef> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => {
    const key = `pouvoir_${String(i + 1).padStart(2, '0')}`;
    const def: PowerDef = { effectKey: key, label: `⟨TRANSCRIBE pouvoir ${i + 1}⟩` };
    return [key, def];
  }),
);

export function getPower(effectKey: string): PowerDef | undefined {
  return POWERS[effectKey];
}
