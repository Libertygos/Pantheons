import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PlatformPresence, isValidSessionRef } from './platformPresence.js';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GOSGAMES_INTERNAL_URL;
  delete process.env.INTERNAL_SERVICE_TOKEN;
});

function captureFetch(status = 200, bodyText = '{}') {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(bodyText, { status }));
  }) as typeof fetch;
  return calls;
}

function configured() {
  process.env.GOSGAMES_INTERNAL_URL = 'http://gosgames.gosgames.svc.cluster.local';
  process.env.INTERNAL_SERVICE_TOKEN = 'secret';
}

function makePresence(onSuperseded: () => void = () => {}) {
  return new PlatformPresence({ userId: 'u1', sessionRef: 'room7:u1', onSuperseded });
}

test('isValidSessionRef: accepts contract chars, rejects others / bad length', () => {
  assert.equal(isValidSessionRef('room7:u1'), true);
  assert.equal(isValidSessionRef('A._:-0'), true);
  assert.equal(isValidSessionRef(''), false);
  assert.equal(isValidSessionRef('has space'), false);
  assert.equal(isValidSessionRef('a'.repeat(129)), false);
  assert.equal(isValidSessionRef('a'.repeat(128)), true);
});

test('start: POSTs the presence contract with the internal token header', async () => {
  configured();
  const calls = captureFetch(200, '{"status":"leased"}');
  await makePresence().start(new Date('2026-07-22T10:00:00Z'));

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'http://gosgames.gosgames.svc.cluster.local/api/internal/presence/start');
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers['X-Internal-Token'], 'secret');
  assert.equal('Authorization' in headers, false); // NOT bearer
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), {
    userId: 'u1',
    gameSlug: 'pantheons',
    sessionRef: 'room7:u1',
    startedAt: '2026-07-22T10:00:00.000Z',
  });
});

test('heartbeat: POSTs { userId, gameSlug, sessionRef } to /heartbeat', async () => {
  configured();
  const calls = captureFetch(200, '{"status":"alive"}');
  await makePresence().heartbeat();

  assert.equal(calls[0]!.url.endsWith('/api/internal/presence/heartbeat'), true);
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), {
    userId: 'u1',
    gameSlug: 'pantheons',
    sessionRef: 'room7:u1',
  });
});

test('end: POSTs { userId, gameSlug, sessionRef, reason } to /end', async () => {
  configured();
  const calls = captureFetch(200, '{"status":"ended"}');
  await makePresence().end('left');

  assert.equal(calls[0]!.url.endsWith('/api/internal/presence/end'), true);
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), {
    userId: 'u1',
    gameSlug: 'pantheons',
    sessionRef: 'room7:u1',
    reason: 'left',
  });
});

test('unconfigured: every call is a silent no-op (no fetch)', async () => {
  const calls = captureFetch();
  const p = makePresence();
  await p.start();
  await p.heartbeat();
  await p.end('left');
  assert.equal(calls.length, 0);
});

test('network error / non-2xx never throws', async () => {
  configured();
  captureFetch(500, 'boom');
  await makePresence().start(); // 500 swallowed
  await makePresence().heartbeat();

  globalThis.fetch = (() => Promise.reject(new Error('ECONNREFUSED'))) as typeof fetch;
  await makePresence().start(); // rejection swallowed
  await makePresence().end('logout');
});

test('409 superseded on start: invokes onSuperseded, latches closed (no further POSTs)', async () => {
  configured();
  let supersededCalls = 0;
  const calls = captureFetch(409, '{"status":"superseded"}');
  const p = makePresence(() => {
    supersededCalls++;
  });

  await p.start();
  assert.equal(supersededCalls, 1);
  assert.equal(calls.length, 1);

  // Latched: subsequent heartbeat/end are no-ops (stop heartbeating).
  await p.heartbeat();
  await p.end('remote_end');
  assert.equal(calls.length, 1);
});

test('409 superseded on heartbeat: invokes onSuperseded and stops', async () => {
  configured();
  let superseded = false;
  captureFetch(409, '{"status":"superseded"}');
  const p = makePresence(() => {
    superseded = true;
  });
  await p.heartbeat();
  assert.equal(superseded, true);
});

test('404 no_lease on heartbeat: ignored, does NOT invoke onSuperseded, latches closed', async () => {
  configured();
  let superseded = false;
  const calls = captureFetch(404, '{"status":"no_lease"}');
  const p = makePresence(() => {
    superseded = true;
  });
  await p.heartbeat();
  assert.equal(superseded, false);
  await p.end('left'); // latched -> no further POST
  assert.equal(calls.length, 1);
});

test('404 no_lease on end: ignored, never errors', async () => {
  configured();
  const calls = captureFetch(404, '{"status":"no_lease"}');
  await makePresence().end('timeout');
  assert.equal(calls.length, 1); // it posted once, 404 swallowed
});

test('end is idempotent: a second end() does not re-POST', async () => {
  configured();
  const calls = captureFetch(200, '{"status":"ended"}');
  const p = makePresence();
  await p.end('left');
  await p.end('logout');
  assert.equal(calls.length, 1);
});
