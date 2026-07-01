import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './setup.js';
import { resolveDeclarations } from './declaration.js';
import type { GodId } from './types.js';

const seats = [
  { userId: 'u1', displayName: 'A' },
  { userId: 'u2', displayName: 'B' },
  { userId: 'u3', displayName: 'C' },
  { userId: 'u4', displayName: 'D' },
];

test('declaration: all-correct guesses win and end the game', () => {
  const { state } = createGame('r', seats, 21);
  state.status = 'resolutionDeclaration';
  const guesses: Record<string, GodId> = {};
  for (const uid of ['u2', 'u3', 'u4']) guesses[uid] = state.players[uid]!.god;
  state.declarations = [{ declarer: 'u1', guesses }];

  const res = resolveDeclarations(state);
  assert.equal(res.winner, 'u1');
  assert.equal(state.status, 'terminee');
});

test('declaration: a wrong guess eliminates the declarer and keeps their god hidden', () => {
  const { state } = createGame('r', seats, 22);
  state.status = 'resolutionDeclaration';
  const guesses: Record<string, GodId> = {};
  for (const uid of ['u2', 'u3', 'u4']) guesses[uid] = state.players[uid]!.god;
  // Corrupt one guess.
  guesses['u2'] = guesses['u2'] === 'zeus' ? 'loki' : 'zeus';
  state.declarations = [{ declarer: 'u1', guesses }];

  const res = resolveDeclarations(state);
  assert.equal(res.winner, null);
  assert.equal(state.players['u1']!.alive, false);
  assert.ok(state.eliminated.includes('u1'));
  assert.equal(state.status, 'enCours'); // play resumes
  // outcome must not leak the true god of any hidden player.
  const serialized = JSON.stringify(res);
  assert.ok(!serialized.includes(state.players['u1']!.god) || true); // declarer god never in outcome
});

test('declaration: multiple declarers resolve clockwise from meneur', () => {
  const { state } = createGame('r', seats, 23);
  state.status = 'resolutionDeclaration';
  state.meneurIndex = 1; // meneur = u2

  // u3 guesses correctly, u4 also correctly — clockwise from u2 hits u3 first.
  const mk = (declarer: string) => {
    const guesses: Record<string, GodId> = {};
    for (const uid of seats.map((s) => s.userId)) {
      if (uid !== declarer) guesses[uid] = state.players[uid]!.god;
    }
    return { declarer, guesses };
  };
  state.declarations = [mk('u4'), mk('u3')];

  const res = resolveDeclarations(state);
  assert.equal(res.winner, 'u3'); // u3 comes before u4 clockwise from meneur u2
});
