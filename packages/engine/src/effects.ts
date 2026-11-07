/**
 * Shared state-mutation helpers for card effects (Non / Spéciale / Pouvoir bodies).
 * Imported by data/actions.ts, data/powers.ts and rules.ts — this module only depends on
 * types.ts, which keeps the registry ↔ rules dependency graph acyclic.
 *
 * Card ids are self-describing (setup.ts): `pow_<effectKey>`, `act_<effectKey>`,
 * `attr_<valeur>_<n>` — so effects can reason about identities without a CardIndex.
 */
import { makeRng, shuffle } from './rng.js';
import type { AxeValeur, CardId, GameState, LastTurnStats, PlayerState, UserId } from './types.js';

export function powerKeyOfCardId(id: CardId): string {
  return id.replace(/^pow_/, '');
}

export function attrValeurOfCardId(id: CardId): string {
  // attr_<valeur>_<n>
  return id.replace(/^attr_/, '').replace(/_\d+$/, '');
}

/** The player's effective power keys — Clonage resolves to its copied key (if chosen). */
export function effectivePowerKeys(state: GameState, userId: UserId): string[] {
  const p = state.players[userId];
  // #1833: an eliminated player's power stays in front of him but is blocked (unusable).
  if (!p || !p.alive) return [];
  const keys: string[] = [];
  for (const id of p.powers) {
    const key = powerKeyOfCardId(id);
    if (key === 'clonage') {
      if (p.clonedPowerKey) keys.push(p.clonedPowerKey);
      keys.push('clonage'); // the card itself stays identifiable (âmes sœurs literal check excluded)
    } else {
      keys.push(key);
    }
  }
  return keys;
}

export function hasEffectivePower(state: GameState, userId: UserId, key: string): boolean {
  return effectivePowerKeys(state, userId).includes(key);
}

/** "Aucun oui au tour précédent" — false on tour 1 (no previous tour to have failed in). */
export function noOuiLastTurn(state: GameState, userId: UserId): boolean {
  if (state.tour <= 1) return false;
  return previousTurnStats(state).ouiFor[userId] !== true;
}

/**
 * #1836: the stats of the PREVIOUS tour, also during the declaration window (when `lastTurn`
 * already holds the current tour's just-resolved réponse).
 */
export function previousTurnStats(state: GameState): LastTurnStats {
  const empty: LastTurnStats = { ouiFor: {}, nonAnswerers: {} };
  if (state.tour <= 1) return empty;
  if (state.lastTurn.tour === state.tour) return state.priorTurn ?? empty;
  return state.lastTurn;
}

/**
 * Discard a player's power(s) to the pouvoir discard. Resets the discarded Clonage's copy
 * and un-links any Clonage that was copying a discarded key (« si le pouvoir copié est
 * défaussé, choisissez-en un autre » — v1: the copy resets to null, the holder re-picks).
 */
export function discardPowers(state: GameState, userId: UserId): void {
  const p = state.players[userId];
  if (!p || !p.alive || p.powers.length === 0) return; // #1833: eliminated = not targetable
  const keys = p.powers.map(powerKeyOfCardId);
  state.discard.pouvoirs.push(...p.powers);
  p.powers = [];
  p.clonedPowerKey = null; // a discarded Clonage loses its copy
  unlinkClonageCopying(state, keys);
}

/** Swap the whole power holdings of two players (Non 3–6, Spéciale 6). */
export function swapPowers(state: GameState, a: UserId, b: UserId): void {
  const pa = state.players[a];
  const pb = state.players[b];
  if (!pa || !pb || !pa.alive || !pb.alive) return; // #1833: eliminated = not targetable
  [pa.powers, pb.powers] = [pb.powers, pa.powers];
  // A moved Clonage loses its owner-bound copy choice on both sides.
  pa.clonedPowerKey = null;
  pb.clonedPowerKey = null;
}

/** Reset any player's Clonage copy that pointed at one of `keys` (its source left play). */
export function unlinkClonageCopying(state: GameState, keys: string[]): void {
  for (const uid of state.seatOrder) {
    const pl = state.players[uid];
    if (pl?.clonedPowerKey && keys.includes(pl.clonedPowerKey)) pl.clonedPowerKey = null;
  }
}

/** Default pick for the Non 1-2 gift (computer, absent, timeout): attributs first, then actions, oldest first. */
export function defaultGift(state: GameState, from: UserId, count: number): CardId[] {
  const h = state.players[from]?.hand;
  if (!h) return [];
  return [...h.attributs, ...h.actions].slice(0, count);
}

