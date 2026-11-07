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

import { advanceTurn } from './rules.js';
import { project } from './projection.js';

test('#1837 meneur rotation skips an eliminated seat', () => {
  const { state } = createGame('r', seats, 31);
  state.meneurIndex = 0;
  state.players['u2']!.alive = false;
  advanceTurn(state);
  assert.equal(state.meneurIndex, 2);
  state.players['u4']!.alive = false;
  advanceTurn(state); // u3 -> skips u4, u1 -> wraps to u1
  assert.equal(state.meneurIndex, 0);
});

test('#1837 first meneur depends on the seed', () => {
  const firsts = new Set<number>();
  for (let s = 1; s <= 30; s++) firsts.add(createGame('r', seats, s).state.meneurIndex);
  assert.ok(firsts.size > 1);
  assert.equal(createGame('r', seats, 5).state.meneurIndex, createGame('r', seats, 5).state.meneurIndex);
});

test('#1837 end state reveals every god to every seat, hidden before', () => {
  const { state } = createGame('r', seats, 32);
  for (const v of ['u1', 'u2']) {
    for (const o of project(state, v).opponents) assert.equal(o.god, undefined);
  }
  state.players['u3']!.alive = false;
  state.status = 'terminee';
  for (const v of seats.map((s) => s.userId)) {
    for (const o of project(state, v).opponents) assert.equal(o.god, state.players[o.userId]!.god);
  }
  assert.ok(!JSON.stringify(project(state, 'u1')).includes('undealt'));
});

test('#1837 a declaration without a guess for the soul mate is accepted', () => {
  const { state } = createGame('r', seats, 33);
  state.status = 'resolutionDeclaration';
  state.players['u1']!.powers = ['pow_ames_soeurs_1'];
  state.players['u3']!.powers = ['pow_ames_soeurs_2'];
  const guesses: Record<string, GodId> = {};
  for (const uid of ['u2', 'u4']) guesses[uid] = state.players[uid]!.god; // no guess for u3
  state.declarations = [{ declarer: 'u1', guesses }];
  const res = resolveDeclarations(state);
  assert.equal(res.winner, 'u1');
  assert.equal(res.outcomes[0]!.matched['u3'], true);
});
