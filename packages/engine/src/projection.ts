/**
 * Per-player projection — the NEVER-SEND boundary (T-09, [OPUS 🔒]).
 *
 * TOP SECURITY PROPERTY. Every serialization to a client MUST pass through project(): the
 * viewer sees the entirety of their OWN secret state and NOTHING of any other player's
 * secret (god, hand contents, un-revealed declaration guesses).
 * Powers are PUBLIC (#1833): every seat sees every power card, always.
 *
 * The pense-bête is client-only and never present in GameState, so it cannot leak here.
 *
 * Invariant (asserted in projection.test.ts): for any viewer, the projection contains no
 * other player's GodId or secret CardId. Keep this file allowlist-shaped: build the output
 * from known-public fields, never by deleting from the full state.
 */
import type {
  AttributCard,
  ActionCard,
  GameState,
  GodId,
  PlacedCard,
  Phase,
  PouvoirCard,
  QuestionCard,
  RoomStatus,
  UserId,
} from './types.js';
import type { CardIndex } from './setup.js';
import {
  GIFT_COUNT,
  executionTargets,
  isAskBlocked,
  questionCap,
  sameTargetAllowed,
  speciale2Candidates,
  speciale4Candidates,
  speciale7Options,
  speciale8Options,
} from './rules.js';
import type { PlacedRef, SpecialeShown } from './types.js';

/** Public view of another player — no secret fields. */
export interface OpponentView {
  userId: UserId;
  displayName: string;
  connected: boolean;
  alive: boolean;
  /** counts only — never contents */
  handCounts: { attributs: number; actions: number };
  powerCount: number;
  /** #1833: powers are public, always — every seat sees each opponent's power card face up. */
  powers: string[];
  powerCards?: PouvoirCard[];
  /** Clonage's visible copy (effect key), null when none. */
  clonedPowerKey: string | null;
  hasSpecialCard: boolean;
  /** #1837: every god is revealed once the game is over (eliminated players' included); absent before. */
  god?: GodId;
}

/** The viewer's own state — full secret detail. */
export interface SelfView {
  userId: UserId;
  displayName: string;
  connected: boolean;
  alive: boolean;
  god: GodId; // the viewer's own, allowed
  hand: { attributs: string[]; actions: string[] };
  powers: string[];
  clonedPowerKey: string | null;
  /**
   * The viewer's OWN cards resolved to full card objects (present when the caller passes
   * the match CardIndex). Ids alone are opaque: without this the client can neither show
   * a face nor build a QuestionIntent. Own-secret detail is exactly what the never-send
   * rule allows the owner to see — these fields are populated for viewer === owner ONLY.
   */
  handCards?: { attributs: AttributCard[]; actions: ActionCard[] };
  powerCards?: PouvoirCard[];
}

/**
 * A placed card as seen by ONE viewer. Placed questions are FACE DOWN (card-catalog.md
 * §3.3 note — Espionnage and Spéciales 1/4 only make sense if posed questions are hidden):
 * the card's CONTENT is visible to its placer always, and to its target once the réponse
 * is resolved; everyone else sees only the occupied slot, the card KIND (the physical
 * versos differ per category) and the public oui/non result.
 */
export interface PlacedCardView {
  /** null = face down for this viewer. */
  card: QuestionCard | null;
  /** Public: which deck the card came from (the verso identifies it physically). */
  cardKind: 'attribut' | 'action';
  targetSeat: number;
  answeredOui?: boolean;
  /** #1835: set once Spéciale 4 appropriated the question (public: the card moved). */
  owner?: UserId;
}

/** #1835: the choice a triggered Spéciale waits for, for its OWNER only. */
export type SpecialeChoiceView =
  | { effectKey: 'action_special_2'; candidates: PlacedRef[]; count: number }
  | { effectKey: 'action_special_4'; candidates: PlacedRef[] }
  | { effectKey: 'action_special_7'; options: string[]; cards?: PouvoirCard[] }
  | { effectKey: 'action_special_8'; options: Record<string, number> };

export interface BoardView {
  questionSlots: PlacedCardView[][];
  /** Spéciale slot: content owner-only (fires publicly at trigger, then discards). */
  specialSlot: PlacedCardView | null;
}

