/**
 * gosgames handoff-token verifier (T-11, [OPUS 🔒]) — Decision 4.
 *
 * The platform is the identity authority. Pantheons does NOT authenticate; it verifies a
 * short-lived handoff token minted by gosgames, then exchanges it for its OWN session
 * S-JWT. The handoff token is NEVER used as the session token.
 *
 * Verification contract (exact, per-tenant delta is aud only):
 *   - alg allowlist pinned to exactly ["HS256"]        (enforced in verifyJwt)
 *   - iss === "gosgames"
 *   - aud === "pantheons"                               (the only per-tenant value)
 *   - exp / iat within ±5s skew
 *   - access === true (exact boolean)
 *   - sub is the platform user_id
 *
 * Client-side discipline (see client/src/auth/handoff.ts): read the token from the URL
 * FRAGMENT, clear it immediately, POST it here once, store only the returned session token.
 *
 * ⚠️ Stop after commit. Do NOT push — Jules reviews the diff before merge.
 */
import { JwtError, verifyJwt, type JwtClaims } from './jwt.js';

export const EXPECTED_ISS = 'gosgames';
export const EXPECTED_AUD = 'pantheons';
export const MAX_SKEW_SECONDS = 5;

export interface HandoffClaims {
  sub: string; // platform user_id
  iss: 'gosgames';
  aud: 'pantheons';
  access: true;
  iat: number;
  exp: number;
  displayName?: string;
}

export class HandoffError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'HandoffError';
  }
}

/**
 * Verify a handoff token. `nowSeconds` is injectable for testing. Throws HandoffError on any
 * violation; returns the trusted claims on success. Fail closed on everything.
 */
export function verifyHandoffToken(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): HandoffClaims {
  let claims: JwtClaims;
  try {
    claims = verifyJwt(token, secret);
  } catch (e) {
    if (e instanceof JwtError) throw new HandoffError('SIGNATURE', `Handoff rejected: ${e.code}`);
    throw new HandoffError('SIGNATURE', 'Handoff rejected');
  }

  if (claims.iss !== EXPECTED_ISS) throw new HandoffError('ISS', `iss must be ${EXPECTED_ISS}`);
  if (claims.aud !== EXPECTED_AUD) throw new HandoffError('AUD', `aud must be ${EXPECTED_AUD}`);

  // access must be exactly boolean true.
  if (claims.access !== true) throw new HandoffError('ACCESS', 'access must be true');

  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') {
    throw new HandoffError('TIME', 'exp/iat required');
  }
  // iat must not be meaningfully in the future; exp must not be meaningfully past. ±5s skew.
  if (claims.iat - nowSeconds > MAX_SKEW_SECONDS) throw new HandoffError('IAT', 'iat in the future');
  if (nowSeconds - claims.exp > MAX_SKEW_SECONDS) throw new HandoffError('EXP', 'token expired');

  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new HandoffError('SUB', 'sub (user_id) required');
  }

  return {
    sub: claims.sub,
    iss: EXPECTED_ISS,
    aud: EXPECTED_AUD,
    access: true,
    iat: claims.iat,
    exp: claims.exp,
    ...(typeof claims.displayName === 'string' ? { displayName: claims.displayName } : {}),
  };
}