/** Move the given cards from `from`'s hand to `to`'s hand (Non 1–2, #1836: the giver chose them). */
export function transferHandCards(state: GameState, from: UserId, to: UserId, cardIds: CardId[]): void {
  const src = state.players[from];
  const dst = state.players[to];
  if (!src || !dst || !src.alive || !dst.alive) return; // #1833
  for (const id of cardIds) {
    const ia = src.hand.attributs.indexOf(id);
    if (ia >= 0) {
      dst.hand.attributs.push(...src.hand.attributs.splice(ia, 1));
      continue;
    }
    const ic = src.hand.actions.indexOf(id);
    if (ic >= 0) dst.hand.actions.push(...src.hand.actions.splice(ic, 1));
  }
}

export type PileKind = 'attributs' | 'actions' | 'pouvoirs';

/**
 * #1833: an empty draw pile is reshuffled from its discard at once (rulebook §4). The shuffle
 * is deterministic (seeded from the match position) so the engine stays pure and replayable.
 */
export function refillIfEmpty(state: GameState, kind: PileKind): void {
  const pile = state.drawPiles[kind];
  const disc = state.discard[kind];
  if (pile.length > 0 || disc.length === 0) return;
  const n = (state.reshuffleCount = (state.reshuffleCount ?? 0) + 1);
  const seed = (Math.imul(state.shuffleSeed ?? 0, 0x85ebca6b) ^ Math.imul(n, 0xc2b2ae35) ^ state.tour) >>> 0;
  pile.push(...shuffle(disc, makeRng(seed)));
  disc.length = 0;
}

/** Draw the top card of a pile, reshuffling its discard first when empty (#1833). */
export function drawFromPile(state: GameState, kind: PileKind): string | undefined {
  refillIfEmpty(state, kind);
  return state.drawPiles[kind].pop();
}

/** Take a specific power from the draw pile by effectKey (else the top). Spéciale 7. */
export function takePowerFromPile(state: GameState, userId: UserId, effectKey?: string): void {
  const p = state.players[userId];
  if (!p) return;
  refillIfEmpty(state, 'pouvoirs');
  const pile = state.drawPiles.pouvoirs;
  if (pile.length === 0) return;
  let idx = effectKey ? pile.findIndex((id) => powerKeyOfCardId(id) === effectKey) : -1;
  if (idx < 0) idx = pile.length - 1;
  p.powers.push(pile.splice(idx, 1)[0]!);
}

/** Take up to two attribut cards by valeur from the draw pile (else the top). Spéciale 8. */
export function takeAttributsFromPile(state: GameState, userId: UserId, valeurs: AxeValeur[] | undefined): void {
  const p = state.players[userId];
  if (!p) return;
  const wanted = [...(valeurs ?? [])].slice(0, 2);
  for (let i = 0; i < 2; i++) {
    refillIfEmpty(state, 'attributs');
    const pile = state.drawPiles.attributs;
    if (pile.length === 0) return;
    const want = wanted[i];
    let idx = want ? pile.findIndex((id) => attrValeurOfCardId(id) === want) : -1;
    if (idx < 0) idx = pile.length - 1;
    p.hand.attributs.push(pile.splice(idx, 1)[0]!);
  }
}

/** All placed question stacks, flattened with their placer, in seat order. */
export function allPlacedQuestions(
  state: GameState,
): { placer: UserId; seat: number; stackIndex: number }[] {
  const out: { placer: UserId; seat: number; stackIndex: number }[] = [];
  for (const placer of state.seatOrder) {
    const board = state.boardBySeat[placer];
    if (!board) continue;
    board.questionSlots.forEach((stack, seat) => {
      stack.forEach((_, stackIndex) => out.push({ placer, seat, stackIndex }));
    });
  }
  return out;
}

/** Remove one placed question card and discard it into the right pile. */
export function discardPlacedQuestion(state: GameState, placer: UserId, seat: number, stackIndex: number): boolean {
  const stack = state.boardBySeat[placer]?.questionSlots[seat];
  const placed = stack?.[stackIndex];
  if (!stack || !placed) return false;
  stack.splice(stackIndex, 1);
  if (placed.card.type === 'attribut') state.discard.attributs.push(placed.card.id);
  else state.discard.actions.push(placed.card.id);
  return true;
}

export function livePlayers(state: GameState): PlayerState[] {
  return state.seatOrder.map((uid) => state.players[uid]!).filter((p) => p?.alive);
}
