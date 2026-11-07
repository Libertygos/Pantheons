/**
 * Panthéons rules engine (T-08) — correctness-critical, pure over GameState.
 *
 * Covers: pioche (regularize to exactly 1 power + draw — modified by Étude/Optimisme),
 * question (caps modified by Connaissance/Spéciale 3, same-target stacking by
 * Concentration/Spéciale 9, Refus royal block), réponse (server-computed truth, oui→action
 * draw to the ANSWERER, Exécution redirect, Non effects on « non », Spéciale 1 watch),
 * Spéciale triggers at declared phase start, and explicit power activations.
 *
 * Effect bodies live in the transcribed registries (data/actions.ts, data/powers.ts) and
 * shared helpers (effects.ts) — docs/card-catalog.md is the source of truth.
 */
import { GODS } from './data/gods.js';
import { makeRng } from './rng.js';
import { getAction } from './data/actions.js';
import { getPower } from './data/powers.js';
import {
  allPlacedQuestions,
  attrValeurOfCardId,
  discardPlacedQuestion,
  defaultGift,
  discardPowers,
  drawFromPile,
  refillIfEmpty,
  takeAttributsFromPile,
  takePowerFromPile,
  hasEffectivePower,
  livePlayers,
  noOuiLastTurn,
  powerKeyOfCardId,
  previousTurnStats,
  transferHandCards,
  unlinkClonageCopying,
} from './effects.js';
import type {
  ActionCard,
  CardId,
  AttributCard,
  AxeValeur,
  GameState,
  GodId,
  PlacedCard,
  PlacedRef,
  PlayerState,
  QuestionCard,
  SpecialeChoice,
  SpecialePayload,
  UserId,
} from './types.js';
import { MAX_QUESTIONS_PER_TURN, POWERS_PER_PLAYER, ATTRIBUTS_DRAWN_PER_TURN } from './types.js';

export class RuleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'RuleError';
  }
}

// ---- Question truth --------------------------------------------------------

/**
 * The single source of question truth. Returns true for "oui". The SERVER calls this to
 * compute the véridique answer; a player never freely declares oui/non (see
 * game-state-model.md §Intégrité). Kept total and deterministic.
 */
export function evaluateQuestion(godId: GodId, card: QuestionCard): boolean {
  const god = GODS[godId];
  if (card.type === 'attribut') {
    const a = card as AttributCard;
    switch (a.axe) {
      case 'genre':
        return god.genre === a.valeur;
      case 'couleurYeux':
        return god.couleurYeux === a.valeur;
      case 'pantheon':
        return god.pantheon === a.valeur;
    }
  }
  // action
  const action = card as ActionCard;
  if (action.subtype === 'speciale') {
    throw new RuleError('SPECIALE_NOT_QUESTION', 'Une carte Spéciale n’est pas une question.');
  }
  if (action.subtype === 'multiple') {
    return (action.gods ?? []).includes(godId);
  }
  // Non: carries its own attribute question (card-catalog.md §3.1).
  switch (action.axe) {
    case 'genre':
      return god.genre === action.valeur;
    case 'couleurYeux':
      return god.couleurYeux === action.valeur;
    case 'pantheon':
      return god.pantheon === action.valeur;
    default:
      throw new RuleError('QUESTION_PAYLOAD_MISSING', `Question absente sur ${action.effectKey}.`);
  }
}

// ---- Pioche ----------------------------------------------------------------

export interface PiocheIntent {
  /** Required iff the player holds 2 powers: which one to discard down to 1. */
  discardPowerId?: string;
}

function drawFrom(state: GameState, kind: 'attributs' | 'actions' | 'pouvoirs'): string | undefined {
  return drawFromPile(state, kind);
}

/**
 * Pioche phase for one player: regularize powers to exactly 1, then draw. Standard draw is
 * 2 attributs; Étude draws 1 attribut + 1 action instead; Optimisme draws 3 attributs when
 * the owner had no « oui » last turn. Mutates state (server-authoritative).
 */
