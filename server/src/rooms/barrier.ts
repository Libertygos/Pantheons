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
 * ⟨INPUT WoG⟩: the stall/disconnect timeout policy plugs into `deadline` + `onDeadline()`.
 * The nominal path here waits indefinitely for all live+connected players.
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
  ) {}

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
    const result = activatePower(this.state, userId, activation);
    this.emit({ type: 'powerActivated', by: userId, effectKey: result.effectKey });
    if (result.reveal) this.emitPrivate(userId, result.reveal);
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

  /** ⟨INPUT WoG⟩ hook: force-resolve the phase for players who missed the deadline. */
  onDeadline(): void {
    this.autoDeclineExecution(true);
    this.autoSpeciale(true);
    // Nominal policy: treat non-submitters as auto-submitted (auto-pass). WoG policy plugs here.
    for (const uid of this.liveConnected()) this.markSubmitted(uid);
    this.tryAdvance();
  }

  /**
   * WoG model: a disconnected seat is auto-passed so play never blocks. The barrier only
   * counts live+connected players, so a connectivity change can make the current phase
   * complete — the room calls this after flipping any player's `connected` flag.
   */
  onConnectivityChange(): void {
    this.autoSpeciale(false);
    this.autoDeclineExecution(false);
    this.tryAdvance();
  }

  // ---- transitions ----

  private tryAdvance(): void {
    if (this.state.reponseProgress?.pending) return; // paused on an Exécution choice
    if (this.state.specialePending) return; // paused on a Spéciale's choice (#1835)
    if (!this.allSubmitted()) return;

    switch (this.state.phase) {
      case 'pioche': {
        this.resetBarrier('question');
        fireSpecialesAtPhaseStart(this.state, 'question');
        this.emit({ type: 'phaseAdvanced', phase: 'question' });
        break;
      }
      case 'question': {
        // Réponse is server-resolved (Intégrité: truth is computed, not declared).
        this.state.phase = 'reponse';
        fireSpecialesAtPhaseStart(this.state, 'reponse');
        this.autoSpeciale(false);
        this.resumeReponse();
        break;
      }
      case 'reponse': {
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
        this.autoSpeciale(false);
        this.emit({ type: 'phaseAdvanced', phase: 'pioche' });
        break;
      }
    }
  }

  /** Resolve the Réponse unless a Spéciale (2, 4) still waits for its owner's choice. */
  private resumeReponse(): void {
    if (this.state.specialePending || this.state.reponseProgress || this.state.barrier.phase === 'reponse') return;
    this.finishReponse(resolveReponsePhase(this.state));
    this.autoDeclineExecution(false); // a pending choice of an absent player resolves at once
  }

  /**
   * A Spéciale's choice (#1835: 2, 4, 7, 8): the owner picks when it triggers; null = auto-pick.
   * Resumes the phase that waited for it.
   */
  submitSpeciale(userId: UserId, choice: SpecialeChoice | null): void {
    const phase = answerSpeciale(this.state, userId, choice);
    this.autoSpeciale(false);
    if (phase === 'reponse') this.resumeReponse();
  }

  /** Auto-pick the Spéciale choices of computers / absent players (all of them when `force`). */
  private autoSpeciale(force: boolean): void {
    let guard = 0;
    while (this.state.specialePending && guard++ < 100) {
      const { owner, phase } = this.state.specialePending;
      if (!force && this.state.players[owner]?.connected) return;
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
    this.state.barrier = { phase: 'reponse', submitted: [], deadline: null };
  }

  /**
   * Exécution (#1832): the asker's choice at a « oui » — a target whose power(s) to discard
   * instead of drawing, or null to decline (draw). Resumes the paused Réponse resolution.
   * A pending choice from an absent asker is auto-declined by the deadline / disconnect hooks.
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

  /** Auto-resolve a paused choice (bot, timeout, absent player): Exécution declined, gift = default pick. */
  private autoDeclineExecution(force: boolean): void {
    let guard = 0;
    while (this.state.reponseProgress?.pending && guard++ < 100) {
      const pending = this.state.reponseProgress.pending;
      const who = pending.kind === 'donnez' ? pending.answerer : pending.asker;
      if (!force && this.state.players[who]?.connected) return;
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
