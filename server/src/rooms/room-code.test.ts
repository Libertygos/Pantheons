import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from './room-code.js';
import { isCodeTaken, lookupRoom, registerRoom, unregisterRoom } from './room-registry.js';

test('generateRoomCode: length and unambiguous alphabet', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateRoomCode();
    assert.equal(code.length, ROOM_CODE_LENGTH);
    assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
  }
});

test('normalizeRoomCode: trims, uppercases, tolerates junk', () => {
  assert.equal(normalizeRoomCode('  ab2cd '), 'AB2CD');
  assert.equal(normalizeRoomCode(undefined), '');
  assert.equal(normalizeRoomCode(42), '');
});

test('room registry: register, lookup with live phase, unregister', () => {
  let phase: 'LOBBY' | 'IN_PROGRESS' | 'ENDED' = 'LOBBY';
  registerRoom('AAAAA', 'room-1', () => phase);
  assert.equal(isCodeTaken('AAAAA'), true);
  assert.deepEqual(lookupRoom('AAAAA'), { roomId: 'room-1', phase: 'LOBBY' });
  phase = 'IN_PROGRESS';
  assert.deepEqual(lookupRoom('AAAAA'), { roomId: 'room-1', phase: 'IN_PROGRESS' });
  unregisterRoom('AAAAA');
  assert.equal(lookupRoom('AAAAA'), null);
  assert.equal(isCodeTaken('AAAAA'), false);
});