export function applyPioche(state: GameState, userId: UserId, intent: PiocheIntent): void {
  const p = requireLivePlayer(state, userId);

  if (p.powers.length < POWERS_PER_PLAYER) {
    const drawn = drawFrom(state, 'pouvoirs');
    if (drawn) p.powers.push(drawn);
  } else if (p.powers.length > POWERS_PER_PLAYER) {
    if (!intent.discardPowerId || !p.powers.includes(intent.discardPowerId)) {
      throw new RuleError('DISCARD_POWER_REQUIRED', 'Deux pouvoirs : choisir lequel défausser.');
    }
    p.powers = p.powers.filter((id) => id !== intent.discardPowerId);
    state.discard.pouvoirs.push(intent.discardPowerId);
    const dk = powerKeyOfCardId(intent.discardPowerId);
    if (dk === 'clonage') p.clonedPowerKey = null;
    unlinkClonageCopying(state, [dk]); // #1836: a copy dies with the copied power
  }

  if (hasEffectivePower(state, userId, 'etude')) {
    // Étude : « piochez une carte attribut et une carte action » (remplace les 2 attributs).
    const attr = drawFrom(state, 'attributs');
    if (attr) p.hand.attributs.push(attr);
    const act = drawFrom(state, 'actions');
    if (act) p.hand.actions.push(act);
    return;
  }

  let attributsToDraw = ATTRIBUTS_DRAWN_PER_TURN;
  if (hasEffectivePower(state, userId, 'optimisse') && noOuiLastTurn(state, userId)) {
    attributsToDraw = 3; // Optimisme : « trois cartes attributs au lieu de deux »
  }
  for (let i = 0; i < attributsToDraw; i++) {
    const drawn = drawFrom(state, 'attributs');
    if (drawn) p.hand.attributs.push(drawn);
  }
}

// ---- Question --------------------------------------------------------------

export interface QuestionPlay {
  cardId: string;
  card: QuestionCard;
  targetSeat: number;
}
export interface QuestionIntent {
  plays: QuestionPlay[]; // 0..max (2 by default; Connaissance 3; Spéciale 3 = player count)
}

/** The question cap for this player this turn (base 2; Connaissance 3; Spéciale 3 override). */
export function questionCap(state: GameState, userId: UserId): number {
  let cap = MAX_QUESTIONS_PER_TURN;
  if (hasEffectivePower(state, userId, 'connaissance')) cap = 3;
  const override = state.effets.questionsMaxOverride[userId];
  if (override && override.tour === state.tour) cap = Math.max(cap, override.max);
  return cap;
}

/** May this player stack two questions on the same target this turn? */
export function sameTargetAllowed(state: GameState, userId: UserId): boolean {
  if (hasEffectivePower(state, userId, 'concentration')) return true;
  return state.effets.sameTargetOkTour[userId] === state.tour;
}

/** Is this player blocked from asking this turn (Refus royal)? */
export function isAskBlocked(state: GameState, userId: UserId): boolean {
  return state.effets.askBlockedTour[userId] === state.tour;
}

/**
 * Validate + place a player's questions for the turn. Enforces: the cap, ≤2 per target and
 * only with Concentration/Spéciale 9, Spéciale is not a question, target ≠ self, target is
 * a live opponent, card owned in hand, Refus royal block.
 */
export function applyQuestions(state: GameState, userId: UserId, intent: QuestionIntent): void {
  validateQuestions(state, userId, intent);
  commitQuestions(state, userId, intent);
}

/** Checks of a question submission, with no mutation (#1835: run before any Spéciale is placed). */
export function validateQuestions(state: GameState, userId: UserId, intent: QuestionIntent): void {
  const p = requireLivePlayer(state, userId);
  const board = state.boardBySeat[userId];
  if (!board) throw new RuleError('NO_BOARD', 'Plateau introuvable.');
  if (intent.plays.length > 0 && isAskBlocked(state, userId)) {
    throw new RuleError('ASK_BLOCKED', 'Refus royal : vous ne posez pas de questions à ce tour.');
  }
  const cap = questionCap(state, userId);
  if (intent.plays.length > cap) {
    throw new RuleError('TOO_MANY_QUESTIONS', `Au plus ${cap} questions.`);
  }

  const perTarget = new Map<number, number>();
  const maxPerTarget = sameTargetAllowed(state, userId) ? 2 : 1;
  for (const play of intent.plays) {
    if (play.card.type === 'action' && play.card.subtype === 'speciale') {
      throw new RuleError('SPECIALE_AS_QUESTION', 'Une Spéciale n’est pas une question.');
    }
    const count = (perTarget.get(play.targetSeat) ?? 0) + 1;
    if (count > maxPerTarget) {
      throw new RuleError(
        'DUPLICATE_TARGET',
        maxPerTarget === 1 ? 'Jamais deux questions au même joueur.' : 'Au plus deux questions au même joueur.',
      );
    }
    const targetUser = state.seatOrder[play.targetSeat];
    if (!targetUser) throw new RuleError('BAD_TARGET', 'Siège cible invalide.');
    if (targetUser === userId) throw new RuleError('SELF_TARGET', 'On ne se questionne pas soi-même.');
    if (!state.players[targetUser]?.alive) throw new RuleError('DEAD_TARGET', 'Cible éliminée.');
    if (!ownsCard(p, play.cardId, play.card)) {
      throw new RuleError('CARD_NOT_OWNED', 'Carte absente de la main.');
    }
    perTarget.set(play.targetSeat, count);
  }

}

function commitQuestions(state: GameState, userId: UserId, intent: QuestionIntent): void {
  const p = state.players[userId]!;
  const board = state.boardBySeat[userId]!;
  // Commit: remove from hand, stack on board.
  for (const play of intent.plays) {
    removeFromHand(p, play.cardId, play.card);
    board.questionSlots[play.targetSeat] ??= [];
    board.questionSlots[play.targetSeat]!.push({
      card: play.card,
      targetSeat: play.targetSeat,
    });
  }
}

