/**
 * Simultaneous-phase barrier + match driver (T-14, [OPUS]).
 *
 * Pure over engine GameState (no Colyseus here — that keeps this unit-testable; PantheonsRoom
 * is the thin transport adapter). The barrier advances ONLY when every live & connected player
 * has submitted the current phase's action (Decision 1 / game-state-model.md §Barrière).
 *
 * Phase loop:
 *   pioche  -- submitPioche       --> (all in) fire specials@question, -> question
 *   question-- submitQuestion     --> (all in) resolve réponse (auto), open declaration window
 *   reponse -- submitDeclaration  --> (all in) resolve declarations; win => terminee,
 *                                     else advanceTurn -> pioche (fire specials@pioche)
 *
 * #1834: only TWO timers exist, both 30 s and shared by every player concerned: the declaration
 * window (Panthéons / Passer; silence = Passer) and the Sabotage window (Saboter / Passer; silence
 * = Passer), opened between the last question validation and the answers. No other phase or
 * choice has a deadline: a human's pending choice waits for him; computers and disconnected
 * players are auto-picked (disconnection handling moves to the common system in #1838).
 */
import {
  applyPioche,
  applyQuestions,
  fireSpecialesAtPhaseStart,
  placeSpeciale,
  resolveReponsePhase,
  answerExecution,
  answerDonnez,
  answerSpeciale,
  validateQuestions,
  sabotageHolders,
  validateSpeciale,
  advanceTurn,
  activatePower,
  resolveDeclarations,
  type AnswerResult,
  type CardIndex,
  type GameState,
  type PiocheIntent,
  type PowerActivation,
  type PrivateReveal,
  type QuestionIntent,
  type ResolveResult,
  type SpecialeChoice,
  type SpecialePayload,
  type UserId,
} from '@pantheons/engine';

/** Length of the two shared windows (declaration, Sabotage). */
export const WINDOW_MS = 30_000;

/** Injectable clock + timers so tests never sleep 30 s. */
export interface MatchTimers {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realTimers: MatchTimers = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const h = setTimeout(fn, ms);
    (h as { unref?: () => void }).unref?.();
    return h;
  },
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface MatchOptions {
  timers?: MatchTimers;
  /** Called after a window closes on its timer (the room broadcasts the new projections). */
  onTimer?: () => void;
}

export interface DeclarationDecision {
  /** If declaring "Panthéons": opponentUserId -> guessed GodId. Omit/undefined = pass. */
  guesses?: Record<string, string>;
}

export interface PhaseEvent {
  type: 'reponseResolved' | 'declarationResolved' | 'phaseAdvanced' | 'gameOver' | 'powerActivated';
  answers?: AnswerResult[];
  declaration?: ResolveResult;
  phase?: GameState['phase'];
  winner?: UserId | null;
  /** powerActivated: who + which power (public — physical activation is visible). */
  by?: UserId;
  effectKey?: string;
}

/** A Spéciale placement with its choices (target / pile picks — card-catalog.md §3.3). */
export interface SpecialePlay extends SpecialePayload {
  cardId: string;
}

type ActionCardLike = NonNullable<ReturnType<CardIndex['actions']['get']>>;

export class MatchController {
  constructor(
    public state: GameState,
    private index: CardIndex,
    private emit: (e: PhaseEvent) => void = () => {},
    /** Private-information channel (Déduction/Espionnage/Spéciale 1) — unicast only. */
    private emitPrivate: (userId: UserId, reveal: PrivateReveal) => void = () => {},
    private opts: MatchOptions = {},
  ) {}

  private declTimer: unknown = null;
  private sabotageTimer: unknown = null;
  /** The Sabotage window of this tour was already offered (or had no holder). */
  private sabotageHandled = false;

  private get timers(): MatchTimers {
    return this.opts.timers ?? realTimers;
  }

  private clearTimers(): void {
    if (this.declTimer !== null) this.timers.clearTimeout(this.declTimer);
    if (this.sabotageTimer !== null) this.timers.clearTimeout(this.sabotageTimer);
    this.declTimer = null;
    this.sabotageTimer = null;
  }

