/**
 * PantheonsRoom — thin Colyseus transport adapter over MatchController, carrying the WoG
 * room model (wog-room.md): room codes, a host/ready lobby with configurable seat slots
 * (min 4 / max 7), computers on free seats (#1838), reconnection grace windows, duplicate-account
 * rejection. In a match, disconnection follows the common gosgames system (game-kit.md §3.3,
 * implemented in match-runner.ts): 60 s grace, then a computer takes the seat and finishes the game
 * (match flagged), and the match is abandoned when no person is left.
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
import { type MatchController, type PhaseEvent } from './barrier.js';
import { MatchRunner, MATCH_GRACE_MS } from './match-runner.js';
import { redactEvent } from './events.js';
import { generateRoomCode, normalizeRoomCode } from './room-code.js';
import { isCodeTaken, registerRoom, unregisterRoom, type RoomPhase } from './room-registry.js';
import { type SessionEnder } from './session-directory.js';
import { verifySession } from '../auth/session.js';
import { reportMatch } from '../http/matchReport.js';
import { PresenceManager } from './presence-manager.js';
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
  /** #1838: a computer the host put on this seat (userId is synthetic, never a platform account). */
  computer?: boolean;
}

export interface SeatInfo {
  seatId: number;
  occupied: boolean;
  displayName: string;
  ready: boolean;
  conn: ConnStatus;
  computer: boolean;
}

// Grace windows (wog-room.md §5.1, game-kit.md §3.3): 60 s in lobby and in match.
export const LOBBY_RECONNECT_GRACE_S = 60;
export const MATCH_RECONNECT_GRACE_S = MATCH_GRACE_MS / 1000;
export const COMPUTER_NAME = 'Ordinateur';
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
  return { userId: null, displayName: '', ready: false, conn: 'CONNECTED', computer: false };
}

export class PantheonsRoom extends Room implements SessionEnder {
  override maxClients = MAX_PLAYERS;

  private roomCode = '';
  private slots: SeatSlot[] = Array.from({ length: DEFAULT_SEATS }, emptySlot);
  private hostSeat = -1;
  private accountToSeat = new Map<string, number>();
  private clientByUser = new Map<string, Client>();
  /** Pending reconnection grace windows, cancellable on abort (userId -> rejecter). */
  private graceByUser = new Map<string, { reject: () => void }>();
  /**
   * Active-game presence (login_all_games.md §A). One lease per account; the lease outlives
   * an in-grace reconnect (the seat is held → the lease stays leased) and is released only
   * when the seat truly goes away or the room disposes. One live lease per userId at all
   * times (O5), so a re-bind on onJoin never double-starts.
   */
  private presenceMgr = new PresenceManager(
    (userId) => this.sessionRef(userId),
    this,
    // 409 supersede: the account claimed the lease elsewhere → tear this session down with
    // the standard exit and stop heartbeating (the lease is no longer ours: don't re-end).
    (userId) => this.forceEndSession(userId, 'remote', /* releaseLease */ false),
  );