/**
 * Place a Spéciale into the dedicated special slot (not a question; rules.md §4), with its
 * placement-time choices (target for spéciales 1/5/6; pile picks for 7/8).
 */
export function placeSpeciale(
  state: GameState,
  userId: UserId,
  card: ActionCard,
  payload: SpecialePayload = {},
): void {
  validateSpeciale(state, userId, card, payload);
  const board = state.boardBySeat[userId]!;
  removeFromHand(state.players[userId]!, card.id, card);
  board.specialSlot = { card, targetSeat: payload.targetSeat ?? -1, payload };
}

/** Checks of a Spéciale placement, with no mutation (#1835). */
export function validateSpeciale(
  state: GameState,
  userId: UserId,
  card: ActionCard,
  payload: SpecialePayload = {},
): void {
  if (card.subtype !== 'speciale') throw new RuleError('NOT_SPECIALE', 'Carte non Spéciale.');
  const board = state.boardBySeat[userId];
  if (!board) throw new RuleError('NO_BOARD', 'Plateau introuvable.');
  if (board.specialSlot) throw new RuleError('SPECIAL_SLOT_FULL', 'Emplacement spécial occupé.');
  const p = requireLivePlayer(state, userId);
  const def = getAction(card.effectKey);
  if (def?.needsTarget) {
    const targetUser = payload.targetSeat !== undefined ? state.seatOrder[payload.targetSeat] : undefined;
    if (!targetUser || targetUser === userId || !state.players[targetUser]?.alive) {
      throw new RuleError('SPECIALE_TARGET_REQUIRED', 'Cette Spéciale exige un adversaire vivant pour cible.');
    }
  }
  if (!p.hand.actions.includes(card.id)) throw new RuleError('CARD_NOT_OWNED', 'Carte absente de la main.');
}

// ---- Réponse ---------------------------------------------------------------

export interface AnswerResult {
  placerSeat: number;
  targetUser: UserId;
  cardId: string;
  oui: boolean;
}

/** Private information produced by an effect — relayed by the server to `to` ONLY. */
export interface PrivateReveal {
  to: UserId;
  kind: 'personnage' | 'question';
  aboutUser?: UserId;
  god?: GodId;
  card?: QuestionCard;
}

export interface ReponseResolution {
  answers: AnswerResult[];
  reveals: PrivateReveal[];
  /** Set while the resolution is paused on an asker's Exécution choice (answerExecution resumes). */
  pending: { kind: 'execution' | 'donnez'; asker: UserId; answerer: UserId } | null;
}

/**
 * Resolve the réponse phase across all boards. Order = seatOrder starting at the meneur.
 * Rules woven in: any « oui » makes the ASKER draw an action card (#1832; Exécution lets the
 * asker, at that « oui », skip the draw and discard a chosen player's power — the resolution
 * pauses on `pending` until answerExecution); « non » fires the Non card's effect;
 * Spéciale 1's watch privately reveals the watched god on a « oui » to its owner.
 * Also records the per-asker « aucun oui » stats the next turn's powers read.
 */
export function resolveReponsePhase(state: GameState): ReponseResolution {
  state.reponseProgress = { next: 0, pending: null, answers: [], reveals: [], ouiFor: {}, nonAnswerers: {} };
  return continueReponse(state);
}

/**
 * The asker's Exécution choice at a « oui » (#1832): `target` = a player whose power(s) to
 * discard instead of drawing the Action, `null` = decline (draw). Resumes the resolution.
 */
export function answerExecution(state: GameState, userId: UserId, target: UserId | null): ReponseResolution {
  const prog = state.reponseProgress;
  if (!prog?.pending || prog.pending.kind !== 'execution' || prog.pending.asker !== userId) {
    throw new RuleError('PHASE', 'Exécution : aucun choix en attente pour vous.');
  }
  const { asker } = prog.pending;
  if (target !== null) {
    if (!executionTargets(state, asker).includes(target)) {
      throw new RuleError('BAD_TARGET', 'Exécution : cible invalide.');
    }
    discardPowers(state, target);
    (state.effets.powerUsedTour[asker] ??= {})['execution'] = state.tour;
  } else {
    drawAction(state, asker);
  }
  prog.pending = null;
  return continueReponse(state);
}

/** Cards the answerer must give after a « non » to Non 1-2 (#1836). */
export const GIFT_COUNT = 2;

function handSize(state: GameState, userId: UserId): number {
  const h = state.players[userId]?.hand;
  return h ? h.attributs.length + h.actions.length : 0;
}

/**
 * Non 1-2 (#1836): the giver (the questioned player) picks the 2 cards he gives the asker.
 * `cardIds` = null picks the default (computer, absent, timeout). Resumes the resolution.
 */
