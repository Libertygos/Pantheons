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
  advanceTurn,
  resolveDeclarations,
  type AnswerResult,
  type CardIndex,
  type GameState,
  type PiocheIntent,
  type QuestionIntent,
  type ResolveResult,
  type UserId,
} from '@pantheons/engine';

export interface DeclarationDecision {
  /** If declaring "Panthéons": opponentUserId -> guessed GodId. Omit/undefined = pass. */
  guesses?: Record<string, string>;
}

export interface PhaseEvent {
  type: 'reponseResolved' | 'declarationResolved' | 'phaseAdvanced' | 'gameOver';
  answers?: AnswerResult[];
  declaration?: ResolveResult;
  phase?: GameState['phase'];
  winner?: UserId | null;
}

export class MatchController {
  constructor(
    public state: GameState,
    private index: CardIndex,
    private emit: (e: PhaseEvent) => void = () => {},
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
    applyPioche(this.state, userId, intent);
    this.markSubmitted(userId);
    this.tryAdvance();
  }

  submitQuestion(userId: UserId, intent: QuestionIntent, specialeCardIds: string[] = []): void {
    this.assertPhase('question');
    // Place any Spéciales first (they occupy the special slot, not question slots).
    for (const cid of specialeCardIds) {
      const card = this.index.actions.get(cid);
      if (card && card.subtype === 'speciale') placeSpeciale(this.state, userId, card);
    }
    applyQuestions(this.state, userId, intent);
    this.markSubmitted(userId);
    this.tryAdvance();
  }

  submitDeclaration(userId: UserId, decision: DeclarationDecision): void {
    this.assertPhase('reponse');
    if (decision.guesses && Object.keys(decision.guesses).length > 0) {
      this.state.declarations.push({ declarer: userId, guesses: decision.guesses as Record<string, never> });
    }
    this.markSubmitted(userId);
    this.tryAdvance();
  }

  /** ⟨INPUT WoG⟩ hook: force-resolve the phase for players who missed the deadline. */
  onDeadline(): void {
    // Nominal policy: treat non-submitters as auto-submitted (auto-pass). WoG policy plugs here.
    for (const uid of this.liveConnected()) this.markSubmitted(uid);
    this.tryAdvance();
  }

  // ---- transitions ----

  private tryAdvance(): void {
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
        const answers = resolveReponsePhase(this.state);
        this.emit({ type: 'reponseResolved', answers });
        // Open the declaration window: players now submit declare/pass.
        this.state.barrier = { phase: 'reponse', submitted: [], deadline: null };
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
        this.emit({ type: 'phaseAdvanced', phase: 'pioche' });
        break;
      }
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
