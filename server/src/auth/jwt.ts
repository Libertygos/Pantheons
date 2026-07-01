/**
 * Minimal, dependency-free HS256 JWT verify/sign using node:crypto. Used by both the
 * handoff verifier ([OPUS 🔒]) and the session S-JWT. Kept tiny and auditable rather than
 * pulling a JWT library — the security-critical path should be readable end to end.
 *
 * Only HS256 is supported by construction; there is no `alg` negotiation, which structurally
 * defeats the alg-confusion / "alg: none" class of attacks.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface JwtClaims {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number; // seconds since epoch
  iat?: number; // seconds since epoch
  [k: string]: unknown;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(headerB64: string, payloadB64: string, secret: string): string {
  const mac = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  return b64urlEncode(mac);
}

export function signJwt(claims: JwtClaims, secret: string): string {
  const header = b64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64urlEncode(Buffer.from(JSON.stringify(claims)));
  const sig = sign(header, payload, secret);
  return `${header}.${payload}.${sig}`;
}

export class JwtError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'JwtError';
  }
}

/**
 * Verify an HS256 JWT. Enforces the HS256 header exactly, constant-time signature compare,
 * and returns decoded claims. Time-based claim checks (exp/iat) are the caller's job so the
 * skew policy lives with the handoff rules.
 */
export function verifyJwt(token: string, secret: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('MALFORMED', 'JWT must have 3 parts');
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString('utf8'));
  } catch {
    throw new JwtError('BAD_HEADER', 'Undecodable header');
  }
  // Algorithm allowlist pinned to exactly HS256 (Decision 4).
  if (header.alg !== 'HS256') throw new JwtError('BAD_ALG', `alg must be HS256, got ${header.alg}`);

  const expected = sign(headerB64, payloadB64, secret);
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new JwtError('BAD_SIGNATURE', 'Signature mismatch');
  }

  try {
    return JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as JwtClaims;
  } catch {
    throw new JwtError('BAD_PAYLOAD', 'Undecodable payload');
  }
}
