/**
 * PantheonsRoom — thin Colyseus transport adapter over MatchController, carrying the WoG
 * room model (wog-room.md): room codes, a host/ready lobby with configurable seat slots
 * (min 4 / max 7), reconnection grace windows, duplicate-account rejection, and the
 * ≥2-concurrent-drops abort that rebuilds a fresh lobby from the survivors.
 *
 * CRITICAL: we do NOT use Colyseus automatic schema state sync (which broadcasts one shared
 * state to everyone). Hidden-information games must never do that. Instead the server holds
 * the authoritative GameState and pushes a PER-CLIENT projection (project(state, userId)) as
 * messages. On reconnect the client is seeded from a fresh projection ONLY (never-send
 * guarantee across a refresh — wog-room.md §5.3).
 *
 * The acting player is always derived from the connection (client.userData.userId set in
 * onJoin from the verified session), never from a field in a client message.
 */
import { Room, ServerError, type Client } from '@colyseus/core';
import {
  createGame,
  project,
  ABSOLUTE_MIN_PLAYERS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  type CardIndex,
  type GameState,
  type SeatInput,
} from '@pantheons/engine';
import { MatchController, type PhaseEvent } from './barrier.js';
import { generateRoomCode, normalizeRoomCode } from './room-code.js';
import { isCodeTaken, registerRoom, unregisterRoom, type RoomPhase } from './room-registry.js';
import { verifySession } from '../auth/session.js';
import { reportMatch } from '../http/matchReport.js';
import {
  recordPlayerConnected,
  recordPlayerDisconnected,
  recordRoomClosed,
  recordRoomOpened,
} from '../http/metrics.js';

interface JoinOptions {
  sessionToken: string;
  /** Present on join-by-code; absent on create. Checked against this room's code. */
  roomCode?: string;
}

type ConnStatus = 'CONNECTED' | 'DISCONNECTED';

interface SeatSlot {
  userId: string | null;
  displayName: string;
  ready: boolean;
  conn: ConnStatus;
}

export interface SeatInfo {
  seatId: number;
  occupied: boolean;
  displayName: string;
  ready: boolean;
  conn: ConnStatus;
}

// WoG grace windows (wog-room.md §5.1 / §5.2): 60 s in lobby and in match.
export const LOBBY_RECONNECT_GRACE_S = 60;
export const MATCH_RECONNECT_GRACE_S = 60;
const DEFAULT_SEATS = MIN_PLAYERS;

/**
 * Comptes plateforme autorisés à lancer une partie de test à 2 joueurs (ADMIN_USER_IDS,
 * user_id gosgames séparés par des virgules). Pour tout autre hôte le minimum reste
 * MIN_PLAYERS (4).
 */
