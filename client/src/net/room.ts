/**
 * Colyseus client wrapper (wog-room.md §2–§3). The server sends PER-CLIENT projections via
 * 'state' messages (never automatic shared state — that's the never-send boundary).
 *
 * Join-by-code resolves the code to a roomId through the existence probe, then joins by id;
 * the server re-checks the code in onAuth (BAD_CODE) as defense-in-depth.
 */
import { Client, type Room } from 'colyseus.js';

export type RoomPhase = 'LOBBY' | 'IN_PROGRESS' | 'ENDED';

export interface SeatInfo {
  seatId: number;
  occupied: boolean;
  displayName: string;
  ready: boolean;
  conn: 'CONNECTED' | 'DISCONNECTED';
}

export interface LobbyState {
  roomCode: string;
  hostSeat: number;
  seats: SeatInfo[];
  canStart: boolean;
  minSeats: number;
  maxSeats: number;
}

export interface RoomWelcome {
  roomCode: string;
  seatId: number;
  hostSeat: number;
}

export interface ExistsResult {
  exists: boolean;
  phase?: RoomPhase;
  roomId?: string;
}

/** §3.1 step 2: probe existence/phase without opening a socket to a dead room. */
export async function roomExists(serverHttpUrl: string, code: string): Promise<ExistsResult> {
  const res = await fetch(`${serverHttpUrl}/api/rooms/${encodeURIComponent(code)}/exists`);
  if (!res.ok) return { exists: false };
  return (await res.json()) as ExistsResult;
}

export function makeClient(wsUrl: string): Client {
  return new Client(wsUrl);
}

export async function createGameRoom(wsUrl: string, sessionToken: string): Promise<Room> {
  return makeClient(wsUrl).create('pantheons', { sessionToken });
}

export async function joinGameRoom(
  wsUrl: string,
  serverHttpUrl: string,
  sessionToken: string,
  code: string,
): Promise<Room> {
  const probe = await roomExists(serverHttpUrl, code);
  if (!probe.exists || !probe.roomId) throw new Error('BAD_CODE');
  return makeClient(wsUrl).joinById(probe.roomId, { sessionToken, roomCode: code });
}

export async function reconnectGameRoom(wsUrl: string, reconnectionToken: string): Promise<Room> {
  return makeClient(wsUrl).reconnect(reconnectionToken);
}

/** One-shot message wait with timeout (ROOM_CREATED / JOIN_OK / RECONNECT_OK handshakes). */
export function onceMessage<T>(room: Room, type: string, timeoutMs = 10_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    room.onMessage(type, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}