export function answerDonnez(state: GameState, userId: UserId, cardIds: CardId[] | null): ReponseResolution {
  const prog = state.reponseProgress;
  if (!prog?.pending || prog.pending.kind !== 'donnez' || prog.pending.answerer !== userId) {
    throw new RuleError('PHASE', 'Non : aucun don en attente pour vous.');
  }
  const { asker } = prog.pending;
  const chosen = cardIds ?? defaultGift(state, userId, GIFT_COUNT);
  const hand = state.players[userId]!.hand;
  const owned = new Set([...hand.attributs, ...hand.actions]);
  if (chosen.length !== Math.min(GIFT_COUNT, owned.size) || new Set(chosen).size !== chosen.length || !chosen.every((c) => owned.has(c))) {
    throw new RuleError('BAD_CARDS', `Choisissez exactement ${GIFT_COUNT} cartes de votre main.`);
  }
  transferHandCards(state, userId, asker, chosen);
  prog.pending = null;
  return continueReponse(state);
}

/** Alive opponents holding at least one power — the Exécution targets for `asker`. */
export function executionTargets(state: GameState, asker: UserId): UserId[] {
  return state.seatOrder.filter(
    (u) => u !== asker && state.players[u]?.alive && (state.players[u]?.powers.length ?? 0) > 0,
  );
}

function canOfferExecution(state: GameState, asker: UserId): boolean {
  return (
    hasEffectivePower(state, asker, 'execution') &&
    state.effets.powerUsedTour[asker]?.['execution'] !== state.tour &&
    executionTargets(state, asker).length > 0
  );
}

function drawAction(state: GameState, userId: UserId): void {
  const drawn = drawFromPile(state, 'actions');
  if (drawn) state.players[userId]!.hand.actions.push(drawn);
}

function continueReponse(state: GameState): ReponseResolution {
  const prog = state.reponseProgress!;
  const order = seatOrderFromMeneur(state);
  const flat: { placerId: UserId; placed: PlacedCard }[] = [];
  for (const placerId of order) {
    const board = state.boardBySeat[placerId];
    if (!board) continue;
    for (let seat = 0; seat < board.questionSlots.length; seat++) {
      for (const placed of board.questionSlots[seat] ?? []) flat.push({ placerId, placed });
    }
  }

  while (prog.next < flat.length) {
    const { placerId: originalPlacer, placed } = flat[prog.next]!;
    // #1835: a question appropriated by Spéciale 4 belongs to its new owner — who reaps every effect.
    const placerId = placed.owner ?? originalPlacer;
    prog.next++;
    const targetUser = state.seatOrder[placed.targetSeat];
    if (!targetUser) continue;
    const target = state.players[targetUser];
    if (!target || !target.alive) continue;

    const oui = evaluateQuestion(target.god, placed.card);
    placed.answeredOui = oui;
    prog.answers.push({
      placerSeat: state.seatOrder.indexOf(originalPlacer),
      targetUser,
      cardId: placed.card.id,
      oui,
    });

    if (oui) {
      prog.ouiFor[placerId] = true;
      const watch = state.effets.watchPersonnage[placerId];
      if (watch && watch.tour === state.tour && watch.target === targetUser) {
        prog.reveals.push({ to: placerId, kind: 'personnage', aboutUser: targetUser, god: target.god });
        delete state.effets.watchPersonnage[placerId];
      }
      // The ASKER draws the Action (#1832). Spéciale 4 appropriation (#1835): the owner
      // of the question must be passed here as `placerId` — the asker is the owner.
      if (canOfferExecution(state, placerId)) {
        prog.pending = { kind: 'execution', asker: placerId, answerer: targetUser };
        return { answers: prog.answers, reveals: prog.reveals, pending: prog.pending };
      }
      drawAction(state, placerId);
    } else {
      (prog.nonAnswerers[placerId] ??= []).push(targetUser);
      if (placed.card.type === 'action' && placed.card.subtype === 'non') {
        const def = getAction(placed.card.effectKey);
        def?.apply?.(state, placerId, { other: targetUser });
        if (def?.gives && state.players[placerId]?.alive && handSize(state, targetUser) > 0) {
          if (handSize(state, targetUser) <= def.gives) {
            transferHandCards(state, targetUser, placerId, defaultGift(state, targetUser, def.gives)); // nothing to choose
          } else {
            prog.pending = { kind: 'donnez', asker: placerId, answerer: targetUser };
            return { answers: prog.answers, reveals: prog.reveals, pending: prog.pending };
          }
        }
      }
    }
  }

  state.priorTurn = state.lastTurn;
  state.lastTurn = { tour: state.tour, ouiFor: prog.ouiFor, nonAnswerers: prog.nonAnswerers };
  const result = { answers: prog.answers, reveals: prog.reveals, pending: null };
  state.reponseProgress = null;
  return result;
}

