import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reportMatch } from './matchReport.js';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GOSGAMES_INTERNAL_URL;
  delete process.env.INTERNAL_SERVICE_TOKEN;
});

function captureFetch(status = 201) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response('{}', { status }));
  }) as typeof fetch;
  return calls;
}

test('reportMatch: POSTs the TICKET-102 contract with the internal token', async () => {
  process.env.GOSGAMES_INTERNAL_URL = 'http://gosgames.gosgames.svc.cluster.local';
  process.env.INTERNAL_SERVICE_TOKEN = 'secret';
  const calls = captureFetch();

  await reportMatch({
    playerAccountIds: ['u1', 'u2', 'u3', 'u4'],
    startedAt: new Date('2026-07-15T10:00:00Z'),
    endedAt: new Date('2026-07-15T10:52:00Z'),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'http://gosgames.gosgames.svc.cluster.local/api/internal/matches');
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers['X-Internal-Token'], 'secret');
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), {
    gameSlug: 'pantheons',
    playerAccountIds: ['u1', 'u2', 'u3', 'u4'],
    startedAt: '2026-07-15T10:00:00.000Z',
    endedAt: '2026-07-15T10:52:00.000Z',
  });
});

test('reportMatch: silent no-op when GOSGAMES_INTERNAL_URL / token are absent', async () => {
  const calls = captureFetch();
  await reportMatch({ playerAccountIds: ['u1'], startedAt: new Date(), endedAt: new Date() });
  assert.equal(calls.length, 0);
});

test('reportMatch: a rejected or failing POST never throws', async () => {
  process.env.GOSGAMES_INTERNAL_URL = 'http://gosgames';
  process.env.INTERNAL_SERVICE_TOKEN = 'secret';
  captureFetch(400);
  await reportMatch({ playerAccountIds: ['u1'], startedAt: new Date(), endedAt: new Date() });

  globalThis.fetch = (() => Promise.reject(new Error('ECONNREFUSED'))) as typeof fetch;
  await reportMatch({ playerAccountIds: ['u1'], startedAt: new Date(), endedAt: new Date() });
});
