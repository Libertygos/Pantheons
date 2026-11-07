/**
 * The computer player (#1838): decides what one computer seat does next, from ITS OWN seat's
 * projection and private reveals only (never the full GameState: it learns what a person at
 * that seat may learn, nothing else).
 *
 * It does not act by itself: the runner feeds it `decide(project(state, seat))` and submits the
 * returned action through the same MatchController methods a human's socket message reaches.
 *
 * Strategy:
 *  - Knowledge: a candidate set of gods per opponent, narrowed by the answers to its own
 *    questions (read on its own board), by private reveals (Spéciale 1, Déduction), then by
 *    elimination (its own god, gods revealed as undealt, an opponent known to hold a god).
 *  - Questions: each turn the (card, target) pairs that split a target's candidates most evenly,
 *    up to the cap, one question per target.
 *  - Declares « Panthéons » only when every live opponent is down to ONE candidate.
 *  - Every other pending choice (Exécution, Non 1-2 gift, Spéciales 2/4/7/8) is answered with
 *    the engine's default (null), exactly what a person pressing « choix automatique » sends.
 */
import {
  GOD_IDS,
  data,
  evaluateQuestion,
  powerKeyOfCardId,
  type ActionCard,
  type GodId,
  type PlayerProjection,
  type PrivateReveal,
  type QuestionCard,
  type UserId,
} from '@pantheons/engine';

export type ComputerAction =
  | { kind: 'pioche'; intent: { discardPowerId?: string } }
  | {
      kind: 'question';
      plays: { cardId: string; targetSeat: number }[];
      specialePlays: { cardId: string; targetSeat?: number }[];
    }
  | { kind: 'declaration'; guesses?: Record<string, string> }
  | { kind: 'execution' }
  | { kind: 'donnez' }
  | { kind: 'speciale' }
  | { kind: 'sabotagePass' }
  | { kind: 'power'; activation: { effectKey: 'deduction' } };

/** Powers worth keeping when two are held (best first); unknown keys rank last. */
const KEEP_ORDER = ['deduction', 'etude', 'connaissance', 'optimisme', 'concentration'];

export class ComputerBrain {
  /** opponent -> gods it may still hold. */
  private candidates = new Map<UserId, Set<GodId>>();
  /** Gods known to be held by nobody (Déduction's undealt reveal). */
  private undealt = new Set<GodId>();
  /** Deduction already used this tour (the engine allows it once per tour). */
  private deductionTour = -1;

  constructor(readonly userId: UserId) {}

  /** A private reveal addressed to this seat (Spéciale 1 / Déduction). */
  observe(reveal: PrivateReveal): void {
    if (reveal.to !== this.userId || reveal.kind !== 'personnage' || !reveal.god) return;
    if (reveal.aboutUser) this.candidates.set(reveal.aboutUser, new Set([reveal.god]));
    else this.undealt.add(reveal.god);
  }

  /** Candidates still open for an opponent (tests/diagnostics). */
  candidatesOf(uid: UserId): GodId[] {
    return [...(this.candidates.get(uid) ?? [])];
  }

