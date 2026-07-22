/**
 * Active-game presence/lease reporting to the gosgames platform
 * (login_all_games.md, GAME-LOGIN-01…05 contract).
 *
 * The platform holds ONE authoritative "active-game lease" per account. This module
 * is the game→platform half of the internal presence channel — a separate channel
 * from the handoff JWT (no change to the handoff token).
 *
 *   POST {GOSGAMES_INTERNAL_URL}/api/internal/presence/start      -> { status: "leased" }
 *   POST {GOSGAMES_INTERNAL_URL}/api/internal/presence/heartbeat  -> { status: "alive" }
 *   POST {GOSGAMES_INTERNAL_URL}/api/internal/presence/end        -> { status: "ended" }
 *
 * Auth: the same shared X-Internal-Token header + INTERNAL_SERVICE_TOKEN as the match
 * report and the inbound deletion endpoint (one platform↔game service token).
 *
 * Best-effort by design (mirrors matchReport): presence must never break the game flow.
 * A missing configuration (base/token unset) is a silent no-op (local dev); a network
 * error is logged and swallowed, NEVER thrown — a failed POST must not crash the room.
 *
 * Two platform responses carry meaning and are surfaced to the caller (never thrown):
 *   - 409 { status: "superseded" } on start/heartbeat: the account took the lease
 *     elsewhere. We invoke the `onSuperseded` callback so the room can terminate this
 *     local session (the standard "you're now playing on another device" exit) and stop
 *     heartbeating.
 *   - 404 { status: "no_lease" } on heartbeat/end: the lease is already gone. Ignored —
 *     the player is never errored.
 */

export type PresenceEndReason = 'left' | 'logout' | 'timeout' | 'remote_end' | 'server_shutdown';

const GAME_SLUG = 'pantheons';

/** sessionRef contract: `[A-Za-z0-9._:-]{1,128}`. */
const SESSION_REF_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export function isValidSessionRef(ref: string): boolean {
  return SESSION_REF_RE.test(ref);
}

interface PresenceConfig {
  /** Platform user id (JWT `sub`). */
  userId: string;
  /** Game-generated, stable for the session. */
  sessionRef: string;
  /**
   * Invoked when the platform reports this session was superseded (409) by a lease taken
   * elsewhere. The room terminates the local session and shows the standard exit; the
   * lease already belongs to the new session, so we do NOT emit an `end` for it.
   */
  onSuperseded: () => void;
}

function endpoint(path: string): { url: string; token: string } | null {
  const base = (process.env.GOSGAMES_INTERNAL_URL ?? '').replace(/\/$/, '');
  const token = process.env.INTERNAL_SERVICE_TOKEN ?? '';
  if (!base || !token) return null;
  return { url: `${base}/api/internal/presence/${path}`, token };
}

/**
 * Per-session presence reporter. One instance per live local game session; it owns the
 * lease lifecycle (start → heartbeat* → end) and the "superseded" reaction.
 */
export class PlatformPresence {
  private readonly userId: string;
  private readonly sessionRef: string;
  private readonly onSuperseded: () => void;
  /** Latched once superseded/ended so late heartbeats become no-ops. */
  private closed = false;

  constructor(cfg: PresenceConfig) {
    this.userId = cfg.userId;
    this.sessionRef = cfg.sessionRef;
    this.onSuperseded = cfg.onSuperseded;
  }

  /** Report the session as established. Call right after onJoin binds the seat. */
  async start(startedAt: Date = new Date()): Promise<void> {
    if (this.closed) return;
    await this.post('start', {
      userId: this.userId,
      gameSlug: GAME_SLUG,
      sessionRef: this.sessionRef,
      startedAt: startedAt.toISOString(),
    });
  }

  /** Report the session still live. Call every 30s while the session runs. */
  async heartbeat(): Promise<void> {
    if (this.closed) return;
    await this.post('heartbeat', {
      userId: this.userId,
      gameSlug: GAME_SLUG,
      sessionRef: this.sessionRef,
    });
  }

  /** Release the lease. Call on leave / logout / room-close. Idempotent + best-effort. */
  async end(reason: PresenceEndReason): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.post('end', {
      userId: this.userId,
      gameSlug: GAME_SLUG,
      sessionRef: this.sessionRef,
      reason,
    });
  }

  private async post(path: 'start' | 'heartbeat' | 'end', body: Record<string, unknown>): Promise<void> {
    const target = endpoint(path);
    if (!target) return; // unconfigured -> silent no-op (local dev)

    let res: Response;
    try {
      res = await fetch(target.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': target.token },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[pantheons] presence/${path} failed`, err);
      return; // network error -> logged, swallowed, never thrown
    }

    // 409 superseded on start/heartbeat: the account took over elsewhere. Terminate this
    // session; do NOT re-`end` (the lease is no longer ours).
    if (res.status === 409 && (path === 'start' || path === 'heartbeat')) {
      this.closed = true;
      this.onSuperseded();
      return;
    }
    // 404 no_lease on heartbeat/end: already gone — ignore, never error the player.
    if (res.status === 404 && (path === 'heartbeat' || path === 'end')) {
      this.closed = true;
      return;
    }
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[pantheons] presence/${path} rejected: ${res.status} ${await res.text()}`);
    }
  }
}