// ---- Spéciales (#1835) ------------------------------------------------------

/** Every placed question as a ref, in board order (meneur first), with its effective owner. */
function placedRefs(state: GameState): (PlacedRef & { placed: PlacedCard; by: UserId; to: UserId | undefined })[] {
  const out: (PlacedRef & { placed: PlacedCard; by: UserId; to: UserId | undefined })[] = [];
  for (const placer of seatOrderFromMeneur(state)) {
    const board = state.boardBySeat[placer];
    board?.questionSlots.forEach((stack, seat) =>
      (stack ?? []).forEach((placed, stackIndex) =>
        out.push({ placer, seat, stackIndex, placed, by: placed.owner ?? placer, to: state.seatOrder[seat] }),
      ),
    );
  }
  return out;
}

/** Spéciale 2: the questions the owner may discard — any posed by OTHER players, never his own. */
export function speciale2Candidates(state: GameState, owner: UserId): PlacedRef[] {
  return placedRefs(state)
    .filter((r) => r.by !== owner)
    .map(({ placer, seat, stackIndex }) => ({ placer, seat, stackIndex }));
}

/** Spéciale 4: a question posed by another player to another player (neither by nor to the owner). */
export function speciale4Candidates(state: GameState, owner: UserId): PlacedRef[] {
  return placedRefs(state)
    .filter((r) => r.by !== owner && r.to !== undefined && r.to !== owner && state.players[r.to]?.alive)
    .map(({ placer, seat, stackIndex }) => ({ placer, seat, stackIndex }));
}

/** Spéciale 7: the distinct powers (effectKeys) in the Pouvoir pile. */
export function speciale7Options(state: GameState): string[] {
  refillIfEmpty(state, 'pouvoirs');
  return [...new Set(state.drawPiles.pouvoirs.map(powerKeyOfCardId))];
}

/** Spéciale 8: the attribute values available in the Attribut pile, with their counts. */
export function speciale8Options(state: GameState): Record<string, number> {
  refillIfEmpty(state, 'attributs');
  const out: Record<string, number> = {};
  for (const id of state.drawPiles.attributs) out[attrValeurOfCardId(id)] = (out[attrValeurOfCardId(id)] ?? 0) + 1;
  return out;
}

/** The deterministic pick for a computer / absent owner / timeout (and a hand with no real choice). */
export function autoSpecialeChoice(state: GameState, owner: UserId, effectKey: string): SpecialeChoice | null {
  switch (effectKey) {
    case 'action_special_2':
      return { kind: 'discard', refs: speciale2Candidates(state, owner).slice(0, 2) };
    case 'action_special_4': {
      const c = speciale4Candidates(state, owner)[0];
      return c ? { kind: 'take', ref: c } : null;
    }
    case 'action_special_7': {
      const pile = state.drawPiles.pouvoirs;
      const top = pile[pile.length - 1];
      return { kind: 'pouvoir', effectKey: top ? powerKeyOfCardId(top) : '' };
    }
    case 'action_special_8': {
      const pile = state.drawPiles.attributs;
      const top = pile.slice(-2).reverse().map((id) => attrValeurOfCardId(id) as AxeValeur);
      return { kind: 'attributs', valeurs: top };
    }
  }
  return null;
}

/** Is there anything to choose from? (An empty option set means the Spéciale just has no effect.) */
function hasSpecialeChoice(state: GameState, owner: UserId, effectKey: string): boolean {
  switch (effectKey) {
    case 'action_special_2':
      return speciale2Candidates(state, owner).length > 0;
    case 'action_special_4':
      return speciale4Candidates(state, owner).length > 0;
    case 'action_special_7':
      return speciale7Options(state).length > 0;
    case 'action_special_8':
      return state.drawPiles.attributs.length + state.discard.attributs.length > 0;
  }
  return false;
}

function applySpecialeChoice(state: GameState, owner: UserId, choice: SpecialeChoice): void {
  switch (choice.kind) {
    case 'discard': {
      // Highest stackIndex first inside one stack keeps the other refs valid.
      const refs = [...choice.refs].sort((a, b) => b.stackIndex - a.stackIndex);
      for (const r of refs) discardPlacedQuestion(state, r.placer, r.seat, r.stackIndex);
      break;
    }
    case 'take': {
      const placed = state.boardBySeat[choice.ref.placer]?.questionSlots[choice.ref.seat]?.[choice.ref.stackIndex];
      if (placed) placed.owner = owner; // stays at its place in the board order and on the same target
      break;
    }
    case 'pouvoir':
      takePowerFromPile(state, owner, choice.effectKey);
      break;
    case 'attributs':
      takeAttributsFromPile(state, owner, choice.valeurs);
      break;
  }
}

