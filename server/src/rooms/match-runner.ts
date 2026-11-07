/**
 * MatchRunner (#1838): the match controller plus everything the common gosgames system
 * (game-kit.md §3.3) asks of a room, with no Colyseus in it so it is unit-testable on a fake clock.
 *
 *  - Computers. A seat held by a computer plays through the SAME MatchController methods a
 *    human's socket message reaches (never a privileged shortcut), one action per computer per
 *    tick (COMPUTER_TICK_MS), from its own seat's projection only (computer.ts).
 *  - Disconnection. A dropped person gets MATCH_GRACE_MS. During it the barrier does not wait for
 *    the seat and its pending choices are auto-picked (#1834). If the person is not back, a
 *    computer takes the seat and finishes the game, and the match is flagged `computerReplaced`
 *    so the stats are not skewed. A consented leave skips the grace. When no person is left (every
 *    seat a computer, or the last people dropped for good) the match is abandoned.
 */
import { project, type CardIndex, type GameState, type PrivateReveal, type UserId } from '@pantheons/engine';
import { MatchController, realTimers, type MatchTimers, type PhaseEvent } from './barrier.js';
import { ComputerBrain, type ComputerAction } from './computer.js';

/** Pace of the computers: one move per tick. */
export const COMPUTER_TICK_MS = 500;
/** The kit default grace period (wog-room.md §5): 60 s. */
export const MATCH_GRACE_MS = 60_000;
/** Suffix shown on the name of a seat a computer took over. */
export const REPLACED_SUFFIX = ' (ordinateur)';

export interface MatchRunnerOptions {
  timers?: MatchTimers;
  tickMs?: number;
  graceMs?: number;
  emit?: (e: PhaseEvent) => void;
  /** Private reveals of PERSONS (computers' are consumed here). */
  emitPrivate?: (userId: UserId, reveal: PrivateReveal) => void;
  /** State changed with no human action (a computer moved, a window closed): push projections. */
  onChange?: () => void;
  /** A dropped seat was taken by a computer (the room closes that person's grace). */
  onSeatTaken?: (userId: UserId) => void;
  /** No person is left: the match is abandoned. */
  onAbandon?: () => void;
}

export class MatchRunner {
  readonly controller: MatchController;
  private brains = new Map<UserId, ComputerBrain>();
  private graces = new Map<UserId, unknown>();
  private replaced = new Set<UserId>();
  private tickHandle: unknown = null;
  private _abandoned = false;

  constructor(
    state: GameState,
    private index: CardIndex,
    computerSeats: UserId[],
    private opts: MatchRunnerOptions = {},
  ) {
    for (const uid of computerSeats) this.brains.set(uid, new ComputerBrain(uid));
    this.controller = new MatchController(
      state,
      index,
      (e) => this.opts.emit?.(e),
      (uid, reveal) => {
        const brain = this.brains.get(uid);
        if (brain) brain.observe(reveal);
        else this.opts.emitPrivate?.(uid, reveal);
      },
      { timers: this.timers, onTimer: () => this.opts.onChange?.() },
    );
    this.kick();
  }

  private get timers(): MatchTimers {
    return this.opts.timers ?? realTimers;
  }
  private get state(): GameState {
    return this.controller.state;
  }

  get abandoned(): boolean {
    return this._abandoned;
  }
  /** Seats a computer holds now (lobby computers and takeovers). */
  computerSeats(): UserId[] {
    return [...this.brains.keys()];
  }
  /** True when a computer finished a seat a person had dropped. */
  get computerReplaced(): boolean {
    return this.replaced.size > 0;
  }
  isComputer(uid: UserId): boolean {
    return this.brains.has(uid);
  }
  brain(uid: UserId): ComputerBrain | undefined {
    return this.brains.get(uid);
  }

  // ---- computers ----

  private kick(): void {
    if (this.tickHandle !== null || this._abandoned || this.brains.size === 0) return;
    if (this.state.status === 'terminee') return;
    this.tickHandle = this.timers.setTimeout(() => {
      this.tickHandle = null;
      this.tick();
    }, this.opts.tickMs ?? COMPUTER_TICK_MS);
  }