  private learn(p: PlayerProjection): void {
    for (const o of p.opponents) {
      if (!this.candidates.has(o.userId)) this.candidates.set(o.userId, new Set(GOD_IDS));
    }
    // Answers to our own questions: face up to their placer, the oui/non is public.
    const mine = p.boardBySeat[this.userId];
    for (const stack of mine?.questionSlots ?? []) {
      for (const placed of stack) {
        // A question Spéciale 4 gave to someone else no longer tells us about its first target.
        if (!placed.card || placed.answeredOui === undefined || placed.owner) continue;
        const target = p.seatOrder[placed.targetSeat];
        const set = target ? this.candidates.get(target) : undefined;
        if (!set) continue;
        for (const g of [...set]) {
          if (evaluateQuestion(g, placed.card) !== placed.answeredOui) set.delete(g);
        }
      }
    }
    // Elimination: our own god and the undealt ones are nobody's; a singleton is taken.
    for (const set of this.candidates.values()) {
      set.delete(p.self.god);
      for (const g of this.undealt) set.delete(g);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const [uid, set] of this.candidates) {
        if (set.size !== 1) continue;
        const [only] = [...set] as [GodId];
        for (const [other, oset] of this.candidates) {
          if (other !== uid && oset.delete(only)) changed = true;
        }
      }
    }
  }

  /** What this seat does next, or null when it has nothing to do right now. */
  decide(p: PlayerProjection): ComputerAction | null {
    if (p.status === 'terminee' || !p.self.alive) return null;
    this.learn(p);

    if (p.specialeChoice) return { kind: 'speciale' };
    if (p.executionChoice) return { kind: 'execution' };
    if (p.donnezChoice) return { kind: 'donnez' };
    if (p.sabotageWindow) {
      // Question validation is closed while the Sabotage window is open.
      return p.sabotageWindow.youHolder ? { kind: 'sabotagePass' } : null;
    }
    if (p.barrier.youSubmitted) return null;

    if (p.phase === 'pioche') return { kind: 'pioche', intent: this.piocheIntent(p) };

    if (p.phase === 'question') {
      const keys = p.self.powers.map(powerKeyOfCardId);
      if (keys.includes('deduction') && this.deductionTour !== p.tour) {
        this.deductionTour = p.tour; // one try per tour, win or lose
        return { kind: 'power', activation: { effectKey: 'deduction' } };
      }
      return this.questions(p);
    }

    if (p.phase === 'reponse' && p.declarationDeadline !== null) return this.declaration(p);
    return null;
  }

  /** A fallback that is always legal when the preferred action was refused. */
  safeAction(p: PlayerProjection, tried: ComputerAction): ComputerAction | null {
    if (tried.kind === 'question') return { kind: 'question', plays: [], specialePlays: [] };
    if (tried.kind === 'pioche') return { kind: 'pioche', intent: this.piocheIntent(p) };
    if (tried.kind === 'declaration') return { kind: 'declaration' };
    return null;
  }

  private piocheIntent(p: PlayerProjection): { discardPowerId?: string } {
    if (p.self.powers.length <= 1) return {};
    const rank = (id: string) => {
      const i = KEEP_ORDER.indexOf(powerKeyOfCardId(id));
      return i < 0 ? KEEP_ORDER.length : i;
    };
    const sorted = [...p.self.powers].sort((a, b) => rank(a) - rank(b));
    return { discardPowerId: sorted[sorted.length - 1]! }; // keep the best, discard the worst
  }

  private questions(p: PlayerProjection): ComputerAction {
    const plays: { cardId: string; targetSeat: number }[] = [];
    const specialePlays: { cardId: string; targetSeat?: number }[] = [];
    const targets = p.opponents.filter((o) => o.alive);
    const seatOf = (uid: UserId) => p.seatOrder.indexOf(uid);

    if (!p.questionRules.askBlocked) {
      const cards: QuestionCard[] = [
        ...(p.self.handCards?.attributs ?? []),
        ...(p.self.handCards?.actions ?? []).filter((c) => c.subtype !== 'speciale'),
      ];
      const pairs: { cardId: string; seat: number; score: number }[] = [];
      for (const o of targets) {
        const set = this.candidates.get(o.userId);
        if (!set || set.size <= 1) continue; // nothing left to learn about this player
        for (const c of cards) {
          let yes = 0;
          for (const g of set) if (evaluateQuestion(g, c)) yes++;
          const score = Math.min(yes, set.size - yes); // 0 = the answer teaches nothing
          if (score > 0) pairs.push({ cardId: c.id, seat: seatOf(o.userId), score });
        }
      }
      pairs.sort((a, b) => b.score - a.score || a.seat - b.seat || (a.cardId < b.cardId ? -1 : 1));
      const usedCards = new Set<string>();
      const usedSeats = new Set<number>();
      for (const pair of pairs) {
        if (plays.length >= p.questionRules.max) break;
        if (usedCards.has(pair.cardId) || usedSeats.has(pair.seat)) continue;
        usedCards.add(pair.cardId);
        usedSeats.add(pair.seat);
        plays.push({ cardId: pair.cardId, targetSeat: pair.seat });
      }
    }

    // One Spéciale per tour when the hand holds one (its target, if it needs one: any live opponent).
    const special = (p.self.handCards?.actions ?? []).find((c): c is ActionCard => c.subtype === 'speciale');
    if (special && targets.length > 0) {
      const needsTarget = data.getAction(special.effectKey)?.needsTarget === true;
      specialePlays.push(needsTarget ? { cardId: special.id, targetSeat: seatOf(targets[0]!.userId) } : { cardId: special.id });
    }
    return { kind: 'question', plays, specialePlays };
  }

  private declaration(p: PlayerProjection): ComputerAction {
    const guesses: Record<string, string> = {};
    for (const o of p.opponents) {
      if (!o.alive) continue;
      const set = this.candidates.get(o.userId);
      if (!set || set.size !== 1) return { kind: 'declaration' }; // not sure: « Passer »
      guesses[o.userId] = [...set][0]!;
    }
    return Object.keys(guesses).length > 0 ? { kind: 'declaration', guesses } : { kind: 'declaration' };
  }
}
