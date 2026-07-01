/**
 * Per-player projection — the NEVER-SEND boundary (T-09, [OPUS 🔒]).
 *
 * TOP SECURITY PROPERTY. Every serialization to a client MUST pass through project(): the
 * viewer sees the entirety of their OWN secret state and NOTHING of any other player's
 * secret (god, hand contents, power contents, un-revealed declaration guesses).
 *
 * The pense-bête is client-only and never present in GameState, so it cannot leak here.
 *
 * Invariant (asserted in projection.test.ts): for any viewer, the projection contains no
 * other player's GodId or secret CardId. Keep this file allowlist-shaped: build the output
 * from known-public fields, never by deleting from the full state.
 */
import type {
  Board,
  GameState,
  GodId,
  PlacedCard,
  Phase,
  RoomStatus,
  UserId,
} from './types.js';

/** Public view of another player — no secret fields. */
export interface OpponentView {
  userId: UserId;
  displayName: string;
  connected: boolean;
  alive: boolean;
  /** counts only — never contents */
  handCounts: { attributs: number; actions: number };
  powerCount: number;
  hasSpecialCard: boolean;
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
  /** Placed question/special cards are PUBLIC once on the board (allowlisted). */
  boardBySeat: Record<UserId, Board>;
  drawCounts: { attributs: number; actions: number; pouvoirs: number };
  barrier: { phase: Phase; submitted: UserId[]; youSubmitted: boolean };
  declarationWindowOpen: boolean;
  winner: UserId | null;
  eliminated: UserId[];
}

/** Build the projection for `viewer`. Allowlist construction — public fields only. */
export function project(state: GameState, viewer: UserId): PlayerProjection {
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
  };

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
        hasSpecialCard: Boolean(state.boardBySeat[uid]?.specialSlot),
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
    boardBySeat: projectBoards(state),
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
    declarationWindowOpen: state.status === 'resolutionDeclaration',
    winner: state.winner,
    eliminated: [...state.eliminated],
  };
}

/** Boards carry only PLACED cards, which are public by rule (a posed question is visible). */
function projectBoards(state: GameState): Record<UserId, Board> {
  const out: Record<UserId, Board> = {};
  for (const uid of state.seatOrder) {
    const b = state.boardBySeat[uid];
    if (!b) continue;
    out[uid] = {
      questionSlots: b.questionSlots.map(clonePlaced),
      specialSlot: clonePlaced(b.specialSlot),
    };
  }
  return out;
}

function clonePlaced(p: PlacedCard | null): PlacedCard | null {
  if (!p) return null;
  return { card: p.card, targetSeat: p.targetSeat, answeredOui: p.answeredOui };
}