  /** Stop every timer (room disposal). */
  dispose(): void {
    this.clearTimers();
  }

  private liveConnected(): UserId[] {
    return this.state.seatOrder.filter((uid) => {
      const p = this.state.players[uid];
      return p?.alive && p.connected;
    });
  }

  private markSubmitted(userId: UserId): void {
    if (!this.state.barrier.submitted.includes(userId)) {
      this.state.barrier.submitted.push(userId);
    }
  }

  private allSubmitted(): boolean {
    const live = this.liveConnected();
    return live.length > 0 && live.every((uid) => this.state.barrier.submitted.includes(uid));
  }

  private resetBarrier(phase: GameState['phase']): void {
    this.clearTimers();
    this.sabotageHandled = false;
    this.state.sabotageWindow = null;
    this.state.phase = phase;
    this.state.barrier = { phase, submitted: [], deadline: null };
  }

  // ---- submissions ----

  submitPioche(userId: UserId, intent: PiocheIntent): void {
    this.assertPhase('pioche');
    if (this.state.specialePending) throw new Error('Une Spéciale attend un choix avant la pioche');
    applyPioche(this.state, userId, intent);
    this.markSubmitted(userId);
    this.tryAdvance();
  }

  submitQuestion(userId: UserId, intent: QuestionIntent, specialePlays: SpecialePlay[] = []): void {
    this.assertPhase('question');
    if (this.state.sabotageWindow) throw new Error('Fenêtre de Sabotage ouverte : les questions sont validées');
    // #1835 (P35): validate the WHOLE submission (questions and Spéciales) before applying anything.
    const placements: { card: ActionCardLike; payload: SpecialePayload }[] = [];
    for (const play of specialePlays) {
      const card = this.index.actions.get(play.cardId);
      if (card && card.subtype === 'speciale') {
        const { cardId: _cid, ...payload } = play;
        placements.push({ card, payload });
      }
    }
    if (placements.length > 1) throw new Error('Une seule Spéciale par tour (emplacement spécial occupé).');
    validateQuestions(this.state, userId, intent);
    for (const { card, payload } of placements) validateSpeciale(this.state, userId, card, payload);
    for (const { card, payload } of placements) placeSpeciale(this.state, userId, card, payload);
    applyQuestions(this.state, userId, intent);
    this.markSubmitted(userId);
    this.tryAdvance();
  }

  /**
   * Explicit power activation (Sabotage, Refus royal, Clonage, Déduction, Espionnage,
   * Exécution pre-declare). Allowed while the match runs, outside the declaration pause;
   * the engine validates conditions + once-per-tour. Private payloads go through
   * emitPrivate ONLY (never-send).
   */
  activatePower(userId: UserId, activation: PowerActivation): void {
    if (this.state.status !== 'enCours') {
      throw new Error(`Match not in progress (status=${this.state.status})`);
    }
    const win = this.state.sabotageWindow;
    if (activation.effectKey === 'sabotage') {
      // #1834: Sabotage is usable only inside its window, by a holder who has not decided yet.
      if (!win || !win.holders.includes(userId) || win.decided.includes(userId)) {
        throw new Error('Sabotage : utilisable seulement dans la fenêtre de Sabotage.');
      }
    }
    const result = activatePower(this.state, userId, activation);
    this.emit({ type: 'powerActivated', by: userId, effectKey: result.effectKey });
    if (result.reveal) this.emitPrivate(userId, result.reveal);
    if (activation.effectKey === 'sabotage') this.decideSabotage(userId);
  }

  /** #1834: a holder passes in the Sabotage window. */
  submitSabotagePass(userId: UserId): void {
    const win = this.state.sabotageWindow;
    if (!win || !win.holders.includes(userId)) throw new Error('Aucune fenêtre de Sabotage pour vous.');
    this.decideSabotage(userId);
  }

  private decideSabotage(userId: UserId): void {
    const win = this.state.sabotageWindow;
    if (!win) return;
    if (!win.decided.includes(userId)) win.decided.push(userId);
    if (win.holders.every((h) => win.decided.includes(h))) this.closeSabotageWindow();
  }