function validateSpecialeChoice(state: GameState, owner: UserId, effectKey: string, choice: SpecialeChoice): void {
  const bad = (m: string): never => {
    throw new RuleError('BAD_CHOICE', m);
  };
  const same = (a: PlacedRef, b: PlacedRef) => a.placer === b.placer && a.seat === b.seat && a.stackIndex === b.stackIndex;
  switch (effectKey) {
    case 'action_special_2': {
      if (choice.kind !== 'discard') return bad('Spéciale 2 : choisissez des questions à défausser.');
      const cands = speciale2Candidates(state, owner);
      const want = Math.min(2, cands.length);
      if (choice.refs.length !== want) bad(`Spéciale 2 : choisissez exactement ${want} question(s).`);
      choice.refs.forEach((r, i) => {
        if (!cands.some((c) => same(c, r))) bad('Spéciale 2 : question invalide (jamais la vôtre).');
        if (choice.refs.findIndex((o) => same(o, r)) !== i) bad('Spéciale 2 : deux fois la même question.');
      });
      return;
    }
    case 'action_special_4':
      if (choice.kind !== 'take') return bad('Spéciale 4 : choisissez une question.');
      if (!speciale4Candidates(state, owner).some((c) => same(c, choice.ref))) {
        bad('Spéciale 4 : une question posée par un autre joueur à un autre joueur.');
      }
      return;
    case 'action_special_7':
      if (choice.kind !== 'pouvoir') return bad('Spéciale 7 : choisissez un pouvoir.');
      if (!speciale7Options(state).includes(choice.effectKey)) bad('Spéciale 7 : pouvoir absent de la pile.');
      return;
    case 'action_special_8': {
      if (choice.kind !== 'attributs') return bad('Spéciale 8 : choisissez deux attributs.');
      const avail = speciale8Options(state);
      const total = Object.values(avail).reduce((a, b) => a + b, 0);
      if (choice.valeurs.length !== Math.min(2, total)) bad('Spéciale 8 : choisissez deux attributs.');
      const used: Record<string, number> = {};
      for (const v of choice.valeurs) {
        used[v] = (used[v] ?? 0) + 1;
        if (used[v]! > (avail[v] ?? 0)) bad('Spéciale 8 : attribut absent de la pile.');
      }
      return;
    }
  }
}

/**
 * Fire the Spéciale cards whose declared trigger phase == the phase now starting. They trigger
 * one after the other FROM THE MENEUR, clockwise (#1835), each shown to all (`specialesShown`)
 * then discarded. A Spéciale whose owner or target is eliminated has no effect. Those that
 * need a choice (2, 4, 7, 8) pause on `state.specialePending` until `answerSpeciale`;
 * the caller must not go on with the phase while it is set.
 */
export function fireSpecialesAtPhaseStart(state: GameState, phase: GameState['phase']): void {
  state.specialePending = null;
  for (const userId of seatOrderFromMeneur(state)) {
    const board = state.boardBySeat[userId];
    const slot = board?.specialSlot;
    if (!slot || slot.card.type !== 'action') continue;
    const def = getAction(slot.card.effectKey);
    if (def?.triggerPhase !== phase) continue;
    const other =
      slot.payload?.targetSeat !== undefined ? state.seatOrder[slot.payload.targetSeat] : undefined;
    // #1833: owner or target eliminated before the trigger = no effect (still shown, discarded).
    const dead = !state.players[userId]?.alive || (other !== undefined && !state.players[other]?.alive);
    if (!dead && def.choice && hasSpecialeChoice(state, userId, def.effectKey)) {
      state.specialePending = { phase, owner: userId, effectKey: def.effectKey };
      return;
    }
    if (!dead) def.apply?.(state, userId, { other, payload: slot.payload });
    closeSpeciale(state, userId, dead || (def.choice === true && !def.apply));
  }
}

/** Show the triggered Spéciale to all, then discard it. */
function closeSpeciale(state: GameState, owner: UserId, noEffect: boolean): void {
  const board = state.boardBySeat[owner]!;
  const card = board.specialSlot!.card;
  (state.specialesShown ??= []).push({ owner, cardId: card.id, effectKey: (card as ActionCard).effectKey, noEffect });
  state.discard.actions.push(card.id);
  board.specialSlot = null;
}

/**
 * The owner's choice for the Spéciale paused on `state.specialePending` (#1835); `null` = the
 * deterministic auto-pick (computer, absent, timeout). Applies it, discards the card and goes
 * on with the Spéciales that follow (may pause again). Returns the phase that was waiting.
 */
export function answerSpeciale(state: GameState, userId: UserId, choice: SpecialeChoice | null): GameState['phase'] {
  const pend = state.specialePending;
  if (!pend || pend.owner !== userId) throw new RuleError('PHASE', 'Spéciale : aucun choix en attente pour vous.');
  const picked = choice ?? autoSpecialeChoice(state, userId, pend.effectKey);
  if (!picked) throw new RuleError('BAD_CHOICE', 'Spéciale : rien à choisir.');
  validateSpecialeChoice(state, userId, pend.effectKey, picked);
  applySpecialeChoice(state, userId, picked);
  closeSpeciale(state, userId, false);
  fireSpecialesAtPhaseStart(state, pend.phase);
  return pend.phase;
}

