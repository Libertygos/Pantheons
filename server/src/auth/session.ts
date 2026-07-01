/**
 * Session S-JWT — the game's OWN token, minted after a successful handoff exchange
 * (Decision 4: "handoff token is never the session token"). Keyed by platform user_id.
 */
import { signJwt, verifyJwt, JwtError, type JwtClaims } from './jwt.js';

export const SESSION_ISS = 'pantheons';
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h play session

export interface SessionClaims {
  sub: string; // platform user_id — the durable key for all player data
  displayName?: string;
  iat: number;
  exp: number;
  iss: typeof SESSION_ISS;
}

export function issueSession(
  userId: string,
  secret: string,
  displayName?: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const claims: JwtClaims = {
    sub: userId,
    iss: SESSION_ISS,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
    ...(displayName ? { displayName } : {}),
  };
  return signJwt(claims, secret);
}

export function verifySession(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SessionClaims {
  let claims: JwtClaims;
  try {
    claims = verifyJwt(token, secret);
  } catch (e) {
    throw new JwtError(e instanceof JwtError ? e.code : 'INVALID', 'Invalid session');
  }
  if (claims.iss !== SESSION_ISS) throw new JwtError('ISS', 'bad session iss');
  if (typeof claims.exp !== 'number' || nowSeconds > claims.exp) throw new JwtError('EXPIRED', 'session expired');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new JwtError('SUB', 'no subject');
  return {
    sub: claims.sub,
    iss: SESSION_ISS,
    iat: typeof claims.iat === 'number' ? claims.iat : 0,
    exp: claims.exp,
    ...(typeof claims.displayName === 'string' ? { displayName: claims.displayName } : {}),
  };
}
