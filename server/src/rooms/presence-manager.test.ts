/**
 * Presence-lifecycle integration over the exact PresenceManager the room composes
 * (login_all_games.md §A). Fetch is mocked and the 30 s heartbeat timer is stubbed with
 * node:test's mock timers. This is the real begin/heartbeat/release/drop wiring — the same
 * instance PantheonsRoom builds — minus the Colyseus socket layer.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PresenceManager } from './presence-manager.js';
import { endSessions, clearSessionDirectory, type SessionEnder } from './session-directory.js';

const realFetch = globalThis.fetch;

interface Call {
  path: string;
  body: Record<string, unknown>;
}

function captureFetch(status = 200): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ path: new URL(url).pathname, body: JSON.parse(init.body as string) });
    return Promise.resolve(new Response('{}', { status }));
  }) as typeof fetch;
  return calls;
}

/** A manager whose sessionRef mirrors the room's `${roomId}:${userId}`. */
function makeManager(
  roomId = 'ROOM',
  onSuperseded: (userId: string) => void = () => {},
): { mgr: PresenceManager; room: SessionEnder } {
  const room: SessionEnder = {
    endSessionsForUser(userId) {
      // Mirror the room: a remote-end releases the lease.
      mgr.release(userId, 'remote_end');
      return 1;
    },
  };
  const mgr = new PresenceManager((userId) => `${roomId}:${userId}`, room, onSuperseded);
  return { mgr, room };
}

function only(calls: Call[], suffix: string): Call[] {
  return calls.filter((c) => c.path.endsWith(suffix));
}

beforeEach(() => {
  process.env.GOSGAMES_INTERNAL_URL = 'http://gosgames';
  process.env.INTERNAL_SERVICE_TOKEN = 'secret';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GOSGAMES_INTERNAL_URL;
  delete process.env.INTERNAL_SERVICE_TOKEN;
  clearSessionDirectory();
});

test('join → heartbeat → leave emits one start, ≥1 heartbeat, one end', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const calls = captureFetch();
  const { mgr } = makeManager('ROOM1');

  mgr.begin('u1'); // onJoin path
  await Promise.resolve(); // let start()'s microtask settle

  t.mock.timers.tick(30_000);
  await Promise.resolve();
  t.mock.timers.tick(30_000);
  await Promise.resolve();

  mgr.release('u1', 'left'); // onLeave path
  await Promise.resolve();

  const starts = only(calls, '/presence/start');
  const beats = only(calls, '/presence/heartbeat');
  const ends = only(calls, '/presence/end');

  assert.equal(starts.length, 1, 'exactly one start');
  assert.ok(beats.length >= 1, 'at least one heartbeat');
  assert.equal(ends.length, 1, 'exactly one end');

  // sessionRef = `${roomId}:${userId}`, stable across all three calls.
  assert.equal(starts[0]!.body.sessionRef, 'ROOM1:u1');
  assert.equal(beats[0]!.body.sessionRef, 'ROOM1:u1');
  assert.equal(ends[0]!.body.sessionRef, 'ROOM1:u1');
  assert.equal(ends[0]!.body.reason, 'left');
});

test('begin is idempotent: an in-grace reconnect never double-starts (O5)', async () => {
  const calls = captureFetch();
  const { mgr } = makeManager('ROOM2');

  mgr.begin('u1');
  await Promise.resolve();
  mgr.begin('u1'); // second begin while live is a no-op
  await Promise.resolve();

  mgr.release('u1', 'left');
  assert.equal(only(calls, '/presence/start').length, 1);
});

test('release stops the heartbeat: no beats fire after leave', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const calls = captureFetch();
  const { mgr } = makeManager('ROOM3');

  mgr.begin('u1');
  await Promise.resolve();
  mgr.release('u1', 'left');

  t.mock.timers.tick(30_000 * 3); // no live timer anymore
  await Promise.resolve();
  assert.equal(only(calls, '/presence/heartbeat').length, 0);
});

test('a live session is reachable + endable via the session directory (remote-end §B)', async () => {
  const calls = captureFetch();
  const { mgr } = makeManager('ROOM4');

  mgr.begin('u1'); // registers in the directory
  await Promise.resolve();

  const ended = endSessions('u1', 'ROOM4:u1'); // platform remote-end routes here
  await Promise.resolve();
  assert.equal(ended, 1);

  const ends = only(calls, '/presence/end');
  assert.equal(ends.length, 1);
  assert.equal(ends[0]!.body.reason, 'remote_end');
  assert.equal(mgr.has('u1'), false);

  assert.equal(endSessions('u1'), 0); // idempotent
});

test('409 supersede: onSuperseded fires, and drop releases without emitting end', async () => {
  const calls = captureFetch(409); // every POST answers 409
  let superseded: string | null = null;
  const { mgr } = makeManager('ROOM5', (userId) => {
    superseded = userId;
    mgr.drop(userId); // mirror the room: supersede drops the lease, no end
  });

  mgr.begin('u1'); // start() → 409 → onSuperseded
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(superseded, 'u1');
  assert.equal(mgr.has('u1'), false);
  assert.equal(only(calls, '/presence/end').length, 0, 'supersede never emits end');
});
