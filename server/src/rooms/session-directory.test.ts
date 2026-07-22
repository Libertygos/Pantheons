import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerSession,
  unregisterSession,
  endSessions,
  clearSessionDirectory,
  type SessionEnder,
} from './session-directory.js';

afterEach(() => clearSessionDirectory());

function fakeRoom(ret = 1) {
  const calls: { userId: string; sessionRef?: string }[] = [];
  const room: SessionEnder = {
    endSessionsForUser(userId, sessionRef) {
      calls.push({ userId, sessionRef });
      return ret;
    },
  };
  return { room, calls };
}

test('endSessions on an unknown user returns 0 (idempotent)', () => {
  assert.equal(endSessions('nobody'), 0);
});

test('routes to the room hosting the user and forwards sessionRef', () => {
  const a = fakeRoom(1);
  registerSession('u1', a.room);
  const ended = endSessions('u1', 'room7:u1');
  assert.equal(ended, 1);
  assert.deepEqual(a.calls, [{ userId: 'u1', sessionRef: 'room7:u1' }]);
});

test('sums across multiple rooms hosting the same user', () => {
  const a = fakeRoom(1);
  const b = fakeRoom(1);
  registerSession('u1', a.room);
  registerSession('u1', b.room);
  assert.equal(endSessions('u1'), 2);
});

test('unregister removes the room; a later end is a noop', () => {
  const a = fakeRoom(1);
  registerSession('u1', a.room);
  unregisterSession('u1', a.room);
  assert.equal(endSessions('u1'), 0);
  assert.equal(a.calls.length, 0);
});

test('a room that unregisters mid-iteration does not break the sweep', () => {
  const a = fakeRoom(1);
  // This room unregisters itself when ended (like the real room via releasePresence).
  const self: SessionEnder = {
    endSessionsForUser(userId) {
      unregisterSession(userId, self);
      return 1;
    },
  };
  registerSession('u1', a.room);
  registerSession('u1', self);
  const ended = endSessions('u1');
  assert.equal(ended, 2);
  assert.equal(endSessions('u1'), 1); // self gone, a still there
});
