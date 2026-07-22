/**
 * Per-room presence-lease manager (login_all_games.md §A) — the reusable, Colyseus-free
 * core of the room's active-game presence. It owns, keyed by userId:
 *   - one PlatformPresence lease (start → heartbeat → end),
 *   - the 30 s heartbeat timer,
 *   - registration in the cross-room session directory (so §B remote-end can find it).
 *
 * The Room composes one of these and delegates begin/release; extracting it keeps the
 * lifecycle unit-testable without instantiating a full Colyseus Room.
 *
 * Invariant (O5 — one live lease per account per room): begin() is a no-op when a lease is
 * already held for the userId, and the guard in the room's onJoin means an in-grace
 * reconnect never re-begins.
 */
import { PlatformPresence, type PresenceEndReason } from '../http/platformPresence.js';
import { registerSession, unregisterSession, type SessionEnder } from './session-directory.js';

// Heartbeat cadence (login_all_games.md §C): 30 s while live. The platform expires a stale
// lease at 90 s, so three missed beats releases it.
export const PRESENCE_HEARTBEAT_MS = 30_000;

interface Entry {
  presence: PlatformPresence;
  timer: ReturnType<typeof setInterval>;
}

export class PresenceManager {
  private readonly entries = new Map<string, Entry>();

  /**
   * @param sessionRefFor  builds the stable per-session ref for a userId.
   * @param room           the SessionEnder registered in the directory for §B remote-end.
   * @param onSuperseded   invoked (userId) when the platform reports a 409 supersede so the
   *                       room can tear the local session down with the standard exit.
   */
  constructor(
    private readonly sessionRefFor: (userId: string) => string,
    private readonly room: SessionEnder,
    private readonly onSuperseded: (userId: string) => void,
  ) {}

  has(userId: string): boolean {
    return this.entries.has(userId);
  }

  /** Claim the lease for a freshly established session + begin the heartbeat. Idempotent. */
  begin(userId: string): void {
    if (this.entries.has(userId)) return; // O5: never a second live lease
    const presence = new PlatformPresence({
      userId,
      sessionRef: this.sessionRefFor(userId),
      onSuperseded: () => this.onSuperseded(userId),
    });
    const timer = setInterval(() => void presence.heartbeat(), PRESENCE_HEARTBEAT_MS);
    // Don't keep the Node process alive for a heartbeat timer.
    (timer as { unref?: () => void }).unref?.();
    this.entries.set(userId, { presence, timer });
    registerSession(userId, this.room);
    void presence.start();
  }

  /** Stop the heartbeat and best-effort release the lease with the given reason. */
  release(userId: string, reason: PresenceEndReason): void {
    const entry = this.entries.get(userId);
    if (!entry) return;
    clearInterval(entry.timer);
    this.entries.delete(userId);
    unregisterSession(userId, this.room);
    void entry.presence.end(reason);
  }

  /**
   * Drop the local lease record WITHOUT emitting an end — used on a 409 supersede, where
   * the lease already belongs to the new session so we must not `end` it.
   */
  drop(userId: string): void {
    const entry = this.entries.get(userId);
    if (!entry) return;
    clearInterval(entry.timer);
    this.entries.delete(userId);
    unregisterSession(userId, this.room);
  }

  /** userIds with a live lease (snapshot). */
  liveUsers(): string[] {
    return [...this.entries.keys()];
  }
}
