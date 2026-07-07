/**
 * Active-room baton (wog-room.md §2.4/§5): carries a *live* Colyseus Room across a
 * client-side navigate (React can't route a live socket through props). Deliberately
 * module-level: a full reload empties it, which is what routes a reloaded page down the
 * reconnect path instead.
 *
 * It also implements the StrictMode-safe deferred teardown (§3.3): RoomScreen re-deposits
 * the room on unmount with a short fuse; a dev double-mount (or an adopt on the next
 * screen) re-takes it and cancels the fuse; a genuine departure lets the fuse fire
 * `leave(false)` — an unconsented drop, so the server opens the reconnection grace window.
 */
import type { Room } from 'colyseus.js';

export interface ActiveRoom {
  room: Room;
  roomCode: string;
  seatId: number;
  hostSeat: number;
}

let holder: ActiveRoom | null = null;
let fuse: ReturnType<typeof setTimeout> | null = null;

export function setActiveRoom(active: ActiveRoom): void {
  if (fuse) {
    clearTimeout(fuse);
    fuse = null;
  }
  holder = active;
}

/** Adopt the live room for this code, if the baton holds one. Cancels any pending fuse. */
export function peekActiveRoom(roomCode: string): ActiveRoom | null {
  if (!holder || holder.roomCode !== roomCode) return null;
  if (fuse) {
    clearTimeout(fuse);
    fuse = null;
  }
  const active = holder;
  holder = null;
  return active;
}

export function clearActiveRoom(): void {
  if (fuse) {
    clearTimeout(fuse);
    fuse = null;
  }
  holder = null;
}

/** §3.3: deposit + schedule leave(false) unless re-adopted within a tick. */
export function depositForTeardown(active: ActiveRoom): void {
  setActiveRoom(active);
  fuse = setTimeout(() => {
    fuse = null;
    if (holder?.room === active.room) {
      holder = null;
      try {
        active.room.leave(false); // NOT consented: server holds the seat for the grace window
      } catch {
        /* socket already gone */
      }
    }
  }, 100);
}
