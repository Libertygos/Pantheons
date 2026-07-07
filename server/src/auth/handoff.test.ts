import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signJwt } from './jwt.js';
import { verifyHandoffToken, HandoffError, EXPECTED_AUD } from './handoff.js';

const SECRET = 'test-handoff-secret';
const NOW = 1_700_000_000;

function mkToken(over: Record<string, unknown> = {}, secret = SECRET): string {
  return signJwt(
    { iss: 'gosgames', aud: EXPECTED_AUD, sub: 'user-123', access: true, iat: NOW, exp: NOW + 30, ...over },
    secret,
  );
}

test('accepts a well-formed handoff token', () => {
  const claims = verifyHandoffToken(mkToken(), SECRET, NOW);
  assert.equal(claims.sub, 'user-123');
  assert.equal(claims.aud, 'pantheons');
});

test('reads the display name from the platform `username` claim', () => {
  const claims = verifyHandoffToken(mkToken({ username: 'Jules' }), SECRET, NOW);
  assert.equal(claims.displayName, 'Jules');
});

test('display name is absent when the token carries none', () => {
  const claims = verifyHandoffToken(mkToken(), SECRET, NOW);
  assert.equal(claims.displayName, undefined);
});

test('rejects wrong audience (per-tenant delta)', () => {
  assert.throws(
    () => verifyHandoffToken(mkToken({ aud: 'war-of-guilds' }), SECRET, NOW),
    (e: unknown) => e instanceof HandoffError && e.code === 'AUD',
  );
});

test('rejects wrong issuer', () => {
  assert.throws(
    () => verifyHandoffToken(mkToken({ iss: 'evil' }), SECRET, NOW),
    (e: unknown) => e instanceof HandoffError && e.code === 'ISS',
  );
});

test('rejects access !== true (exact boolean)', () => {
  assert.throws(
    () => verifyHandoffToken(mkToken({ access: 'true' }), SECRET, NOW),
    (e: unknown) => e instanceof HandoffError && e.code === 'ACCESS',
  );
});

test('rejects expired token beyond skew', () => {
  assert.throws(
    () => verifyHandoffToken(mkToken({ exp: NOW - 10 }), SECRET, NOW),
    (e: unknown) => e instanceof HandoffError && e.code === 'EXP',
  );
});

test('allows within 5s skew', () => {
  const claims = verifyHandoffToken(mkToken({ exp: NOW - 4 }), SECRET, NOW);
  assert.equal(claims.sub, 'user-123');
});

test('rejects a bad signature / wrong secret', () => {
  assert.throws(
    () => verifyHandoffToken(mkToken({}, 'wrong-secret'), SECRET, NOW),
    (e: unknown) => e instanceof HandoffError && e.code === 'SIGNATURE',
  );
});

test('rejects alg confusion (alg: none style) — no non-HS256 accepted', () => {
  // Hand-craft a token with alg "none".
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: 'gosgames', aud: EXPECTED_AUD, sub: 'x', access: true, iat: NOW, exp: NOW + 30 })}.`;
  assert.throws(
    () => verifyHandoffToken(forged, SECRET, NOW),
    (e: unknown) => e instanceof HandoffError && e.code === 'SIGNATURE',
  );
});
