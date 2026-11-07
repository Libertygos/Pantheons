import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './setup.js';
import { project } from './projection.js';
import { resolveDeclarations } from './declaration.js';
import { activatePower, applyPioche, executionTargets } from './rules.js';
import { discardPowers, swapPowers } from './effects.js';
import type { GodId } from './types.js';

const seats = [
  { userId: 'u1', displayName: 'A' },
  { userId: 'u2', displayName: 'B' },
  { userId: 'u3', displayName: 'C' },
  { userId: 'u4', displayName: 'D' },
];

test('#1833 projection shows every power to every seat', () => {
  const { state, index } = createGame('r', seats, 5);
  for (const viewer of seats) {
    const view = project(state, viewer.userId, index);
    for (const opp of view.opponents) {
      assert.deepEqual(opp.powers, state.players[opp.userId]!.powers);
      assert.equal(opp.powerCards!.length, opp.powers.length);
    }
  }
  state.players['u2']!.clonedPowerKey = 'etude';
  const opp = project(state, 'u1', index).opponents.find((o) => o.userId === 'u2')!;
  assert.equal(opp.clonedPowerKey, 'etude');
});

test('#1833 an empty Attribut pile refills from its discard', () => {
  const { state } = createGame('r', seats, 6);
  state.discard.attributs.push(...state.drawPiles.attributs.splice(0));
  const total = state.discard.attributs.length;
  assert.equal(state.drawPiles.attributs.length, 0);
  applyPioche(state, 'u1', {});
  assert.equal(state.players['u1']!.hand.attributs.length, 2);
  assert.equal(state.drawPiles.attributs.length, total - 2);
  assert.equal(state.discard.attributs.length, 0);
});

test('#1833 pile and discard short: the first validators draw', () => {
  const { state } = createGame('r', seats, 7);
  state.discard.attributs.push(...state.drawPiles.attributs.splice(0));
  state.drawPiles.attributs.length = 0;
  state.discard.attributs.splice(3); // only 3 cards left in total
  for (const u of ['u1', 'u2']) applyPioche(state, u, {});
  assert.equal(state.players['u1']!.hand.attributs.length, 2);
  assert.equal(state.players['u2']!.hand.attributs.length, 1);
});

test('#1833 last player in play wins automatically', () => {
  const { state } = createGame('r', seats, 8);
  state.status = 'resolutionDeclaration';
  for (const u of ['u3', 'u4']) {
    state.players[u]!.alive = false;
    state.eliminated.push(u);
  }
  const bad = (u: string, g: GodId): GodId => (state.players[u]!.god === g ? 'loki' : g);
  // u1 guesses wrong and is eliminated; u2 is then the last one in play.
  state.declarations = [{ declarer: 'u1', guesses: { u2: bad('u2', 'zeus') } }];
  const res = resolveDeclarations(state);
  assert.equal(res.winner, 'u2');
  assert.equal(state.winner, 'u2');
  assert.equal(state.status, 'terminee');
});

test('#1833 an eliminated player\'s power cannot be cloned or targeted', () => {
  const { state } = createGame('r', seats, 9);
  state.players['u1']!.powers = ['pow_clonage'];
  state.players['u2']!.powers = ['pow_etude'];
  state.players['u3']!.powers = ['pow_optimisse'];
  state.players['u2']!.alive = false;
  state.tour = 2;
  assert.throws(() => activatePower(state, 'u1', { effectKey: 'clonage', target: 'u2' }), /invalide/);
  discardPowers(state, 'u2');
  swapPowers(state, 'u1', 'u2');
  assert.deepEqual(state.players['u2']!.powers, ['pow_etude']);
  assert.deepEqual(state.players['u1']!.powers, ['pow_clonage']);
  state.players['u1']!.powers = ['pow_execution'];
  assert.ok(!executionTargets(state, 'u1').includes('u2'));
  // blocked: the eliminated player's own power is unusable
  assert.throws(() => activatePower(state, 'u2', { effectKey: 'deduction' }), /éliminé/);
});

test('#1833 the reshuffle seed is never projected to any seat', () => {
  const { state, index } = createGame('r', seats, 11);
  state.reshuffleCount = 3;
  const secret = String(state.shuffleSeed);
  for (const s of seats) {
    const json = JSON.stringify(project(state, s.userId, index));
    assert.ok(!json.includes('shuffleSeed') && !json.includes('reshuffleCount'));
    assert.ok(!json.includes(`:${secret}`));
  }
});