  /** One move per computer seat. Public so a test (or the room) can step it by hand. */
  tick(): void {
    if (this._abandoned) return;
    let acted = false;
    for (const [uid, brain] of this.brains) {
      if (this.state.status === 'terminee') break;
      const proj = project(this.state, uid, this.index);
      const action = brain.decide(proj);
      if (!action) continue;
      acted = true;
      this.perform(uid, action, () => {
        const safe = brain.safeAction(proj, action);
        if (safe) this.exec(uid, safe);
      });
    }
    if (acted) this.opts.onChange?.();
    this.kick();
  }

  private perform(uid: UserId, action: ComputerAction, fallback: () => void): void {
    try {
      this.exec(uid, action);
      return;
    } catch {
      /* refused by the engine: try the legal fallback below */
    }
    try {
      if (action.kind === 'question' && action.specialePlays.length > 0) {
        this.exec(uid, { ...action, specialePlays: [] });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      fallback();
    } catch {
      /* nothing legal this tick (e.g. waiting on another seat's choice): retry next tick */
    }
  }

  private exec(uid: UserId, a: ComputerAction): void {
    const c = this.controller;
    switch (a.kind) {
      case 'pioche':
        return c.submitPioche(uid, a.intent);
      case 'question':
        return c.submitQuestion(
          uid,
          {
            plays: a.plays.map((pl) => ({
              cardId: pl.cardId,
              card: (this.index.attributs.get(pl.cardId) ?? this.index.actions.get(pl.cardId))!,
              targetSeat: pl.targetSeat,
            })),
          },
          a.specialePlays,
        );
      case 'declaration':
        return c.submitDeclaration(uid, a.guesses ? { guesses: a.guesses } : {});
      case 'execution':
        return c.submitExecution(uid, null);
      case 'donnez':
        return c.submitDonnez(uid, null);
      case 'speciale':
        return c.submitSpeciale(uid, null);
      case 'sabotagePass':
        return c.submitSabotagePass(uid);
      case 'power':
        return c.activatePower(uid, a.activation);
    }
  }

  // ---- disconnection (game-kit.md §3.3) ----

  /** A person's connection dropped: grace starts, the barrier stops waiting for the seat. */
  drop(uid: UserId): void {
    const p = this.state.players[uid];
    if (!p || this.brains.has(uid) || this._abandoned) return;
    p.connected = false;
    if (!this.graces.has(uid)) {
      this.graces.set(
        uid,
        this.timers.setTimeout(() => {
          this.graces.delete(uid);
          this.takeOver(uid);
        }, this.opts.graceMs ?? MATCH_GRACE_MS),
      );
    }
    this.controller.onConnectivityChange();
    this.opts.onChange?.();
  }

  /** The person is back inside the grace. False when the seat is already a computer's. */
  returned(uid: UserId): boolean {
    const p = this.state.players[uid];
    if (!p || this.brains.has(uid) || this._abandoned) return false;
    const h = this.graces.get(uid);
    if (h !== undefined) this.timers.clearTimeout(h);
    this.graces.delete(uid);
    p.connected = true;
    return true;
  }

  /** A consented leave: no grace, the seat goes to a computer at once. */
  left(uid: UserId): void {
    const h = this.graces.get(uid);
    if (h !== undefined) this.timers.clearTimeout(h);
    this.graces.delete(uid);
    if (!this.brains.has(uid)) this.takeOver(uid);
  }

  /** Persons still in the match: every seat that is not a computer and not the excluded one. */
  private personsLeft(excluding: UserId): number {
    return this.state.seatOrder.filter((u) => u !== excluding && !this.brains.has(u)).length;
  }

  private takeOver(uid: UserId): void {
    if (this._abandoned) return;
    if (this.state.status === 'terminee') return;
    if (this.personsLeft(uid) === 0) {
      this.abandon();
      return;
    }
    const p = this.state.players[uid];
    if (!p) return;
    this.brains.set(uid, new ComputerBrain(uid));
    this.replaced.add(uid);
    p.connected = true;
    if (!p.displayName.endsWith(REPLACED_SUFFIX)) p.displayName += REPLACED_SUFFIX;
    this.opts.onSeatTaken?.(uid);
    this.kick();
    this.opts.onChange?.();
  }

  private abandon(): void {
    this._abandoned = true;
    this.dispose();
    this.opts.onAbandon?.();
  }

  /** Stop every timer (room disposal, abandon). */
  dispose(): void {
    if (this.tickHandle !== null) this.timers.clearTimeout(this.tickHandle);
    this.tickHandle = null;
    for (const h of this.graces.values()) this.timers.clearTimeout(h);
    this.graces.clear();
    this.controller.dispose();
  }
}