  private openSabotageWindow(holders: UserId[]): void {
    const deadline = this.timers.now() + WINDOW_MS;
    this.state.sabotageWindow = { holders, decided: [], deadline };
    this.sabotageTimer = this.timers.setTimeout(() => {
      this.sabotageTimer = null;
      this.closeSabotageWindow();
      this.opts.onTimer?.();
    }, WINDOW_MS);
    this.autoSabotage();
  }

  /** Disconnected holders pass at once (the window must not wait for an absent player). */
  private autoSabotage(): void {
    const win = this.state.sabotageWindow;
    if (!win) return;
    for (const h of win.holders) {
      if (!this.state.players[h]?.connected && !win.decided.includes(h)) win.decided.push(h);
    }
    if (win.holders.every((h) => win.decided.includes(h))) this.closeSabotageWindow();
  }

  private closeSabotageWindow(): void {
    if (!this.state.sabotageWindow) return;
    if (this.sabotageTimer !== null) this.timers.clearTimeout(this.sabotageTimer);
    this.sabotageTimer = null;
    this.state.sabotageWindow = null;
    this.sabotageHandled = true;
    this.tryAdvance();
  }

  submitDeclaration(userId: UserId, decision: DeclarationDecision): void {
    this.assertPhase('reponse');
    if (this.state.specialePending) throw new Error('Une Spéciale attend un choix');
    if (this.state.reponseProgress?.pending) throw new Error('Réponse en attente d’un choix (Exécution / don de cartes)');
    if (decision.guesses && Object.keys(decision.guesses).length > 0) {
      this.state.declarations.push({ declarer: userId, guesses: decision.guesses as Record<string, never> });
    }
    this.markSubmitted(userId);
    this.tryAdvance();
  }

  /**
   * #1834: the shared 30 s declaration window ran out — every player who has not chosen counts
   * as « Passer ». (The only phase deadline; no other phase or choice has one.)
   */
  onDeclarationDeadline(): void {
    if (this.state.phase !== 'reponse' || this.state.barrier.deadline === null) return;
    this.declTimer = null;
    for (const uid of this.state.seatOrder) {
      if (this.state.players[uid]?.alive) this.markSubmitted(uid);
    }
    this.tryAdvance();
  }

  /**
   * WoG model: a disconnected seat is auto-passed so play never blocks. The barrier only
   * counts live+connected players, so a connectivity change can make the current phase
   * complete — the room calls this after flipping any player's `connected` flag.
   */
  onConnectivityChange(): void {
    this.autoSpeciale();
    this.autoDeclineExecution();
    this.autoSabotage();
    this.tryAdvance();
  }

  // ---- transitions ----

  private tryAdvance(): void {
    if (this.state.reponseProgress?.pending) return; // paused on an Exécution choice
    if (this.state.specialePending) return; // paused on a Spéciale's choice (#1835)
    if (this.state.sabotageWindow) return; // paused on the Sabotage window (#1834)
    if (!this.allSubmitted()) return;

    switch (this.state.phase) {
      case 'pioche': {
        this.resetBarrier('question');
        fireSpecialesAtPhaseStart(this.state, 'question');
        this.emit({ type: 'phaseAdvanced', phase: 'question' });
        break;
      }
      case 'question': {
        // #1834: the Sabotage window, before the answers, only when a holder meets its condition.
        if (!this.sabotageHandled) {
          const holders = sabotageHolders(this.state);
          if (holders.length > 0) {
            this.openSabotageWindow(holders);
            return;
          }
          this.sabotageHandled = true;
        }
        // Réponse is server-resolved (Intégrité: truth is computed, not declared).
        this.state.phase = 'reponse';
        fireSpecialesAtPhaseStart(this.state, 'reponse');
        this.autoSpeciale();
        this.resumeReponse();
        break;
      }
      case 'reponse': {
        this.clearTimers();
        this.state.barrier.deadline = null;
        if (this.state.declarations.length > 0) {
          this.state.status = 'resolutionDeclaration';
          const result = resolveDeclarations(this.state);
          this.emit({ type: 'declarationResolved', declaration: result });
          if (result.winner) {
            this.emit({ type: 'gameOver', winner: this.state.winner });
            return;
          }
        }
        // Resume: next turn.
        advanceTurn(this.state);
        this.resetBarrier('pioche');
        fireSpecialesAtPhaseStart(this.state, 'pioche');
        this.autoSpeciale();
        this.emit({ type: 'phaseAdvanced', phase: 'pioche' });
        break;
      }
    }
  }