  private controller: MatchController | null = null;
  private runner: MatchRunner | null = null;
  private abandoned = false;
  private computerCounter = 0;
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
    // #1838: the host puts a computer on a free seat / removes it (lobby only).
    this.onMessage('ADD_COMPUTER', (client, msg: { seatId?: number }) =>
      this.guard(client, (uid) => this.addComputer(uid, msg?.seatId)),
    );
    this.onMessage('REMOVE_COMPUTER', (client, msg: { seatId?: number }) =>
      this.guard(client, (uid) => this.removeComputer(uid, msg?.seatId)),
    );
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
    // Exécution (#1832): the asker's choice at a « oui » (msg.target = userId, or null = decline).
    this.onMessage('execution', (client, msg) =>
      this.guard(client, (uid) => {
        this.controller?.submitExecution(uid, typeof msg?.target === 'string' ? msg.target : null);
        this.broadcastProjections();
      }),
    );
    // Spéciales 2, 4, 7, 8 (#1835): the owner's choice when it triggers (msg.choice, null = auto-pick).
    this.onMessage('speciale', (client, msg) =>
      this.guard(client, (uid) => {
        this.controller?.submitSpeciale(uid, msg?.choice && typeof msg.choice === 'object' ? msg.choice : null);
        this.broadcastProjections();
      }),
    );
    // Non 1-2 (#1836): the questioned player's choice of the 2 cards he gives (msg.cardIds).
    this.onMessage('donnez', (client, msg) =>
      this.guard(client, (uid) => {
        const ids = Array.isArray(msg?.cardIds) && msg.cardIds.every((c: unknown) => typeof c === 'string') ? msg.cardIds : null;
        if (!ids) throw new Error('Choisissez les cartes à donner.');
        this.controller?.submitDonnez(uid, ids);
        this.broadcastProjections();
      }),
    );
    // #1834: a Sabotage holder passes in the Sabotage window.
    this.onMessage('sabotagePass', (client) =>
      this.guard(client, (uid) => {
        this.controller?.submitSabotagePass(uid);
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
    this.runner?.dispose();
    // Release any leases still held (login_all_games.md §A): the room is gone.
    for (const userId of this.presenceMgr.liveUsers()) {
      this.presenceMgr.release(userId, 'server_shutdown');
    }
    unregisterRoom(this.roomCode);
  }

  private registryPhase(): RoomPhase {
    if (!this.started) return 'LOBBY';
    if (this.abandoned) return 'ENDED';
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
    this.slots[seatId] = { userId, displayName, ready: false, conn: 'CONNECTED', computer: false };
    this.accountToSeat.set(userId, seatId);

    // Active-game presence (login_all_games.md §A): a genuinely fresh session established
    // → claim the lease. An in-grace reconnect does NOT re-run onJoin, so the existing
    // lease is left untouched (no second lease per account — O5). begin() is itself a
    // no-op when a lease is already held (defense-in-depth).
    this.presenceMgr.begin(userId);

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

    if (this.started && this.runner) {
      await this.handleInMatchDisconnect(client, userId, consented);
      return;
    }

    // LOBBY branch. A consented leave frees the seat; an unconsented drop (refresh, tab
    // close) opens a 60 s grace window with the seat held (§5.1).
    if (consented) {
      this.presenceMgr.release(userId, 'left'); // seat given up → release the lease
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
      // Reconnected: same client instance is live again. onJoin does not re-run, so the
      // presence lease was held throughout the grace and needs no re-start (O5).
      recordPlayerConnected();
      this.clientByUser.set(userId, client);
      const seat = this.accountToSeat.get(userId);
      if (seat !== undefined) this.slots[seat]!.conn = 'CONNECTED';
      client.send('JOIN_OK', { roomCode: this.roomCode, seatId: seat, hostSeat: this.hostSeat });
      this.broadcastLobby();
    } catch {
      // Grace expired (or cancelled): the seat is truly gone → release the lease.
      this.presenceMgr.release(userId, 'timeout');
      this.freeSeat(userId);
      this.broadcastLobby();
    }
  }

  /**
   * game-kit.md §3.3: a dropped person gets the grace (the barrier stops waiting for the seat and
   * its pending choices are auto-picked, #1834); not back in 60 s, a computer takes the seat and
   * finishes the game (the runner flags the match); a consented leave skips the grace.
   */
  private async handleInMatchDisconnect(client: Client, userId: string, consented: boolean): Promise<void> {
    const runner = this.runner!;
    const state = runner.controller.state;
    if (!state.players[userId]) return;
    const seatId = this.accountToSeat.get(userId);
    if (seatId !== undefined) this.slots[seatId]!.conn = 'DISCONNECTED';
    this.broadcast('CONN_STATUS', { userId, conn: 'DISCONNECTED' });

    if (state.status === 'terminee' || this.abandoned) {
      this.presenceMgr.release(userId, consented ? 'left' : 'timeout');
      return;
    }
    if (consented) {
      // The seat is given up for good: no grace, a computer takes it now.
      this.presenceMgr.release(userId, 'left');
      runner.left(userId);
      this.broadcastProjections();
      return;
    }
    runner.drop(userId); // grace timer (fake-clock testable) + auto-pick while absent
    this.broadcastProjections();
    try {
      // The runner's own 60 s timer decides; Colyseus' window is only a little longer so the
      // reconnection token stays valid until then, and runner.onSeatTaken closes it.
      await this.openGrace(client, userId, MATCH_RECONNECT_GRACE_S + 5);
      if (!runner.returned(userId)) throw new Error('seat taken');
      recordPlayerConnected();
      this.clientByUser.set(userId, client);
      if (seatId !== undefined) this.slots[seatId]!.conn = 'CONNECTED';
      // Never-send guarantee on resume: a fresh, fully-filtered projection for that seat
      // ONLY — the client must seed from this payload alone (§5.3).
      client.send('RECONNECT_OK', {
        roomCode: this.roomCode,
        seatId,
        hostSeat: this.hostSeat,
        state: this.projectionFor(userId),
      });
      this.broadcast('CONN_STATUS', { userId, conn: 'CONNECTED' });
      this.broadcastProjections();
    } catch {
      // Grace over: the seat is a computer's now (or the match was abandoned); the lease goes.
      this.presenceMgr.release(userId, 'timeout');
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

  /** No person is left (game-kit.md §3.3): the match is abandoned, nothing is reported. */
  private abandonMatch(): void {
    this.abandoned = true;
    for (const grace of this.graceByUser.values()) grace.reject();
    this.graceByUser.clear();
    for (const userId of this.presenceMgr.liveUsers()) this.presenceMgr.release(userId, 'timeout');
    this.broadcast('MATCH_ABANDONED', { message: 'Partie abandonnée : plus aucun joueur.' });
    void this.disconnect();
  }

  private freeSeat(userId: string): void {
    const seatId = this.accountToSeat.get(userId);
    if (seatId === undefined) return;
    this.accountToSeat.delete(userId);
    this.slots[seatId] = emptySlot();
    if (this.hostSeat === seatId) {
      this.hostSeat = this.slots.findIndex((s) => s.userId !== null && !s.computer); // never a computer
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

  /** #1838: host only, lobby only. A computer counts as filled and ready. */
  private addComputer(userId: string, seatId?: number): void {
    this.assertLobby();
    this.assertHost(userId);
    let seat = Number.isInteger(seatId) ? (seatId as number) : this.slots.findIndex((s) => s.userId === null);
    if (seat < 0) {
      if (this.slots.length >= MAX_PLAYERS) throw new Error('Aucun siège libre.');
      this.slots.push(emptySlot());
      seat = this.slots.length - 1;
    }
    const slot = this.slots[seat];
    if (!slot || slot.userId !== null) throw new Error("Ce siège n'est pas libre.");
    this.computerCounter++;
    this.slots[seat] = {
      userId: `cpu-${this.computerCounter}`,
      displayName: `${COMPUTER_NAME} ${this.computerCounter}`,
      ready: true,
      conn: 'CONNECTED',
      computer: true,
    };
    this.broadcastLobby();
  }

  private removeComputer(userId: string, seatId?: number): void {
    this.assertLobby();
    this.assertHost(userId);
    const slot = Number.isInteger(seatId) ? this.slots[seatId as number] : undefined;
    if (!slot?.computer) throw new Error("Ce siège n'est pas un ordinateur.");
    this.slots[seatId as number] = emptySlot();
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
    this.abandoned = false;
    this.runner = new MatchRunner(
      state,
      index,
      this.slots.filter((s) => s.computer).map((s) => s.userId!),
      {
        emit: (e) => this.onPhaseEvent(e),
        // Never-send: private reveals (Déduction / Espionnage / Spéciale 1) unicast only.
        emitPrivate: (userId, reveal) => this.clientByUser.get(userId)?.send('reveal', reveal),
        // #1834: a window closed / a computer moved -> everyone gets the new projection.
        onChange: () => this.broadcastProjections(),
        onSeatTaken: (userId) => {
          this.graceByUser.get(userId)?.reject(); // the person's reconnection window closes
          this.broadcast('CONN_STATUS', { userId, conn: 'COMPUTER' });
        },
        onAbandon: () => this.abandonMatch(),
      },
    );
    this.controller = this.runner.controller;
    this.started = true;
    this.matchStartedAt = new Date();
    // Only persons are platform players: a computer has no account.
    this.matchPlayerIds = this.slots.filter((s) => !s.computer).map((s) => s.userId!);
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
        computer: s.computer === true,
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
        state: this.projectionFor(userId),
      });
      return;
    }
    client.send('LOBBY_STATE', this.lobbyState());
  }

  private onPhaseEvent(e: PhaseEvent): void {
    // #1839 (P12): never broadcast the raw event; each seat gets its own redacted copy.
    for (const [uid, client] of this.clientByUser) client.send('event', redactEvent(e, uid));
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
          // game-kit.md §3.3: a computer held a seat, so the stats can leave the match out.
          ...(this.runner && this.runner.computerSeats().length > 0 ? { botReplaced: true } : {}),
          ...(winner && this.matchPlayerIds.includes(winner)
            ? { winnerAccountIds: [winner] }
            : {}),
        });
      }
    }
  }

  private projectionFor(userId: string) {
    return project(this.controller!.state, userId, this.index ?? undefined);
  }

  private pushProjection(userId: string): void {
    const state = this.controller?.state;
    const client = this.clientByUser.get(userId);
    if (!state || !client) return;
    client.send('state', this.projectionFor(userId));
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

  // ---- active-game presence (login_all_games.md §A/§B) ------------------------

  /**
   * sessionRef contract: game-generated, stable for the session, `[A-Za-z0-9._:-]{1,128}`.
   * `${roomId}:${userId}` is stable across an in-grace reconnect (roomId + userId are both
   * constant for the seat) and unique per player-session.
   */
  private sessionRef(userId: string): string {
    return `${this.roomId}:${userId}`;
  }

  /**
   * Tear down the local session for a userId (409 superseded OR a platform remote-end),
   * so the player sees the standard "playing elsewhere" exit — never a raw socket drop.
   *
   * `releaseLease` is false for a 409 supersede (the lease already belongs to the new
   * session — we must NOT emit an `end` for it: the manager `drop`s it), true for a
   * remote-end (§B: we tear down and `end` the lease). Idempotent: an already-gone userId
   * is a noop.
   */
  private forceEndSession(userId: string, cause: 'remote', releaseLease: boolean): void {
    const hadPresence = this.presenceMgr.has(userId);
    // Stop heartbeating + release (remote-end) or drop without ending (supersede).
    if (releaseLease) this.presenceMgr.release(userId, 'remote_end');
    else this.presenceMgr.drop(userId);
    if (!hadPresence && !this.clientByUser.has(userId)) return; // already gone → idempotent noop

    const client = this.clientByUser.get(userId);
    // Cancel any in-flight grace so the seat is not held after a remote end.
    this.graceByUser.get(userId)?.reject();

    // Show the standard exit (D) then disconnect: message first so the client can render
    // the exit screen before the socket closes.
    if (client) {
      client.send('SESSION_ENDED', { cause });
      // 4000 = consented-leave close code: the client treats this as an intentional end,
      // not a "connection lost / reconnecting" banner.
      client.leave(4000);
    }

    // Detach the seat so the account is fully released locally (no ghost lease, O5).
    this.clientByUser.delete(userId);
    if (this.started && this.runner && this.controller) {
      // The person gave the session up (superseded / remote end): no grace, a computer takes the seat.
      const seatId = this.accountToSeat.get(userId);
      if (seatId !== undefined) this.slots[seatId]!.conn = 'DISCONNECTED';
      this.broadcast('CONN_STATUS', { userId, conn: 'DISCONNECTED' });
      this.runner.left(userId);
      this.broadcastProjections();
    } else {
      this.freeSeat(userId);
      this.broadcastLobby();
    }
  }

  /**
   * Platform → game remote-end (login_all_games.md §B). Tear down the identified live
   * session(s) for `userId`. Returns the number of sessions ended (0 = already gone, still
   * a 200 to the caller — idempotent). If `sessionRef` is given and matches exactly one
   * live session, only that ends; a missing/unknown sessionRef with exactly one live
   * session for the user ends that one; otherwise ALL live sessions for the user end.
   */
  endSessionsForUser(userId: string, _sessionRef?: string): number {
    const isLive = this.presenceMgr.has(userId) || this.clientByUser.has(userId);
    if (!isLive) return 0; // idempotent: already-gone sessionRef still 200

    // This room holds at most one live session per userId (O5), so every §B branch — a
    // matching sessionRef, a missing/unknown sessionRef with one live session, and the
    // end-all case — collapses to "end this user's single live session here". sessionRef
    // is therefore advisory (accepted, not required to match) for this game.
    this.forceEndSession(userId, 'remote', /* releaseLease */ true);
    return 1;
  }
}
