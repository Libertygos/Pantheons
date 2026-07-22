/**
 * userId → live-session directory (login_all_games.md §B).
 *
 * Colyseus rooms are in-process and ephemeral; the platform's remote-end call arrives on
 * the HTTP layer with only a `{ userId, sessionRef }` and no room handle. This module-level
 * registry lets a room advertise the accounts it currently hosts so `POST
 * /internal/sessions/end` can reach the right room(s) and tear the session(s) down.
 *
 * A room registers when it claims an account's presence lease and unregisters when the
 * lease is released, so the directory tracks exactly the set of live local sessions.
 */

/** The slice of a room the directory needs: end this user's live session(s) here. */
export interface SessionEnder {
  /** Returns the number of sessions ended (0 = already gone). */
  endSessionsForUser(userId: string, sessionRef?: string): number;
}

/** userId → the rooms currently hosting a live session for that account. */
const byUser = new Map<string, Set<SessionEnder>>();

export function registerSession(userId: string, room: SessionEnder): void {
  let set = byUser.get(userId);
  if (!set) {
    set = new Set();
    byUser.set(userId, set);
  }
  set.add(room);
}

export function unregisterSession(userId: string, room: SessionEnder): void {
  const set = byUser.get(userId);
  if (!set) return;
  set.delete(room);
  if (set.size === 0) byUser.delete(userId);
}

/**
 * End every live session for `userId` (optionally scoped by `sessionRef`). Returns the
 * total number of sessions ended across all hosting rooms (0 = nothing live → the caller
 * still answers 200, idempotent per §B).
 */
export function endSessions(userId: string, sessionRef?: string): number {
  const set = byUser.get(userId);
  if (!set) return 0;
  let ended = 0;
  // Copy first: endSessionsForUser triggers unregisterSession, mutating the set.
  for (const room of [...set]) ended += room.endSessionsForUser(userId, sessionRef);
  return ended;
}

/** Test-only reset. */
export function clearSessionDirectory(): void {
  byUser.clear();
}
