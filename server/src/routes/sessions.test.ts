import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createSessionsRouter } from './sessions.js';

const TOKEN = 'super-secret-internal-token';

/** Spin the router on an ephemeral port with a recording endSessions sink. */
async function withServer(
  endSessions: (userId: string, sessionRef?: string) => number,
  run: (base: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(createSessionsRouter(TOKEN, endSessions));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

function post(base: string, body: unknown, auth?: string) {
  return fetch(`${base}/internal/sessions/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('valid token: ends the session and returns 200', async () => {
  const calls: { userId: string; sessionRef?: string }[] = [];
  await withServer(
    (userId, sessionRef) => {
      calls.push({ userId, sessionRef });
      return 1;
    },
    async (base) => {
      const res = await post(base, { userId: 'u1', sessionRef: 'room7:u1' }, `Bearer ${TOKEN}`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { status: 'ended', ended: 1 });
      assert.deepEqual(calls, [{ userId: 'u1', sessionRef: 'room7:u1' }]);
    },
  );
});

test('sessionRef omitted: forwarded as undefined (end-all case)', async () => {
  let seen: string | undefined = 'UNSET';
  await withServer(
    (_userId, sessionRef) => {
      seen = sessionRef;
      return 2;
    },
    async (base) => {
      const res = await post(base, { userId: 'u1' }, `Bearer ${TOKEN}`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { status: 'ended', ended: 2 });
      assert.equal(seen, undefined);
    },
  );
});

test('unknown / already-gone session: still 200 (idempotent), ended: 0', async () => {
  await withServer(
    () => 0,
    async (base) => {
      const res = await post(base, { userId: 'ghost', sessionRef: 'nope:ghost' }, `Bearer ${TOKEN}`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { status: 'ended', ended: 0 });
    },
  );
});

test('bad token: 401 and NO teardown', async () => {
  let called = false;
  await withServer(
    () => {
      called = true;
      return 1;
    },
    async (base) => {
      const res = await post(base, { userId: 'u1' }, 'Bearer wrong-token');
      assert.equal(res.status, 401);
      assert.equal(called, false);
    },
  );
});

test('missing token: 401 and NO teardown', async () => {
  let called = false;
  await withServer(
    () => {
      called = true;
      return 1;
    },
    async (base) => {
      const res = await post(base, { userId: 'u1' }); // no Authorization
      assert.equal(res.status, 401);
      assert.equal(called, false);
    },
  );
});

test('missing userId: 400', async () => {
  await withServer(
    () => 1,
    async (base) => {
      const res = await post(base, { sessionRef: 'x' }, `Bearer ${TOKEN}`);
      assert.equal(res.status, 400);
    },
  );
});