  /** Resolve the Réponse unless a Spéciale (2, 4) still waits for its owner's choice. */
  private resumeReponse(): void {
    if (this.state.specialePending || this.state.reponseProgress || this.state.barrier.phase === 'reponse') return;
    this.finishReponse(resolveReponsePhase(this.state));
    this.autoDeclineExecution(); // a pending choice of an absent player resolves at once
  }

  /**
   * A Spéciale's choice (#1835: 2, 4, 7, 8): the owner picks when it triggers; null = auto-pick.
   * Resumes the phase that waited for it.
   */
  submitSpeciale(userId: UserId, choice: SpecialeChoice | null): void {
    const phase = answerSpeciale(this.state, userId, choice);
    this.autoSpeciale();
    if (phase === 'reponse') this.resumeReponse();
  }

  /** Auto-pick the Spéciale choices of computers / absent players. */
  private autoSpeciale(): void {
    let guard = 0;
    while (this.state.specialePending && guard++ < 100) {
      const { owner, phase } = this.state.specialePending;
      if (this.state.players[owner]?.connected) return;
      answerSpeciale(this.state, owner, null);
      if (!this.state.specialePending && phase === 'reponse') this.resumeReponse();
    }
  }

  /** Emit the Réponse once resolved and open the declaration window; a pending Exécution choice pauses it. */
  private finishReponse(res: ReturnType<typeof resolveReponsePhase>): void {
    if (res.pending) return; // paused: the asker's executionChoice resumes it
    this.emit({ type: 'reponseResolved', answers: res.answers });
    for (const reveal of res.reveals) this.emitPrivate(reveal.to, reveal);
    // Open the declaration window: players now submit declare/pass.
    // #1834: ONE shared 30 s deadline for every player in play.
    if (this.declTimer !== null) this.timers.clearTimeout(this.declTimer);
    this.state.barrier = { phase: 'reponse', submitted: [], deadline: this.timers.now() + WINDOW_MS };
    this.declTimer = this.timers.setTimeout(() => {
      this.onDeclarationDeadline();
      this.opts.onTimer?.();
    }, WINDOW_MS);
  }

  /**
   * Exécution (#1832): the asker's choice at a « oui » — a target whose power(s) to discard
   * instead of drawing, or null to decline (draw). Resumes the paused Réponse resolution.
   * A pending choice from an absent asker is auto-declined by the disconnect hook.
   */
  submitExecution(userId: UserId, target: UserId | null): void {
    this.assertPhase('reponse');
    this.finishReponse(answerExecution(this.state, userId, target));
  }

  /**
   * Non 1-2 (#1836): the questioned player's choice of the cards he gives (null = default pick).
   * Resumes the paused Réponse resolution.
   */
  submitDonnez(userId: UserId, cardIds: string[] | null): void {
    this.assertPhase('reponse');
    this.finishReponse(answerDonnez(this.state, userId, cardIds));
  }

  /** Auto-resolve a paused choice (bot, absent player; never on a timer): Exécution declined, gift = default pick. */
  private autoDeclineExecution(): void {
    let guard = 0;
    while (this.state.reponseProgress?.pending && guard++ < 100) {
      const pending = this.state.reponseProgress.pending;
      const who = pending.kind === 'donnez' ? pending.answerer : pending.asker;
      if (this.state.players[who]?.connected) return;
      this.finishReponse(
        pending.kind === 'donnez' ? answerDonnez(this.state, who, null) : answerExecution(this.state, who, null),
      );
    }
  }

  private assertPhase(phase: GameState['phase']): void {
    if (this.state.phase !== phase) {
      throw new Error(`Wrong phase: expected ${phase}, in ${this.state.phase}`);
    }
    if (this.state.status !== 'enCours' && !(phase === 'reponse')) {
      throw new Error(`Match not in progress (status=${this.state.status})`);
    }
  }
}
