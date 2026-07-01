/**
 * Colyseus client wrapper. The server sends PER-CLIENT projections via 'state' messages
 * (never automatic shared state — that's the never-send boundary). We just subscribe.
 */
import { Client, type Room } from 'colyseus.js';
import type { PlayerProjection } from '@pantheons/engine';

export interface LobbyState {
  players: { userId: string; displayName: string }[];
  canStart: boolean;
  min: number;
  max: number;
}

export interface RoomHandlers {
  onState?: (p: PlayerProjection) => void;
  onLobby?: (l: LobbyState) => void;
  onEvent?: (e: unknown) => void;
  onError?: (message: string) => void;
  onLeave?: () => void;
}

export async function joinRoom(
  wsUrl: string,
  sessionToken: string,
  handlers: RoomHandlers,
): Promise<Room> {
  const client = new Client(wsUrl);
  const room = await client.joinOrCreate('pantheons', { sessionToken });

  room.onMessage('state', (p: PlayerProjection) => handlers.onState?.(p));
  room.onMessage('lobby', (l: LobbyState) => handlers.onLobby?.(l));
  room.onMessage('event', (e: unknown) => handlers.onEvent?.(e));
  room.onMessage('error', (m: { message: string }) => handlers.onError?.(m.message));
  room.onMessage('gameOver', (e: unknown) => handlers.onEvent?.(e));
  room.onLeave(() => handlers.onLeave?.());
  return room;
}