/** End-of-turn cleanup: discard placed question cards, prune stale flags, rotate meneur. */
export function advanceTurn(state: GameState): void {
  state.specialesShown = []; // #1835: the tour's triggered Spéciales are shown until the turn ends
  for (const userId of state.seatOrder) {
    const board = state.boardBySeat[userId];
    if (!board) continue;
    for (let i = 0; i < board.questionSlots.length; i++) {
      for (const placed of board.questionSlots[i] ?? []) {
        if (placed.card.type === 'attribut') state.discard.attributs.push(placed.card.id);
        else state.discard.actions.push(placed.card.id);
      }
      board.questionSlots[i] = [];
    }
  }
  pruneStaleEffects(state);
  // #1837: the meneur passes to the next player in play, skipping the eliminated.
  const n = state.seatOrder.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.meneurIndex + i) % n;
    if (state.players[state.seatOrder[idx]!]?.alive) {
      state.meneurIndex = idx;
      break;
    }
  }
  state.tour += 1;
}

function pruneStaleEffects(state: GameState): void {
  const { effets, tour } = state;
  for (const [uid, v] of Object.entries(effets.questionsMaxOverride)) {
    if (v.tour <= tour) delete effets.questionsMaxOverride[uid];
  }
  for (const map of [effets.sameTargetOkTour, effets.askBlockedTour] as const) {
    for (const [uid, t] of Object.entries(map)) if (t <= tour) delete map[uid];
  }
  for (const [uid, v] of Object.entries(effets.watchPersonnage)) {
    if (v.tour <= tour) delete effets.watchPersonnage[uid];
  }
}

// ---- Power activations ------------------------------------------------------

export type PowerActivation =
  | { effectKey: 'sabotage'; placer: UserId; targetSeat: number; stackIndex?: number }
  | { effectKey: 'refus_royal'; target: UserId }
  | { effectKey: 'clonage'; target: UserId }
  | { effectKey: 'deduction' }
  | { effectKey: 'espionnage'; placer: UserId; targetSeat: number; stackIndex?: number };

export interface PowerActivationResult {
  effectKey: string;
  /** Private payloads (Déduction / Espionnage) — server relays to the activator ONLY. */
  reveal?: PrivateReveal;
}

/**
 * Explicit power activation (the passive powers — Étude, Optimisme, Connaissance,
 * Concentration, Âmes sœurs — need no activation; they modify the flow directly).
 * Once per tour each. Validates ownership (Clonage counts through its copied key) and the
 * card conditions; throws RuleError otherwise.
 */
