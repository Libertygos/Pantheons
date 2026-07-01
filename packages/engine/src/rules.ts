/**
 * Panthéons rules engine (T-08) — correctness-critical, pure over GameState.
 *
 * Covers: pioche (regularize to exactly 1 power + draw 2 attributs), question (≤2 total,
 * ≤1 per target, Spéciale is never a question), réponse (server-computed truth,
 * oui→action draw, Non effects on non, Spéciale trigger at declared phase start).
 *
 * Effects whose text lives in the PNGs (powers / Non / Multiple / Spéciale) are dispatched
 * through the data registries (data/powers.ts, data/actions.ts); their bodies are stubs
 * until Phase 2. The rules *surface* (hooks + timing) is complete here.
 */
import { GODS } from './data/gods.js';
import { getAction } from './data/actions.js';
import { getPower } from './data/powers.js';
import type {
  ActionCard,
  AttributCard,
  GameState,
  GodId,
  PlayerState,
  QuestionCard,
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
  if (action.gods && action.gods.length > 0) {
    // Multiple (4-god question) or a god-set Non card.
    return action.gods.includes(godId);
  }
  // A Non card whose question payload is defined by its PNG and not yet transcribed.
  throw new RuleError(
    'QUESTION_PAYLOAD_UNTRANSCRIBED',
    `Charge de question non transcrite pour l’action ${action.effectKey} (⟨TRANSCRIBE⟩).`,
  );
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
 * Pioche phase for one player: regularize powers to exactly 1, then draw 2 attributs.
 * Mutates state (server-authoritative). Throws RuleError on invalid intent.
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
  }

  for (let i = 0; i < ATTRIBUTS_DRAWN_PER_TURN; i++) {
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
  plays: QuestionPlay[]; // 0..2
}

/**
 * Validate + place a player's questions for the turn. Enforces: ≤2 questions, no two to the
 * same target, Spéciale is not a question (goes to the special slot instead), target ≠ self,
 * target seat is a live opponent, card owned in hand.
 */
export function applyQuestions(state: GameState, userId: UserId, intent: QuestionIntent): void {
  const p = requireLivePlayer(state, userId);
  const board = state.boardBySeat[userId];
  if (!board) throw new RuleError('NO_BOARD', 'Plateau introuvable.');
  if (intent.plays.length > MAX_QUESTIONS_PER_TURN) {
    throw new RuleError('TOO_MANY_QUESTIONS', `Au plus ${MAX_QUESTIONS_PER_TURN} questions.`);
  }

  const seenTargets = new Set<number>();
  for (const play of intent.plays) {
    if (play.card.type === 'action' && play.card.subtype === 'speciale') {
      throw new RuleError('SPECIALE_AS_QUESTION', 'Une Spéciale n’est pas une question.');
    }
    if (seenTargets.has(play.targetSeat)) {
      throw new RuleError('DUPLICATE_TARGET', 'Jamais deux questions au même joueur.');
    }
    const targetUser = state.seatOrder[play.targetSeat];
    if (!targetUser) throw new RuleError('BAD_TARGET', 'Siège cible invalide.');
    if (targetUser === userId) throw new RuleError('SELF_TARGET', 'On ne se questionne pas soi-même.');
    if (!state.players[targetUser]?.alive) throw new RuleError('DEAD_TARGET', 'Cible éliminée.');
    if (!ownsCard(p, play.cardId, play.card)) {
      throw new RuleError('CARD_NOT_OWNED', 'Carte absente de la main.');
    }
    seenTargets.add(play.targetSeat);
  }

  // Commit: remove from hand, place on board.
  for (const play of intent.plays) {
    removeFromHand(p, play.cardId, play.card);
    board.questionSlots[play.targetSeat] = {
      card: play.card,
      targetSeat: play.targetSeat,
    };
  }
}

/** Place a Spéciale into the dedicated special slot (not a question; see rules.md §4). */
export function placeSpeciale(state: GameState, userId: UserId, card: ActionCard): void {
  if (card.subtype !== 'speciale') throw new RuleError('NOT_SPECIALE', 'Carte non Spéciale.');
  const board = state.boardBySeat[userId];
  if (!board) throw new RuleError('NO_BOARD', 'Plateau introuvable.');
  if (board.specialSlot) throw new RuleError('SPECIAL_SLOT_FULL', 'Emplacement spécial occupé.');
  const p = requireLivePlayer(state, userId);
  removeFromHand(p, card.id, card);
  board.specialSlot = { card, targetSeat: -1 };
}

// ---- Réponse ---------------------------------------------------------------

export interface AnswerResult {
  placerSeat: number;
  targetUser: UserId;
  cardId: string;
  oui: boolean;
}

/**
 * Resolve the réponse phase across all boards. Order = seatOrder starting at the meneur
 * (the meneur sets order, not serialization — the compute itself is order-independent for
 * truth, but drawn action cards and effect ordering follow this order deterministically).
 * Returns the public results (oui/non per placed card).
 */
export function resolveReponsePhase(state: GameState): AnswerResult[] {
  const results: AnswerResult[] = [];
  const order = seatOrderFromMeneur(state);

  for (const placerId of order) {
    const board = state.boardBySeat[placerId];
    if (!board) continue;
    for (let seat = 0; seat < board.questionSlots.length; seat++) {
      const placed = board.questionSlots[seat];
      if (!placed) continue;
      const targetUser = state.seatOrder[placed.targetSeat];
      if (!targetUser) continue;
      const target = state.players[targetUser];
      if (!target || !target.alive) continue;

      const oui = evaluateQuestion(target.god, placed.card);
      placed.answeredOui = oui;
      results.push({ placerSeat: state.seatOrder.indexOf(placerId), targetUser, cardId: placed.card.id, oui });

      // Rule: any "oui" earns the ASKED player (target) an action-card draw.
      if (oui) {
        const drawn = state.drawPiles.actions.pop();
        if (drawn) target.hand.actions.push(drawn);
      } else {
        // Non effect fires on "non".
        if (placed.card.type === 'action' && placed.card.subtype === 'non') {
          getAction(placed.card.effectKey)?.apply?.(state, placerId);
        }
      }
    }
  }
  return results;
}

/** Fire Spéciale cards whose declared trigger phase == the phase now starting. */
export function fireSpecialesAtPhaseStart(state: GameState, phase: GameState['phase']): void {
  for (const userId of state.seatOrder) {
    const board = state.boardBySeat[userId];
    const slot = board?.specialSlot;
    if (!slot || slot.card.type !== 'action') continue;
    const def = getAction(slot.card.effectKey);
    if (def?.triggerPhase === phase) {
      def.apply?.(state, userId);
      // then discard the Spéciale
      state.discard.actions.push(slot.card.id);
      board!.specialSlot = null;
    }
  }
}

/** End-of-turn cleanup: discard placed question cards, rotate meneur, bump tour. */
export function advanceTurn(state: GameState): void {
  for (const userId of state.seatOrder) {
    const board = state.boardBySeat[userId];
    if (!board) continue;
    for (let i = 0; i < board.questionSlots.length; i++) {
      const placed = board.questionSlots[i];
      if (placed) {
        state.discard.attributs.push(placed.card.id);
        board.questionSlots[i] = null;
      }
    }
  }
  state.meneurIndex = (state.meneurIndex + 1) % state.seatOrder.length;
  state.tour += 1;
}

// ---- Powers ---------------------------------------------------------------

/** Apply a player's held power effect (dispatch to registry; stub until Phase 2). */
export function applyPowerEffect(state: GameState, userId: UserId, effectKey: string): void {
  getPower(effectKey)?.apply?.(state, userId);
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
