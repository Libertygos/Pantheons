import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '@pantheons/engine';
import { MatchController } from './barrier.js';

const seats = [
  { userId: 'u1', displayName: 'A' },
  { userId: 'u2', displayName: 'B' },
  { userId: 'u3', displayName: 'C' },
  { userId: 'u4', displayName: 'D' },
];

function fresh() {
  const { state, index } = createGame('r', seats, 99);
  return new MatchController(state, index);
}

test('barrier: does not advance until all live players submit pioche', () => {
  const c = fresh();
  c.submitPioche('u1', {});
  c.submitPioche('u2', {});
  c.submitPioche('u3', {});
  assert.equal(c.state.phase, 'pioche'); // still waiting on u4
  c.submitPioche('u4', {});
  assert.equal(c.state.phase, 'question'); // now advanced
});

test('barrier: full turn loop advances pioche -> question -> reponse -> next pioche', () => {
  const c = fresh();
  for (const s of seats) c.submitPioche(s.userId, {});
  assert.equal(c.state.phase, 'question');

  for (const s of seats) c.submitQuestion(s.userId, { plays: [] });
  assert.equal(c.state.phase, 'reponse'); // réponse auto-resolved, declaration window open

  const tourBefore = c.state.tour;
  for (const s of seats) c.submitDeclaration(s.userId, {}); // all pass
  assert.equal(c.state.phase, 'pioche');
  assert.equal(c.state.tour, tourBefore + 1);
  assert.equal(c.state.meneurIndex, 1); // meneur rotated clockwise
});

test('barrier: a winning declaration ends the game', () => {
  const c = fresh();
  for (const s of seats) c.submitPioche(s.userId, {});
  for (const s of seats) c.submitQuestion(s.userId, { plays: [] });

  const guesses: Record<string, string> = {};
  for (const uid of ['u2', 'u3', 'u4']) guesses[uid] = c.state.players[uid]!.god;
  c.submitDeclaration('u1', { guesses });
  c.submitDeclaration('u2', {});
  c.submitDeclaration('u3', {});
  c.submitDeclaration('u4', {});

  assert.equal(c.state.status, 'terminee');
  assert.equal(c.state.winner, 'u1');
});

test('barrier: disconnected players are not awaited', () => {
  const c = fresh();
  c.state.players['u4']!.connected = false;
  c.submitPioche('u1', {});
  c.submitPioche('u2', {});
  c.submitPioche('u3', {});
  assert.equal(c.state.phase, 'question'); // advanced without u4
});
