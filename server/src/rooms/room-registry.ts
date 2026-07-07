/**
 * code → room registry (wog-room.md §6.1). Colyseus rooms are in-process and ephemeral;
 * this module-level map lets the HTTP layer answer `GET /api/rooms/:code/exists` without
 * opening a socket to a dead room, and lets joins resolve a code to a roomId.
 */
export type RoomPhase = 'LOBBY' | 'IN_PROGRESS' | 'ENDED';

interface RegistryEntry {
  roomId: string;
  getPhase: () => RoomPhase;
}

const byCode = new Map<string, RegistryEntry>();

export function registerRoom(code: string, roomId: string, getPhase: () => RoomPhase): void {
  byCode.set(code, { roomId, getPhase });
}

export function unregisterRoom(code: string): void {
  byCode.delete(code);
}

export function lookupRoom(code: string): { roomId: string; phase: RoomPhase } | null {
  const entry = byCode.get(code);
  return entry ? { roomId: entry.roomId, phase: entry.getPhase() } : null;
}

/** A free code for a new room (collisions are re-rolled by the caller). */
export function isCodeTaken(code: string): boolean {
  return byCode.has(code);
}
