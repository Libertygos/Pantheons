/**
 * Client-side handoff intake (Decision 4). Read the platform handoff token from the URL
 * FRAGMENT, clear it IMMEDIATELY (so it never lingers in history/referrers), then exchange
 * it once for the game's own session S-JWT. The handoff token is never stored.
 */
const SESSION_KEY = 'pantheons.session';

export interface Session {
  sessionToken: string;
  userId: string;
  /** Platform display name (absent on sessions stored before it was returned). */
  displayName?: string;
}

/** Extract `#token=...` from the fragment and wipe the fragment. Returns the raw token. */
export function consumeHandoffFragment(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const token = params.get('token');
  // Clear the fragment immediately, regardless of outcome.
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}

/** Exchange the handoff token for a session at the server. */
export async function exchangeHandoff(serverHttpUrl: string, token: string): Promise<Session> {
  const res = await fetch(`${serverHttpUrl}/auth/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error('handoff_rejected');
  const data = (await res.json()) as Session;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  return data;
}

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

/** Sign-out: drop the stored session (there is no server-side cookie to clear). */
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/** Resolve a session: reuse a stored one, else consume + exchange a fresh handoff token. */
export async function resolveSession(serverHttpUrl: string): Promise<Session | null> {
  const token = consumeHandoffFragment();
  if (token) return exchangeHandoff(serverHttpUrl, token);
  return loadSession();
}