export function activatePower(
  state: GameState,
  userId: UserId,
  activation: PowerActivation,
): PowerActivationResult {
  requireLivePlayer(state, userId);
  const key = activation.effectKey;
  const def = getPower(key);
  if (!def) throw new RuleError('UNKNOWN_POWER', `Pouvoir inconnu : ${key}.`);
  if ((key as string) === 'execution') {
    throw new RuleError('POWER_PASSIVE', 'Exécution se choisit au « oui » (answerExecution), pas à l’avance.');
  }
  if (def.kind !== 'active') throw new RuleError('POWER_PASSIVE', `${def.label} est passif.`);
  if (!hasEffectivePower(state, userId, key) && !(key === 'clonage' && holdsClonage(state, userId))) {
    throw new RuleError('POWER_NOT_HELD', `Vous ne détenez pas ${def.label}.`);
  }
  const used = state.effets.powerUsedTour[userId]?.[key];
  if (used === state.tour) throw new RuleError('POWER_ALREADY_USED', `${def.label} : une fois par tour.`);
  if (def.needsNoOuiLastTurn && !noOuiLastTurn(state, userId)) {
    throw new RuleError('POWER_CONDITION', `${def.label} : il faut n’avoir eu aucun oui au tour précédent.`);
  }

  let reveal: PrivateReveal | undefined;
  switch (activation.effectKey) {
    case 'sabotage': {
      const someoneOverwhelmed = state.seatOrder.some(
        (uid) => questionsAgainst(state, uid) >= 3 && state.players[uid]?.alive,
      );
      if (!someoneOverwhelmed) {
        throw new RuleError('POWER_CONDITION', 'Sabotage : aucun joueur n’a reçu trois questions ou plus ce tour-ci.');
      }
      const stack = state.boardBySeat[activation.placer]?.questionSlots[activation.targetSeat];
      const placed = stack?.[activation.stackIndex ?? 0];
      if (!placed) throw new RuleError('BAD_TARGET', 'Sabotage : carte posée introuvable.');
      if (placed.card.type !== 'attribut') {
        throw new RuleError('POWER_CONDITION', 'Sabotage : seule une carte attribut posée peut être défaussée.');
      }
      if (placed.answeredOui !== undefined) {
        throw new RuleError('POWER_CONDITION', 'Sabotage : la question est déjà résolue.');
      }
      discardPlacedQuestion(state, activation.placer, activation.targetSeat, activation.stackIndex ?? 0);
      break;
    }
    case 'refus_royal': {
      // #1836: unusable once the target has validated its questions (this turn's are already set).
      if (state.phase !== 'pioche' && (state.phase === 'reponse' || state.barrier.submitted.includes(activation.target))) {
        throw new RuleError('POWER_CONDITION', 'Refus royal : ce joueur a déjà validé ses questions.');
      }
      const nons = previousTurnStats(state).nonAnswerers[userId] ?? [];
      if (!nons.includes(activation.target)) {
        throw new RuleError('POWER_CONDITION', 'Refus royal : ce joueur ne vous a pas répondu non au tour précédent.');
      }
      state.effets.askBlockedTour[activation.target] = state.tour;
      break;
    }
    case 'clonage': {
      const target = state.players[activation.target];
      if (!target || activation.target === userId || !target.alive) {
        throw new RuleError('BAD_TARGET', 'Clonage : cible invalide (joueur éliminé ou vous-même).');
      }
      const targetKey = target.powers.map(powerKeyOfCardId).find((k) => k !== 'clonage');
      if (!targetKey) {
        throw new RuleError('POWER_CONDITION', 'Clonage : la cible n’a pas de pouvoir copiable.');
      }
      state.players[userId]!.clonedPowerKey = targetKey;
      break;
    }
    case 'deduction': {
      if (state.undealtGods.length === 0) {
        throw new RuleError('POWER_CONDITION', 'Déduction : aucune carte personnage non piochée.');
      }
      // #1836: an undealt god at random (secret seeded RNG; never projected).
      const rng = makeRng(deductionSeed(state, userId));
      const god = state.undealtGods[Math.floor(rng() * state.undealtGods.length)]!;
      reveal = { to: userId, kind: 'personnage', god };
      break;
    }
    case 'espionnage': {
      if (activation.placer === userId) {
        throw new RuleError('POWER_CONDITION', 'Espionnage : la question doit être posée par un autre joueur.');
      }
      const placed = state.boardBySeat[activation.placer]?.questionSlots[activation.targetSeat]?.[
        activation.stackIndex ?? 0
      ];
      if (!placed) throw new RuleError('BAD_TARGET', 'Espionnage : question posée introuvable.');
      reveal = { to: userId, kind: 'question', aboutUser: activation.placer, card: placed.card };
      break;
    }
  }

  (state.effets.powerUsedTour[userId] ??= {})[key] = state.tour;
  return { effectKey: key, reveal };
}

function deductionSeed(state: GameState, userId: UserId): number {
  let h = Math.imul(state.shuffleSeed ?? 0, 0x27d4eb2f) ^ Math.imul(state.tour, 0x165667b1);
  for (let i = 0; i < userId.length; i++) h = Math.imul(h ^ userId.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function holdsClonage(state: GameState, userId: UserId): boolean {
  return (state.players[userId]?.powers ?? []).some((id) => powerKeyOfCardId(id) === 'clonage');
}

/** Number of questions placed against a user this turn, across all boards. */
export function questionsAgainst(state: GameState, targetUser: UserId): number {
  const seat = state.seatOrder.indexOf(targetUser);
  if (seat < 0) return 0;
  return allPlacedQuestions(state).filter((q) => q.seat === seat).length;
}

// ---- helpers ---------------------------------------------------------------

export function seatOrderFromMeneur(state: GameState): UserId[] {
  const n = state.seatOrder.length;
  const out: UserId[] = [];
  for (let i = 0; i < n; i++) out.push(state.seatOrder[(state.meneurIndex + i) % n]!);
  return out;
}

function requireLivePlayer(state: GameState, userId: UserId): PlayerState {
  const p = state.players[userId];
  if (!p) throw new RuleError('NO_PLAYER', 'Joueur inconnu.');
  if (!p.alive) throw new RuleError('DEAD_PLAYER', 'Joueur éliminé.');
  return p;
}

function ownsCard(p: PlayerState, cardId: string, card: QuestionCard): boolean {
  if (card.type === 'attribut') return p.hand.attributs.includes(cardId);
  return p.hand.actions.includes(cardId);
}

function removeFromHand(p: PlayerState, cardId: string, card: QuestionCard): void {
  if (card.type === 'attribut') {
    p.hand.attributs = p.hand.attributs.filter((id) => id !== cardId);
  } else {
    p.hand.actions = p.hand.actions.filter((id) => id !== cardId);
  }
}

export { attrValeurOfCardId, hasEffectivePower, noOuiLastTurn, powerKeyOfCardId };