export interface PlayerProjection {
  roomId: string;
  status: RoomStatus;
  phase: Phase;
  tour: number;
  meneur: UserId;
  seatOrder: UserId[];
  self: SelfView;
  opponents: OpponentView[];
  /** Per-viewer board views — question contents redacted (see PlacedCardView). */
  boardBySeat: Record<UserId, BoardView>;
  drawCounts: { attributs: number; actions: number; pouvoirs: number };
  barrier: { phase: Phase; submitted: UserId[]; youSubmitted: boolean };
  /** #1834: the shared 30 s declaration window's deadline (epoch ms); null when no countdown runs. */
  declarationDeadline: number | null;
  /** #1834: the Sabotage window, while open: its deadline and whether YOU hold the pop-up. */
  sabotageWindow: { deadline: number | null; youHolder: boolean } | null;
  declarationWindowOpen: boolean;
  /** Exécution (#1832): set for the ASKER only while the Réponse is paused on their « oui » choice. */
  executionChoice: { answerer: UserId; targets: UserId[] } | null;
  /** Non 1-2 (#1836): set for the questioned player while he must pick the cards he gives. */
  donnezChoice: { asker: UserId; count: number } | null;
  /** #1835: Spéciale paused on the viewer's choice (2, 4, 7, 8); null otherwise. */
  specialeChoice: SpecialeChoiceView | null;
  /** #1835: the Spéciales triggered this tour, shown to every seat (they are discarded). */
  specialesShown: SpecialeShown[];
  winner: UserId | null;
  eliminated: UserId[];
  /** The viewer's question rules this turn (powers/Spéciales woven in). */
  questionRules: { max: number; sameTargetOk: boolean; askBlocked: boolean };
}

/** Build the projection for `viewer`. Allowlist construction — public fields only. */
export function project(state: GameState, viewer: UserId, index?: CardIndex): PlayerProjection {
  const me = state.players[viewer];
  if (!me) throw new Error(`project: unknown viewer ${viewer}`);

  const self: SelfView = {
    userId: me.userId,
    displayName: me.displayName,
    connected: me.connected,
    alive: me.alive,
    god: me.god,
    hand: { attributs: [...me.hand.attributs], actions: [...me.hand.actions] },
    powers: [...me.powers],
    clonedPowerKey: me.clonedPowerKey,
  };
  if (index) {
    // Resolve ONLY ids already in the viewer's own secret state — never someone else's.
    self.handCards = {
      attributs: resolve(me.hand.attributs, index.attributs),
      actions: resolve(me.hand.actions, index.actions),
    };
    self.powerCards = resolve(me.powers, index.pouvoirs);
  }

  const opponents: OpponentView[] = state.seatOrder
    .filter((uid) => uid !== viewer)
    .map((uid) => {
      const p = state.players[uid]!;
      return {
        userId: p.userId,
        displayName: p.displayName,
        connected: p.connected,
        alive: p.alive,
        handCounts: { attributs: p.hand.attributs.length, actions: p.hand.actions.length },
        powerCount: p.powers.length,
        powers: [...p.powers],
        ...(index ? { powerCards: resolve(p.powers, index.pouvoirs) } : {}),
        clonedPowerKey: p.clonedPowerKey,
        hasSpecialCard: Boolean(state.boardBySeat[uid]?.specialSlot),
        ...(state.status === 'terminee' ? { god: p.god } : {}),
      };
    });

  return {
    roomId: state.roomId,
    status: state.status,
    phase: state.phase,
    tour: state.tour,
    meneur: state.seatOrder[state.meneurIndex]!,
    seatOrder: [...state.seatOrder],
    self,
    opponents,
    boardBySeat: projectBoards(state, viewer),
    drawCounts: {
      attributs: state.drawPiles.attributs.length,
      actions: state.drawPiles.actions.length,
      pouvoirs: state.drawPiles.pouvoirs.length,
    },
    barrier: {
      phase: state.barrier.phase,
      submitted: [...state.barrier.submitted],
      youSubmitted: state.barrier.submitted.includes(viewer),
    },
    declarationDeadline: state.phase === 'reponse' && state.status === 'enCours' ? state.barrier.deadline : null,
    sabotageWindow: state.sabotageWindow
      ? {
          deadline: state.sabotageWindow.deadline,
          youHolder:
            state.sabotageWindow.holders.includes(viewer) && !state.sabotageWindow.decided.includes(viewer),
        }
      : null,
    declarationWindowOpen: state.status === 'resolutionDeclaration',
    executionChoice:
      state.reponseProgress?.pending?.kind === 'execution' && state.reponseProgress.pending.asker === viewer
        ? { answerer: state.reponseProgress.pending.answerer, targets: executionTargets(state, viewer) }
        : null,
    donnezChoice:
      state.reponseProgress?.pending?.kind === 'donnez' && state.reponseProgress.pending.answerer === viewer
        ? { asker: state.reponseProgress.pending.asker, count: GIFT_COUNT }
        : null,
    specialeChoice: projectSpecialeChoice(state, viewer, index),
    specialesShown: (state.specialesShown ?? []).map((x) => ({ ...x })),
    winner: state.winner,
    eliminated: [...state.eliminated],
    questionRules: {
      max: questionCap(state, viewer),
      sameTargetOk: sameTargetAllowed(state, viewer),
      askBlocked: isAskBlocked(state, viewer),
    },
  };
}

