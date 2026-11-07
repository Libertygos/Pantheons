/**
 * Per-seat redaction of PhaseEvents (#1839 P12) — the never-send boundary for the `event`
 * channel, the counterpart of the engine's project() for the `state` channel.
 *
 * Before #1839 the end-of-answers event carried every card id and the declaration event every
 * right/wrong guess to every seat. Now each seat gets an allowlist-built copy:
 *
 *  - reponseResolved: every seat learns the slot, the target, the card family (the verso is
 *    physical) and the public oui/non. The card id only goes to who may see the card: its
 *    placer, the Spéciale 4 owner who took it, and the questioned player (he answered it).
 *  - declarationResolved: the table learns, per declarer, only won / eliminated. The guesses
 *    and which of them were wrong (`matched`) are sent to nobody, the declarer included:
 *    a partial "x of your guesses was right" would be free information for a player who
 *    stays in the game, and an eliminated declarer's god must stay hidden. Gods are shown to
 *    everyone only at game end, by project().
 *  - other events carry only public data and pass through unchanged.
 */
import type { UserId } from '@pantheons/engine';
import type { PhaseEvent } from './barrier.js';

export interface PublicAnswer {
  placerSeat: number;
  targetUser: UserId;
  oui: boolean;
  cardKind: 'attribut' | 'action';
  /** Present ONLY for the seats allowed to see the card. */
  cardId?: string;
}

export interface PublicEvent {
  type: PhaseEvent['type'];
  answers?: PublicAnswer[];
  declaration?: {
    winner: UserId | null;
    eliminated: UserId[];
    outcomes: { declarer: UserId; won: boolean }[];
  };
  phase?: PhaseEvent['phase'];
  winner?: UserId | null;
  by?: UserId;
  effectKey?: string;
}

export function redactEvent(e: PhaseEvent, viewer: UserId): PublicEvent {
  const out: PublicEvent = { type: e.type };
  if (e.phase !== undefined) out.phase = e.phase;
  if (e.winner !== undefined) out.winner = e.winner;
  if (e.by !== undefined) out.by = e.by;
  if (e.effectKey !== undefined) out.effectKey = e.effectKey;
  if (e.answers) {
    out.answers = e.answers.map((a) => {
      const sees = viewer === a.placer || viewer === a.owner || viewer === a.targetUser;
      return {
        placerSeat: a.placerSeat,
        targetUser: a.targetUser,
        oui: a.oui,
        cardKind: a.cardKind,
        ...(sees ? { cardId: a.cardId } : {}),
      };
    });
  }
  if (e.declaration) {
    out.declaration = {
      winner: e.declaration.winner,
      eliminated: [...e.declaration.eliminated],
      outcomes: e.declaration.outcomes.map((o) => ({ declarer: o.declarer, won: o.won })),
    };
  }
  return out;
}
