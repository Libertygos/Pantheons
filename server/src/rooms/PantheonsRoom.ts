/**
 * PantheonsRoom (T-14/T-15) — thin Colyseus transport adapter over MatchController.
 *
 * CRITICAL: we do NOT use Colyseus automatic schema state sync (which broadcasts one shared
 * state to everyone). Hidden-information games must never do that. Instead the server holds
 * the authoritative GameState and pushes a PER-CLIENT projection (project(state, userId)) as
 * messages. This is the transport-level enforcement of the never-send boundary.
 *
 * Lobby mirrors WoG: min 4 / max 7 to start. Reconnection uses Colyseus allowReconnection,
 * matching WoG semantics (⟨INPUT WoG⟩: exact grace window/policy to be copied from WoG).
 */
import { Room, type Client } from '@colyseus/core';
import {
  createGame,
  project,
  MIN_PLAYERS,
  MAX_PLAYERS,
  type CardIndex,
  type GameState,
  type SeatInput,
} from '@pantheons/engine';
import { MatchController, type PhaseEvent } from './barrier.js';
import { verifySession } from '../auth/session.js';

interface JoinOptions {
  sessionToken: string;
}

interface Seat {
  userId: string;
  displayName: string;
}

const RECONNECT_GRACE_SECONDS = 60; // ⟨INPUT WoG⟩: align with WoG grace window

export class PantheonsRoom extends Room {
  override maxClients = MAX_PLAYERS;

  private controller: MatchController | null = null;
  private index: CardIndex | null = null;
  private seats: Seat[] = [];
  private clientByUser = new Map<string, Client>();
  private started = false;
  private sessionSecret = process.env.SESSION_JWT_SECRET ?? '';

  override onCreate(): void {
    this.onMessage('pioche', (client, msg) => this.guard(client, (uid) => this.controller?.submitPioche(uid, msg)));
    this.onMessage('question', (client, msg) =>
      this.guard(client, (uid) => this.controller?.submitQuestion(uid, msg.intent, msg.specialeCardIds ?? [])),
    );
    this.onMessage('declaration', (client, msg) =>
      this.guard(client, (uid) => this.controller?.submitDeclaration(uid, msg)),
    );
    this.onMessage('start', (client) => this.guard(client, () => this.startMatch()));
  }

  override async onAuth(_client: Client, options: JoinOptions): Promise<{ userId: string; displayName: string }> {
    // Session S-JWT (NOT the handoff token) authorises the socket. Handoff already exchanged.
    const claims = verifySession(options.sessionToken, this.sessionSecret);
    return { userId: claims.sub, displayName: claims.displayName ?? claims.sub };
  }

  override onJoin(client: Client, _options: JoinOptions, auth?: { userId: string; displayName: string }): void {
    if (!auth) return;
    const { userId, displayName } = auth;
    client.userData = { userId };
    this.clientByUser.set(userId, client);

    if (this.started && this.controller) {
      // Reconnect path: rehydrate an existing seat.
      const p = this.controller.state.players[userId];
      if (p) {
        p.connected = true;
        this.pushProjection(userId);
        this.broadcastProjections();
        return;
      }
    }

    // Lobby path: take/keep a seat (max enforced by maxClients).
    if (!this.seats.find((s) => s.userId === userId)) {
      this.seats.push({ userId, displayName });
    }
    this.broadcastLobby();
  }

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const userId = client.userData?.userId as string | undefined;
    if (!userId) return;

    if (this.started && this.controller) {
      const p = this.controller.state.players[userId];
      if (p) p.connected = false;
      this.broadcastProjections();
      if (!consented) {
        // WoG-style reconnection grace. ⟨INPUT WoG⟩: exact policy/timeout.
        try {
          await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
          if (p) p.connected = true;
          this.broadcastProjections();
          return;
        } catch {
          // grace expired — barrier policy may auto-resolve their phase.
          this.controller.onDeadline();
          this.broadcastProjections();
        }
      }
      return;
    }

    // Lobby leave: free the seat.
    this.seats = this.seats.filter((s) => s.userId !== userId);
    this.clientByUser.delete(userId);
    this.broadcastLobby();
  }

  // ---- match lifecycle ----

  private startMatch(): void {
    if (this.started) return;
    if (this.seats.length < MIN_PLAYERS) {
      throw new Error(`Il faut au moins ${MIN_PLAYERS} joueurs pour démarrer.`);
    }
    if (this.seats.length > MAX_PLAYERS) {
      throw new Error(`Maximum ${MAX_PLAYERS} joueurs.`);
    }
    const seatInputs: SeatInput[] = this.seats.map((s) => ({ userId: s.userId, displayName: s.displayName }));
    const seed = Math.floor(Math.random() * 0xffffffff);
    const { state, index } = createGame(this.roomId, seatInputs, seed);
    this.index = index;
    this.controller = new MatchController(state, index, (e) => this.onPhaseEvent(e));
    this.started = true;
    this.lock(); // no new joiners mid-match (reconnects still allowed)
    this.broadcastProjections();
  }

  private onPhaseEvent(e: PhaseEvent): void {
    this.broadcast('event', e);
    this.broadcastProjections();
    if (e.type === 'gameOver') this.broadcast('gameOver', { winner: e.winner });
  }

  // ---- projection push (never-send transport) ----

  private getState(): GameState | null {
    return this.controller?.state ?? null;
  }

  private pushProjection(userId: string): void {
    const state = this.getState();
    const client = this.clientByUser.get(userId);
    if (!state || !client) return;
    client.send('state', project(state, userId));
  }

  private broadcastProjections(): void {
    const state = this.getState();
    if (!state) return;
    for (const uid of Object.keys(state.players)) this.pushProjection(uid);
  }

  private broadcastLobby(): void {
    this.broadcast('lobby', {
      players: this.seats,
      canStart: this.seats.length >= MIN_PLAYERS,
      min: MIN_PLAYERS,
      max: MAX_PLAYERS,
    });
  }

  private guard(client: Client, fn: (userId: string) => void): void {
    const userId = client.userData?.userId as string | undefined;
    if (!userId) return;
    try {
      fn(userId);
    } catch (err) {
      client.send('error', { message: err instanceof Error ? err.message : 'Erreur' });
    }
  }
}