function projectSpecialeChoice(state: GameState, viewer: UserId, index?: CardIndex): SpecialeChoiceView | null {
  const pend = state.specialePending;
  if (!pend || pend.owner !== viewer) return null;
  switch (pend.effectKey) {
    case 'action_special_2': {
      const candidates = speciale2Candidates(state, viewer);
      return { effectKey: 'action_special_2', candidates, count: Math.min(2, candidates.length) };
    }
    case 'action_special_4':
      return { effectKey: 'action_special_4', candidates: speciale4Candidates(state, viewer) };
    case 'action_special_7': {
      const options = speciale7Options(state);
      const cards = index
        ? options.map((k) => index.pouvoirs.get(`pow_${k}`)).filter((c): c is PouvoirCard => !!c)
        : undefined;
      return { effectKey: 'action_special_7', options, ...(cards ? { cards } : {}) };
    }
    case 'action_special_8':
      return { effectKey: 'action_special_8', options: speciale8Options(state) };
  }
  return null;
}

/**
 * Boards carry PLACED cards with per-viewer redaction: a posed question is FACE DOWN —
 * content for the placer always, for the target once resolved, never for bystanders.
 * The special slot's content is owner-only. Kind + occupancy + oui/non stay public.
 */
function projectBoards(state: GameState, viewer: UserId): Record<UserId, BoardView> {
  const out: Record<UserId, BoardView> = {};
  for (const uid of state.seatOrder) {
    const b = state.boardBySeat[uid];
    if (!b) continue;
    out[uid] = {
      questionSlots: b.questionSlots.map((stack) =>
        (stack ?? []).map((p) => projectPlaced(state, p, uid, viewer)),
      ),
      specialSlot: b.specialSlot
        ? {
            card: uid === viewer ? b.specialSlot.card : null,
            cardKind: 'action',
            targetSeat: uid === viewer ? b.specialSlot.targetSeat : -1,
          }
        : null,
    };
  }
  return out;
}

function projectPlaced(state: GameState, p: PlacedCard, placer: UserId, viewer: UserId): PlacedCardView {
  const targetUser = state.seatOrder[p.targetSeat];
  const visible =
    viewer === placer || viewer === p.owner || (viewer === targetUser && p.answeredOui !== undefined);
  return {
    card: visible ? p.card : null,
    cardKind: p.card.type === 'attribut' ? 'attribut' : 'action',
    targetSeat: p.targetSeat,
    answeredOui: p.answeredOui,
    ...(p.owner ? { owner: p.owner } : {}),
  };
}

/** Map owned card ids to card objects, dropping unknown ids (defensive, never inventive). */
function resolve<T>(ids: string[], lookup: Map<string, T>): T[] {
  const out: T[] = [];
  for (const id of ids) {
    const card = lookup.get(id);
    if (card) out.push(card);
  }
  return out;
}
