/**
 * App-load entry resolution (wog-room.md §1), adapted to Pantheons' session model
 * (Decision 4: handoff token exchanged once for the game's own session S-JWT; the client
 * holds the S-JWT in sessionStorage — no cookie).
 *
 * Exactly one of two outcomes: `authenticated` or `bounce`.
 *  1. Handoff token in the URL fragment → exchange. A present token is a fresh identity
 *     assertion: on 401 we bounce, we do NOT fall back to a stored session.
 *  2. No fragment → stored session (refresh-survival path), if not expired.
 *  3. Neither → bounce to the platform launch deep-link.
 */
import { consumeHandoffFragment, exchangeHandoff, loadSession, type Session } from '../auth/handoff.js';

export const PLATFORM_LAUNCH_URL = 'https://www.gosgames.com/api/launch/pantheons';

export type EntryResult = { outcome: 'authenticated'; session: Session } | { outcome: 'bounce' };

function sessionLooksValid(session: Session): boolean {
  // The S-JWT carries exp; reject an obviously expired token without a server round-trip
  // (the socket handshake re-verifies authoritatively on every join).
  try {
    const payload = JSON.parse(atob(session.sessionToken.split('.')[1] ?? '')) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function resolveEntry(serverHttpUrl: string): Promise<EntryResult> {
  const token = consumeHandoffFragment();
  if (token) {
    try {
      const session = await exchangeHandoff(serverHttpUrl, token);
      return { outcome: 'authenticated', session };
    } catch {
      return { outcome: 'bounce' };
    }
  }
  const stored = loadSession();
  if (stored && sessionLooksValid(stored)) {
    return { outcome: 'authenticated', session: stored };
  }
  return { outcome: 'bounce' };
}

/** Top-level redirect to the platform launcher. */
export function bounceToPlatform(): void {
  window.location.replace(PLATFORM_LAUNCH_URL);
}