const ADMIN_USER_IDS = new Set(
  (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

function emptySlot(): SeatSlot {
  return { userId: null, displayName: '', ready: false, conn: 'CONNECTED' };
}

export class PantheonsRoom extends Room {
  override maxClients = MAX_PLAYERS;

  private roomCode = '';
  private slots: SeatSlot[] = Array.from({ length: DEFAULT_SEATS }, emptySlot);
  private hostSeat = -1;
  private accountToSeat = new Map<string, number>();
  private clientByUser = new Map<string, Client>();
  /** Pending reconnection grace windows, cancellable on abort (userId -> rejecter). */
  private graceByUser = new Map<string, { reject: () => void }>();

  private controller: MatchController | null = null;
  private index: CardIndex | null = null;
  private started = false;
  private sessionSecret = process.env.SESSION_JWT_SECRET ?? '';
  /** Facts for the platform match report, frozen at startMatch (the room locks). */
  private matchStartedAt: Date | null = null;
  private matchPlayerIds: string[] = [];
  private matchReported = false;

  // ---- lifecycle ------------------------------------------------------------

  override onCreate(): void {
    recordRoomOpened();
    do {
      this.roomCode = generateRoomCode();
    } while (isCodeTaken(this.roomCode));
    registerRoom(this.roomCode, this.roomId, () => this.registryPhase());
    void this.setMetadata({ roomCode: this.roomCode });

    // Lobby surface (wog-room.md §4.2)
    this.onMessage('SET_READY', (client, msg: { ready?: boolean }) =>
      this.guard(client, (uid) => this.setReady(uid, msg?.ready === true)),
    );
    this.onMessage('ADD_SEAT', (client) => this.guard(client, (uid) => this.addSeat(uid)));
    this.onMessage('REMOVE_SEAT', (client) => this.guard(client, (uid) => this.removeSeat(uid)));
    this.onMessage('START_MATCH', (client) => this.guard(client, (uid) => this.startMatch(uid)));
    this.onMessage('LEAVE_ROOM', (client) => this.guard(client, (uid) => this.consentedLeave(uid)));
    this.onMessage('REQUEST_LOBBY_STATE', (client) => client.send('LOBBY_STATE', this.lobbyState()));
    // Re-ask pattern (wog-room.md §4.1): join/reconnect-time unicasts race handler
    // registration client-side, so a resuming client explicitly requests its state.
    this.onMessage('REQUEST_STATE', (client) => this.guard(client, (uid) => this.sendResumeState(client, uid)));

    // Match surface: submissions to the simultaneous-phase barrier.
    this.onMessage('pioche', (client, msg) =>
      this.guard(client, (uid) => {
        this.controller?.submitPioche(uid, msg);
        this.broadcastProjections();
      }),
    );
    this.onMessage('question', (client, msg) =>
      this.guard(client, (uid) => {
        // specialePlays carries placement choices; legacy specialeCardIds still accepted.
        const plays =
          msg.specialePlays ?? (msg.specialeCardIds ?? []).map((cardId: string) => ({ cardId }));
        this.controller?.submitQuestion(uid, msg.intent, plays);
        this.broadcastProjections();
      }),
    );
    this.onMessage('declaration', (client, msg) =>
      this.guard(client, (uid) => {
        this.controller?.submitDeclaration(uid, msg);
        this.broadcastProjections();
      }),
    );
    // Explicit power activations (Sabotage / Refus royal / Clonage / Déduction /
    // Espionnage / Exécution). Public event via onPhaseEvent; private payloads unicast.
    this.onMessage('power', (client, msg) =>
      this.guard(client, (uid) => {
        this.controller?.activatePower(uid, msg);
        this.broadcastProjections();
      }),
    );
  }

  override onDispose(): void {
    recordRoomClosed();
    for (const grace of this.graceByUser.values()) grace.reject();
    this.graceByUser.clear();
    unregisterRoom(this.roomCode);
  }

  private registryPhase(): RoomPhase {
    if (!this.started) return 'LOBBY';
    return this.controller?.state.status === 'terminee' ? 'ENDED' : 'IN_PROGRESS';
  }

  // ---- auth & join (wog-room.md §6.1) ----------------------------------------

  override async onAuth(_client: Client, options: JoinOptions): Promise<{ userId: string; displayName: string }> {
    // Session S-JWT (NOT the handoff token) authorises the socket. Handoff already exchanged.
    let claims;
    try {
      claims = verifySession(options.sessionToken, this.sessionSecret);
    } catch {
      throw new ServerError(401, 'UNAUTHORIZED');
    }
    const userId = claims.sub;

    // Code match — a join addressed to another room's code must not land here.
    if (options.roomCode !== undefined && normalizeRoomCode(options.roomCode) !== this.roomCode) {
      throw new ServerError(400, 'BAD_CODE');
    }
    // Duplicate-account guard: the seat is genuinely live in another tab (§5.4).
    const existingSeat = this.accountToSeat.get(userId);
    if (existingSeat !== undefined && this.slots[existingSeat]?.conn === 'CONNECTED') {
      throw new ServerError(409, 'ALREADY_IN_ROOM');
    }
    // Joiners only in LOBBY (mid-match re-entry is reconnect-only).
    if (this.started) {
      throw new ServerError(409, 'ROOM_IN_PROGRESS');
    }
    // Capacity: full only when every CONFIGURED slot is bound (not at MAX_PLAYERS).
    if (existingSeat === undefined && this.slots.every((s) => s.userId !== null)) {
      throw new ServerError(409, 'ROOM_FULL');
    }
    return { userId, displayName: claims.displayName ?? userId };
  }

  override onJoin(client: Client, _options: JoinOptions, auth?: { userId: string; displayName: string }): void {
    if (!auth) return;
    recordPlayerConnected();
    const { userId, displayName } = auth;
    client.userData = { userId };
    this.clientByUser.set(userId, client);

    // Re-bind the account's own seat if it is held in a lobby grace window, else next free.
    let seatId = this.accountToSeat.get(userId) ?? -1;
    if (seatId >= 0) {
      this.graceByUser.get(userId)?.reject();
    } else {
      seatId = this.slots.findIndex((s) => s.userId === null);
      if (seatId < 0) throw new ServerError(409, 'ROOM_FULL'); // defense-in-depth
    }
    this.slots[seatId] = { userId, displayName, ready: false, conn: 'CONNECTED' };
    this.accountToSeat.set(userId, seatId);

    // The first connection becomes host (§6.1).
    const isFirst = this.hostSeat < 0;
    if (isFirst) this.hostSeat = seatId;
    client.send(isFirst ? 'ROOM_CREATED' : 'JOIN_OK', {
      roomCode: this.roomCode,
      seatId,
      hostSeat: this.hostSeat,
    });
    this.broadcastLobby();
  }

  // ---- leave / refresh / drop (wog-room.md §5) --------------------------------

  override async onLeave(client: Client, consented: boolean): Promise<void> {
    const userId = client.userData?.userId as string | undefined;
    if (!userId) return;
    recordPlayerDisconnected();
    this.clientByUser.delete(userId);

    if (this.started && this.controller) {
      await this.handleInMatchDisconnect(client, userId, consented);
      return;
    }

    // LOBBY branch. A consented leave frees the seat; an unconsented drop (refresh, tab
    // close) opens a 60 s grace window with the seat held (§5.1).
    if (consented) {
      this.freeSeat(userId);
      this.broadcastLobby();
      return;
    }
    const seatId = this.accountToSeat.get(userId);
    if (seatId === undefined) return; // already freed via LEAVE_ROOM
    this.slots[seatId]!.conn = 'DISCONNECTED';
    this.slots[seatId]!.ready = false;
    this.broadcastLobby();
    try {
      await this.openGrace(client, userId, LOBBY_RECONNECT_GRACE_S);
      // Reconnected: same client instance is live again. onJoin does not re-run.
      recordPlayerConnected();
      this.clientByUser.set(userId, client);
      const seat = this.accountToSeat.get(userId);
      if (seat !== undefined) this.slots[seat]!.conn = 'CONNECTED';
      client.send('JOIN_OK', { roomCode: this.roomCode, seatId: seat, hostSeat: this.hostSeat });
      this.broadcastLobby();
    } catch {
      // Grace expired (or cancelled): free the seat — lobby seats are re-bindable.
      this.freeSeat(userId);
      this.broadcastLobby();
    }
  }

  /** §5.2/§5.5: single drop → hold the seat + auto-pass; two concurrent drops → abort. */
  private async handleInMatchDisconnect(client: Client, userId: string, consented: boolean): Promise<void> {
    const state = this.controller!.state;
    const p = state.players[userId];
    if (!p) return;
    p.connected = false;
    const seatId = this.accountToSeat.get(userId);
    if (seatId !== undefined) this.slots[seatId]!.conn = 'DISCONNECTED';
    this.broadcast('CONN_STATUS', { userId, conn: 'DISCONNECTED' });

    const dropped = state.seatOrder.filter((uid) => {
      const pl = state.players[uid];
      return pl?.alive && !pl.connected;
    });
    if (dropped.length >= 2 && state.status !== 'terminee') {
      this.abortMatch();
      return;
    }

    // The match continues: the barrier no longer counts this seat, so if it was the last
    // holdout the phase advances now (auto-pass — play never blocks).
    this.controller!.onConnectivityChange();
    this.broadcastProjections();

    if (consented || state.status === 'terminee') return;
    try {
      await this.openGrace(client, userId, MATCH_RECONNECT_GRACE_S);
      recordPlayerConnected();
      this.clientByUser.set(userId, client);
      p.connected = true;
      if (seatId !== undefined) this.slots[seatId]!.conn = 'CONNECTED';
      // Never-send guarantee on resume: a fresh, fully-filtered projection for that seat
      // ONLY — the client must seed from this payload alone (§5.3).
      client.send('RECONNECT_OK', {
        roomCode: this.roomCode,
        seatId,
        hostSeat: this.hostSeat,
        state: project(this.controller!.state, userId, this.index ?? undefined),
      });
      this.broadcast('CONN_STATUS', { userId, conn: 'CONNECTED' });
      this.broadcastProjections();
    } catch {
      // Grace expired mid-match: the seat is gone for re-entry; the barrier keeps
      // auto-passing it so play never blocks.
      this.controller?.onConnectivityChange();
    }
  }

  private async openGrace(client: Client, userId: string, seconds: number): Promise<void> {
    const deferred = this.allowReconnection(client, seconds);
    this.graceByUser.set(userId, { reject: () => deferred.reject() });
    try {
      await deferred;
    } finally {
      this.graceByUser.delete(userId);
    }
  }

  /** §5.5: cancel graces, rebuild a fresh lobby from the surviving connected seats. */
  private abortMatch(): void {
    const state = this.controller?.state;
    for (const grace of this.graceByUser.values()) grace.reject();
    this.graceByUser.clear();

    // Preserve configured seat count and survivors' seat indices; free dropped seats.
    for (const slot of this.slots) {
      if (!slot.userId) continue;
      const pl = state?.players[slot.userId];
      if (pl && pl.connected) {
        slot.ready = false;
        slot.conn = 'CONNECTED';
      } else {
        this.accountToSeat.delete(slot.userId);
        Object.assign(slot, emptySlot());
      }
    }
    const lowestBound = this.slots.findIndex((s) => s.userId !== null);
    this.hostSeat = lowestBound; // may be -1 if everyone dropped; next join becomes host
    this.controller = null;
    this.index = null;
    this.started = false;
    this.unlock();
    // No character/score reveal on abort. Everyone lands back in this room's lobby.
    this.broadcast('MATCH_ABORTED', { message: 'Partie interrompue : plusieurs joueurs déconnectés.' });
    this.broadcastLobby();
  }

  private freeSeat(userId: string): void {
    const seatId = this.accountToSeat.get(userId);
    if (seatId === undefined) return;
    this.accountToSeat.delete(userId);
    this.slots[seatId] = emptySlot();
    if (this.hostSeat === seatId) {
      this.hostSeat = this.slots.findIndex((s) => s.userId !== null);
    }
  }

  // ---- lobby actions (wog-room.md §4.2) ---------------------------------------

  private setReady(userId: string, ready: boolean): void {
    this.assertLobby();
    const seatId = this.accountToSeat.get(userId);
    if (seatId === undefined) return;
    this.slots[seatId]!.ready = ready;
    this.broadcastLobby();
  }

  private addSeat(userId: string): void {
    this.assertLobby();
    this.assertHost(userId);
    if (this.slots.length >= MAX_PLAYERS) throw new Error(`Maximum ${MAX_PLAYERS} sièges.`);
    this.slots.push(emptySlot());
    this.broadcastLobby();
  }

  /**
   * Minimum de sièges effectif : 2 quand l'hôte est un compte admin (partie de test),
   * sinon la règle normale MIN_PLAYERS. Recalculé à chaque appel — une migration d'hôte
   * (départ de l'admin) restaure la règle des 4.
   */
  private minSeats(): number {
    const host = this.slots[this.hostSeat];
    return host?.userId && ADMIN_USER_IDS.has(host.userId) ? ABSOLUTE_MIN_PLAYERS : MIN_PLAYERS;
  }

  private removeSeat(userId: string): void {
    this.assertLobby();
    this.assertHost(userId);
    if (this.slots.length <= this.minSeats()) throw new Error(`Minimum ${this.minSeats()} sièges.`);
    if (this.slots[this.slots.length - 1]!.userId !== null) {
      throw new Error('Le dernier siège est occupé.'); // trailing-empty-only, indices stay stable
    }
    this.slots.pop();
    this.broadcastLobby();
  }

  private consentedLeave(userId: string): void {
    if (this.started) return; // in-match leave goes through onLeave(consented)
    this.freeSeat(userId);
    this.broadcastLobby();
  }

  private canStart(): boolean {
    return (
      this.slots.length >= this.minSeats() &&
      this.slots.length <= MAX_PLAYERS &&
      this.slots.every((s) => s.userId !== null && s.ready && s.conn === 'CONNECTED')
    );
  }

  private startMatch(userId: string): void {
    this.assertLobby();
    this.assertHost(userId);
    if (!this.canStart()) {
      throw new Error(`Il faut ${this.minSeats()}–${MAX_PLAYERS} joueurs, tous prêts et connectés.`);
    }
    const seatInputs: SeatInput[] = this.slots.map((s) => ({ userId: s.userId!, displayName: s.displayName }));
    const seed = Math.floor(Math.random() * 0xffffffff);
    const { state, index } = createGame(this.roomId, seatInputs, seed);
    this.index = index;
    this.controller = new MatchController(
      state,
      index,
      (e) => this.onPhaseEvent(e),
      // Never-send: private reveals (Déduction / Espionnage / Spéciale 1) unicast only.
      (userId, reveal) => this.clientByUser.get(userId)?.send('reveal', reveal),
    );
    this.started = true;
    this.matchStartedAt = new Date();
    this.matchPlayerIds = seatInputs.map((s) => s.userId);
    this.lock(); // no new joiners mid-match (reconnects still allowed)
    // The start signal is the first per-seat projection ('state'), wog-room.md §4.3.
    this.broadcastProjections();
  }

  private assertLobby(): void {
    if (this.started) throw new Error('La partie est déjà lancée.');
  }

  private assertHost(userId: string): void {
    if (this.accountToSeat.get(userId) !== this.hostSeat) {
      throw new Error("Réservé à l'hôte.");
    }
  }

  // ---- outbound ---------------------------------------------------------------

  private lobbyState(): {
    roomCode: string;
    hostSeat: number;
    seats: SeatInfo[];
    canStart: boolean;
    minSeats: number;
    maxSeats: number;
  } {
    return {
      roomCode: this.roomCode,
      hostSeat: this.hostSeat,
      seats: this.slots.map((s, i) => ({
        seatId: i,
        occupied: s.userId !== null,
        displayName: s.displayName,
        ready: s.ready,
        conn: s.conn,
      })),
      canStart: this.canStart(),
      // Le minimum EFFECTIF (2 pour un hôte admin) : le client s'en sert pour borner
      // « Retirer un siège » et pour le libellé d'attente.
      minSeats: this.minSeats(),
      maxSeats: MAX_PLAYERS,
    };
  }

  private broadcastLobby(): void {
    this.broadcast('LOBBY_STATE', this.lobbyState());
  }

  /** Unicast reply to REQUEST_STATE: a fresh filtered projection mid-match, else lobby. */
  private sendResumeState(client: Client, userId: string): void {
    if (this.started && this.controller && this.controller.state.players[userId]) {
      client.send('RECONNECT_OK', {
        roomCode: this.roomCode,
        seatId: this.accountToSeat.get(userId),
        hostSeat: this.hostSeat,
        state: project(this.controller.state, userId, this.index ?? undefined),
      });
      return;
    }
    client.send('LOBBY_STATE', this.lobbyState());
  }

  private onPhaseEvent(e: PhaseEvent): void {
    this.broadcast('event', e);
    this.broadcastProjections();
    if (e.type === 'gameOver') {
      this.broadcast('gameOver', { winner: e.winner });
      // Completed matches only — an abandoned room (dispose without gameOver)
      // is not a played game for the platform stats.
      if (!this.matchReported && this.matchStartedAt) {
        this.matchReported = true;
        // e.winner is already a platform account id; the platform only accepts
        // a winner who is a participant, so guard with matchPlayerIds.
        const winner = e.winner;
        void reportMatch({
          playerAccountIds: this.matchPlayerIds,
          startedAt: this.matchStartedAt,
          endedAt: new Date(),
          ...(winner && this.matchPlayerIds.includes(winner)
            ? { winnerAccountIds: [winner] }
            : {}),
        });
      }
    }
  }

  private pushProjection(userId: string): void {
    const state = this.controller?.state;
    const client = this.clientByUser.get(userId);
    if (!state || !client) return;
    client.send('state', project(state, userId, this.index ?? undefined));
  }

  private broadcastProjections(): void {
    const state = this.controller?.state;
    if (!state) return;
    for (const uid of Object.keys(state.players)) this.pushProjection(uid);
  }

  /** Derive the actor from the connection; surface rejections to the sender only. */
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
