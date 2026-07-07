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
import { getAction } from './data/actions.js';
import { getPower } from './data/powers.js';
import {
  allPlacedQuestions,
  attrValeurOfCardId,
  discardPlacedQuestion,
  discardPowers,
  hasEffectivePower,
  livePlayers,
  noOuiLastTurn,
  powerKeyOfCardId,
} from './effects.js';
import type {
  ActionCard,
  AttributCard,
  GameState,
  GodId,
  PlayerState,
  QuestionCard,
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

function drawFrom(pile: string[]): string | undefined {
  return pile.pop();
}

/**
 * Pioche phase for one player: regularize powers to exactly 1, then draw. Standard draw is
 * 2 attributs; Étude draws 1 attribut + 1 action instead; Optimisme draws 3 attributs when
 * the owner had no « oui » last turn. Mutates state (server-authoritative).
 */
export function applyPioche(state: GameState, userId: UserId, intent: PiocheIntent): void {
  const p = requireLivePlayer(state, userId);

  if (p.powers.length < POWERS_PER_PLAYER) {
    const drawn = drawFrom(state.drawPiles.pouvoirs);
    if (drawn) p.powers.push(drawn);
  } else if (p.powers.length > POWERS_PER_PLAYER) {
    if (!intent.discardPowerId || !p.powers.includes(intent.discardPowerId)) {
      throw new RuleError('DISCARD_POWER_REQUIRED', 'Deux pouvoirs : choisir lequel défausser.');
    }
    p.powers = p.powers.filter((id) => id !== intent.discardPowerId);
    state.discard.pouvoirs.push(intent.discardPowerId);
    if (powerKeyOfCardId(intent.discardPowerId) === 'clonage') p.clonedPowerKey = null;
  }

  if (hasEffectivePower(state, userId, 'etude')) {
    // Étude : « piochez une carte attribut et une carte action » (remplace les 2 attributs).
    const attr = drawFrom(state.drawPiles.attributs);
    if (attr) p.hand.attributs.push(attr);
    const act = drawFrom(state.drawPiles.actions);
    if (act) p.hand.actions.push(act);
    return;
  }

  let attributsToDraw = ATTRIBUTS_DRAWN_PER_TURN;
  if (hasEffectivePower(state, userId, 'optimisse') && noOuiLastTurn(state, userId)) {
    attributsToDraw = 3; // Optimisme : « trois cartes attributs au lieu de deux »
  }
  for (let i = 0; i < attributsToDraw; i++) {
    const drawn = drawFrom(state.drawPiles.attributs);
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
  removeFromHand(p, card.id, card);
  board.specialSlot = { card, targetSeat: payload.targetSeat ?? -1, payload };
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
}

/**
 * Resolve the réponse phase across all boards. Order = seatOrder starting at the meneur.
 * Rules woven in: any « oui » makes the ANSWERER draw an action card (Exécution may redirect
 * that draw into discarding a chosen player's power); « non » fires the Non card's effect;
 * Spéciale 1's watch privately reveals the watched god on a « oui » to its owner.
 * Also records the per-asker « aucun oui » stats the next turn's powers read.
 */
export function resolveReponsePhase(state: GameState): ReponseResolution {
  const answers: AnswerResult[] = [];
  const reveals: PrivateReveal[] = [];
  const order = seatOrderFromMeneur(state);
  const ouiFor: Record<UserId, boolean> = {};
  const nonAnswerers: Record<UserId, UserId[]> = {};

  for (const placerId of order) {
    const board = state.boardBySeat[placerId];
    if (!board) continue;
    for (let seat = 0; seat < board.questionSlots.length; seat++) {
      for (const placed of board.questionSlots[seat] ?? []) {
        const targetUser = state.seatOrder[placed.targetSeat];
        if (!targetUser) continue;
        const target = state.players[targetUser];
        if (!target || !target.alive) continue;

        const oui = evaluateQuestion(target.god, placed.card);
        placed.answeredOui = oui;
        answers.push({
          placerSeat: state.seatOrder.indexOf(placerId),
          targetUser,
          cardId: placed.card.id,
          oui,
        });

        if (oui) {
          ouiFor[placerId] = true;
          resolveOuiDraw(state, targetUser);
          const watch = state.effets.watchPersonnage[placerId];
          if (watch && watch.tour === state.tour && watch.target === targetUser) {
            reveals.push({ to: placerId, kind: 'personnage', aboutUser: targetUser, god: target.god });
            delete state.effets.watchPersonnage[placerId];
          }
        } else {
          (nonAnswerers[placerId] ??= []).push(targetUser);
          if (placed.card.type === 'action' && placed.card.subtype === 'non') {
            getAction(placed.card.effectKey)?.apply?.(state, placerId, { other: targetUser });
          }
        }
      }
    }
  }

  state.lastTurn = { ouiFor, nonAnswerers };
  return { answers, reveals };
}

/** The « oui » action draw — redirected by a pre-declared Exécution (once per tour). */
function resolveOuiDraw(state: GameState, answerer: UserId): void {
  const intent = state.effets.executionIntent[answerer];
  if (
    intent &&
    intent.tour === state.tour &&
    hasEffectivePower(state, answerer, 'execution') &&
    (state.players[intent.target]?.powers.length ?? 0) > 0
  ) {
    delete state.effets.executionIntent[answerer];
    discardPowers(state, intent.target);
    return;
  }
  const drawn = state.drawPiles.actions.pop();
  if (drawn) state.players[answerer]!.hand.actions.push(drawn);
}

/** Fire Spéciale cards whose declared trigger phase == the phase now starting. */
export function fireSpecialesAtPhaseStart(state: GameState, phase: GameState['phase']): void {
  for (const userId of state.seatOrder) {
    const board = state.boardBySeat[userId];
    const slot = board?.specialSlot;
    if (!slot || slot.card.type !== 'action') continue;
    const def = getAction(slot.card.effectKey);
    if (def?.triggerPhase === phase) {
      const other =
        slot.payload?.targetSeat !== undefined ? state.seatOrder[slot.payload.targetSeat] : undefined;
      def.apply?.(state, userId, { other, payload: slot.payload });
      // then discard the Spéciale
      state.discard.actions.push(slot.card.id);
      board!.specialSlot = null;
    }
  }
}

/** End-of-turn cleanup: discard placed question cards, prune stale flags, rotate meneur. */
export function advanceTurn(state: GameState): void {
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
  state.meneurIndex = (state.meneurIndex + 1) % state.seatOrder.length;
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
  for (const [uid, v] of Object.entries(effets.executionIntent)) {
    if (v.tour <= tour) delete effets.executionIntent[uid];
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
  | { effectKey: 'espionnage'; placer: UserId; targetSeat: number; stackIndex?: number }
  | { effectKey: 'execution'; target: UserId };

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
      const nons = state.lastTurn.nonAnswerers[userId] ?? [];
      if (!nons.includes(activation.target)) {
        throw new RuleError('POWER_CONDITION', 'Refus royal : ce joueur ne vous a pas répondu non au tour précédent.');
      }
      state.effets.askBlockedTour[activation.target] = state.tour;
      break;
    }
    case 'clonage': {
      const target = state.players[activation.target];
      if (!target || activation.target === userId) throw new RuleError('BAD_TARGET', 'Clonage : cible invalide.');
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
      const god = state.undealtGods[(state.tour - 1) % state.undealtGods.length]!;
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
    case 'execution': {
      const target = state.players[activation.target];
      if (!target || activation.target === userId || !target.alive) {
        throw new RuleError('BAD_TARGET', 'Exécution : cible invalide.');
      }
      state.effets.executionIntent[userId] = { target: activation.target, tour: state.tour };
      break;
    }
  }

  (state.effets.powerUsedTour[userId] ??= {})[key] = state.tour;
  return { effectKey: key, reveal };
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
