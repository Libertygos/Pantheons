/** #1836: Non 1-2 giver's choice, Clonage fixes, Déduction at random, Refus royal timing, previous-turn reads. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './setup.js';
import { activatePower, applyPioche, applyQuestions, answerDonnez, resolveReponsePhase, RuleError } from './rules.js';
import { discardPowers, noOuiLastTurn, swapPowers } from './effects.js';
import { project } from './projection.js';
import type { ActionCard, GameState } from './types.js';

const seats = ['u1', 'u2', 'u3', 'u4'].map((u) => ({ userId: u, displayName: u }));
const game = (seed = 1): GameState => createGame('r', seats, seed).state;
function give(state: GameState, uid: string, key: string): void {
  state.players[uid]!.powers = [`pow_${key}`];
  state.players[uid]!.clonedPowerKey = null;
}

function nonSetup(seed: number, hand: { a: string[]; c: string[] }) {
  const state = game(seed);
  state.players['u2']!.god = 'zeus'; // masculin -> « non » to Non 1 (féminin)
  state.players['u2']!.hand = { attributs: [...hand.a], actions: [...hand.c] };
  const before = state.players['u1']!.hand.attributs.length;
  const card: ActionCard = {
    id: 'act_action_non_1', type: 'action', subtype: 'non', axe: 'genre', valeur: 'feminin', effectKey: 'action_non_1',
  };
  state.players['u1']!.hand.actions.push(card.id);
  applyQuestions(state, 'u1', { plays: [{ cardId: card.id, card, targetSeat: 1 }] });
  return { state, before };
}

test('#1836 Non 1: the giver chooses the 2 cards he gives', () => {
  const { state, before } = nonSetup(15, { a: ['attr_a_1', 'attr_b_1', 'attr_c_1'], c: ['act_x'] });
  const res = resolveReponsePhase(state);
  assert.deepEqual(res.pending, { kind: 'donnez', asker: 'u1', answerer: 'u2' });
  assert.equal(project(state, 'u2').donnezChoice?.count, 2);
  assert.equal(project(state, 'u1').donnezChoice, null);
  assert.throws(() => answerDonnez(state, 'u1', ['attr_a_1', 'attr_b_1']), RuleError); // not the asker
  assert.throws(() => answerDonnez(state, 'u2', ['attr_a_1']), RuleError); // exactly 2
  assert.throws(() => answerDonnez(state, 'u2', ['attr_a_1', 'attr_a_1']), RuleError);
  assert.throws(() => answerDonnez(state, 'u2', ['attr_a_1', 'nope']), RuleError);
  const done = answerDonnez(state, 'u2', ['attr_c_1', 'act_x']);
  assert.equal(done.pending, null);
  assert.ok(state.players['u1']!.hand.actions.includes('act_x'));
  assert.ok(state.players['u1']!.hand.attributs.includes('attr_c_1'));
  assert.deepEqual(state.players['u2']!.hand.attributs, ['attr_a_1', 'attr_b_1']);
  assert.equal(state.players['u1']!.hand.attributs.length, before + 1);
  assert.ok(state.lastTurn.tour === state.tour); // resolution finished
});

test('#1836 Non 1: auto-pick (null) takes the first 2 cards; a hand of 2 or less needs no choice', () => {
  const a = nonSetup(15, { a: ['attr_a_1', 'attr_b_1', 'attr_c_1'], c: [] });
  resolveReponsePhase(a.state);
  answerDonnez(a.state, 'u2', null);
  assert.deepEqual(a.state.players['u2']!.hand.attributs, ['attr_c_1']);
  const b = nonSetup(15, { a: ['attr_a_1'], c: [] });
  assert.equal(resolveReponsePhase(b.state).pending, null);
  assert.equal(b.state.players['u2']!.hand.attributs.length, 0);
});

test('#1836 Clonage: a copy of an active power is usable, cancelled when the copied power is discarded', () => {
  const state = game(5);
  state.tour = 2;
  state.lastTurn = { ouiFor: {}, nonAnswerers: {} };
  give(state, 'u1', 'clonage');
  give(state, 'u2', 'deduction');
  activatePower(state, 'u1', { effectKey: 'clonage', target: 'u2' });
  assert.equal(state.players['u1']!.clonedPowerKey, 'deduction');
  assert.equal(project(state, 'u3').opponents.find((o) => o.userId === 'u1')!.clonedPowerKey, 'deduction');
  // changing the copy and using the copy: two uses in the same turn
  assert.ok(activatePower(state, 'u1', { effectKey: 'deduction' }).reveal);
  assert.throws(() => activatePower(state, 'u1', { effectKey: 'deduction' }), RuleError); // once per power
  assert.throws(() => activatePower(state, 'u1', { effectKey: 'clonage', target: 'u2' }), RuleError);
  discardPowers(state, 'u2');
  assert.equal(state.players['u1']!.clonedPowerKey, null);
});

test('#1836 Clonage: a copy dies when the copied power is dropped at the pioche', () => {
  const state = game(5);
  give(state, 'u1', 'clonage');
  state.players['u1']!.clonedPowerKey = 'deduction';
  state.players['u2']!.powers = ['pow_deduction', 'pow_sabotage'];
  applyPioche(state, 'u2', { discardPowerId: 'pow_deduction' });
  assert.equal(state.players['u1']!.clonedPowerKey, null);
});

test('#1836 Clonage: no copy of an eliminated player power; a moved Clonage loses its copy', () => {
  const state = game(5);
  give(state, 'u1', 'clonage');
  give(state, 'u2', 'deduction');
  state.players['u2']!.alive = false;
  assert.throws(() => activatePower(state, 'u1', { effectKey: 'clonage', target: 'u2' }), RuleError);
  state.players['u2']!.alive = true;
  activatePower(state, 'u1', { effectKey: 'clonage', target: 'u2' });
  swapPowers(state, 'u1', 'u3');
  assert.equal(state.players['u1']!.clonedPowerKey, null);
  assert.equal(state.players['u3']!.clonedPowerKey, null);
  // the new holder picks one, even the same turn
  activatePower(state, 'u3', { effectKey: 'clonage', target: 'u2' });
  assert.equal(state.players['u3']!.clonedPowerKey, 'deduction');
});

test('#1836 Déduction shows an undealt god at random, not a fixed order, and never projects the pool', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const state = game(seed);
    give(state, 'u1', 'deduction');
    state.tour = 2;
    state.lastTurn = { ouiFor: {}, nonAnswerers: {} };
    const god = activatePower(state, 'u1', { effectKey: 'deduction' }).reveal!.god!;
    assert.ok(state.undealtGods.includes(god));
    seen.add(`${state.undealtGods.indexOf(god)}`);
    assert.ok(!JSON.stringify(project(state, 'u2')).includes('undealtGods'));
  }
  assert.ok(seen.size > 1, 'the index is not constant');
});

test('#1836 Refus royal: refused once the target validated its questions (and during réponse)', () => {
  const state = game(7);
  state.tour = 2;
  state.lastTurn = { ouiFor: {}, nonAnswerers: { u1: ['u2', 'u3'] } };
  give(state, 'u1', 'refus_royal');
  state.phase = 'question';
  state.barrier = { phase: 'question', submitted: ['u2'], deadline: null };
  assert.throws(() => activatePower(state, 'u1', { effectKey: 'refus_royal', target: 'u2' }), RuleError);
  activatePower(state, 'u1', { effectKey: 'refus_royal', target: 'u3' });
  assert.equal(state.effets.askBlockedTour['u3'], 2);
  state.phase = 'reponse';
  state.effets.powerUsedTour['u1'] = {};
  assert.throws(() => activatePower(state, 'u1', { effectKey: 'refus_royal', target: 'u2' }), RuleError);
});

test('#1836 « aucun oui au tour précédent » reads the previous turn, also in the declaration window', () => {
  const state = game(9);
  assert.equal(noOuiLastTurn(state, 'u1'), false); // false all of turn 1
  state.tour = 1;
  resolveReponsePhase(state); // turn 1 resolved, window open
  assert.equal(noOuiLastTurn(state, 'u1'), false);
  state.tour = 2;
  state.lastTurn = { tour: 1, ouiFor: { u1: true }, nonAnswerers: {} };
  assert.equal(noOuiLastTurn(state, 'u1'), false); // oui last turn
  assert.equal(noOuiLastTurn(state, 'u2'), true); // no question posed
  // turn 2 resolved with a oui for u2 only: the window still reads turn 1
  state.priorTurn = state.lastTurn;
  state.lastTurn = { tour: 2, ouiFor: { u2: true }, nonAnswerers: {} };
  assert.equal(noOuiLastTurn(state, 'u1'), false);
  assert.equal(noOuiLastTurn(state, 'u2'), true);
});
