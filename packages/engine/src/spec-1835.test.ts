/** #1835: Spéciales 2, 3, 4, 7, 8 by the cards' text, trigger order from the meneur, shown to all. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './setup.js';
import {
  advanceTurn,
  answerExecution,
  answerSpeciale,
  applyQuestions,
  autoSpecialeChoice,
  fireSpecialesAtPhaseStart,
  placeSpeciale,
  questionCap,
  resolveReponsePhase,
  validateQuestions,
  RuleError,
} from './rules.js';
import { project } from './projection.js';
import { getAction } from './data/actions.js';
import type { ActionCard, AttributCard, GameState } from './types.js';

const seats = ['u1', 'u2', 'u3', 'u4'].map((u) => ({ userId: u, displayName: u }));
const game = (seed = 1): GameState => createGame('r', seats, seed).state;

function spec(n: number): ActionCard {
  const def = getAction(`action_special_${n}`)!;
  return { id: `act_${def.effectKey}`, type: 'action', subtype: 'speciale', effectKey: def.effectKey, triggerPhase: def.triggerPhase! };
}
const grec = (id: string): AttributCard => ({ id, type: 'attribut', axe: 'pantheon', valeur: 'grec' });
function ask(state: GameState, by: string, cid: string, seat: number): void {
  state.players[by]!.hand.attributs.push(cid);
  applyQuestions(state, by, { plays: [{ cardId: cid, card: grec(cid), targetSeat: seat }] });
}
function pose(state: GameState, by: string, n: number, opts = {}): void {
  state.players[by]!.hand.actions.push(`act_action_special_${n}`);
  placeSpeciale(state, by, spec(n), opts);
}
const rejects = (f: () => unknown, code = 'BAD_CHOICE') =>
  assert.throws(f, (e: unknown) => e instanceof RuleError && e.code === code);

test('#1835 Spéciale 2: discards 2 chosen questions of other players, never his own', () => {
  const state = game(33);
  ask(state, 'u1', 'own1', 1);
  ask(state, 'u2', 'y1', 2);
  ask(state, 'u3', 'y2', 0);
  ask(state, 'u4', 'y3', 0);
  pose(state, 'u1', 2);
  fireSpecialesAtPhaseStart(state, 'reponse');
  assert.equal(state.specialePending?.effectKey, 'action_special_2');
  rejects(() => answerSpeciale(state, 'u1', { kind: 'discard', refs: [{ placer: 'u1', seat: 1, stackIndex: 0 }, { placer: 'u2', seat: 2, stackIndex: 0 }] }));
  rejects(() => answerSpeciale(state, 'u1', { kind: 'discard', refs: [{ placer: 'u2', seat: 2, stackIndex: 0 }] })); // exactly 2
  rejects(() => answerSpeciale(state, 'u2', null), 'PHASE'); // not the owner
  answerSpeciale(state, 'u1', { kind: 'discard', refs: [{ placer: 'u2', seat: 2, stackIndex: 0 }, { placer: 'u4', seat: 0, stackIndex: 0 }] });
  assert.equal(state.boardBySeat['u2']!.questionSlots[2]!.length, 0);
  assert.equal(state.boardBySeat['u4']!.questionSlots[0]!.length, 0);
  assert.equal(state.boardBySeat['u1']!.questionSlots[1]!.length, 1);
  assert.equal(state.boardBySeat['u3']!.questionSlots[0]!.length, 1);
  assert.equal(state.specialePending, null);
  assert.equal(state.boardBySeat['u1']!.specialSlot, null);
});

test('#1835 Spéciale 2: auto-pick takes the first two questions of others', () => {
  const state = game(33);
  ask(state, 'u1', 'own1', 1);
  ask(state, 'u2', 'y1', 2);
  ask(state, 'u3', 'y2', 0);
  pose(state, 'u1', 2);
  fireSpecialesAtPhaseStart(state, 'reponse');
  answerSpeciale(state, 'u1', null);
  assert.equal(state.boardBySeat['u2']!.questionSlots[2]!.length, 0);
  assert.equal(state.boardBySeat['u3']!.questionSlots[0]!.length, 0);
  assert.equal(state.boardBySeat['u1']!.questionSlots[1]!.length, 1);
});

test('#1835 Spéciale 3: as many questions as opponents still in play', () => {
  const state = game(25);
  pose(state, 'u1', 3);
  fireSpecialesAtPhaseStart(state, 'question');
  assert.equal(questionCap(state, 'u1'), 3);
  const s2 = game(26);
  s2.players['u4']!.alive = false;
  pose(s2, 'u1', 3);
  fireSpecialesAtPhaseStart(s2, 'question');
  assert.equal(questionCap(s2, 'u1'), 2);
});

function s4Setup(seed = 40) {
  const state = game(seed);
  state.players['u3']!.god = 'zeus'; // grec -> oui
  ask(state, 'u2', 'q1', 2); // u2 asks u3
  pose(state, 'u1', 4);
  fireSpecialesAtPhaseStart(state, 'reponse');
  return state;
}

test('#1835 Spéciale 4: appropriates a question by another to another; refuses own target / own question', () => {
  const state = game(40);
  ask(state, 'u2', 'q1', 0); // to the owner: refused
  ask(state, 'u3', 'q2', 3);
  ask(state, 'u1', 'q3', 1); // his own: refused
  pose(state, 'u1', 4);
  fireSpecialesAtPhaseStart(state, 'reponse');
  rejects(() => answerSpeciale(state, 'u1', { kind: 'take', ref: { placer: 'u2', seat: 0, stackIndex: 0 } }));
  rejects(() => answerSpeciale(state, 'u1', { kind: 'take', ref: { placer: 'u1', seat: 1, stackIndex: 0 } }));
  answerSpeciale(state, 'u1', { kind: 'take', ref: { placer: 'u3', seat: 3, stackIndex: 0 } });
  const placed = state.boardBySeat['u3']!.questionSlots[3]![0]!;
  assert.equal(placed.owner, 'u1');
  assert.equal(placed.targetSeat, 3); // the target stays the same
  assert.equal(state.players['u1']!.hand.attributs.includes('q2'), false); // not put in his hand
});

test('#1835 Spéciale 4: the new owner reaps the oui (Action draw) and sees the card; the original asker learns the answer', () => {
  const state = s4Setup();
  answerSpeciale(state, 'u1', { kind: 'take', ref: { placer: 'u2', seat: 2, stackIndex: 0 } });
  assert.equal(project(state, 'u1').boardBySeat['u2']!.questionSlots[2]![0]!.card?.id, 'q1');
  assert.equal(project(state, 'u4').boardBySeat['u2']!.questionSlots[2]![0]!.card, null);
  const a1 = state.players['u1']!.hand.actions.length;
  const a2 = state.players['u2']!.hand.actions.length;
  const res = resolveReponsePhase(state);
  assert.equal(state.players['u1']!.hand.actions.length, a1 + 1);
  assert.equal(state.players['u2']!.hand.actions.length, a2);
  assert.equal(res.answers[0]!.placerSeat, 1); // the original asker's seat: he learns the answer
  assert.equal(project(state, 'u2').boardBySeat['u2']!.questionSlots[2]![0]!.answeredOui, true);
  assert.equal(state.lastTurn.ouiFor['u1'], true); // « aucun oui » counts for the owner
  assert.equal(state.lastTurn.ouiFor['u2'], undefined);
});

test('#1835 Spéciale 4: the owner gets his own Exécution choice and the Spéciale 1 watch on the appropriated question', () => {
  const state = game(41);
  state.players['u3']!.god = 'zeus';
  state.players['u1']!.powers = ['pow_execution'];
  state.players['u4']!.powers = ['pow_sabotage'];
  ask(state, 'u2', 'q1', 2);
  pose(state, 'u1', 4);
  pose(state, 'u2', 1, { targetSeat: 2 });
  fireSpecialesAtPhaseStart(state, 'reponse');
  // meneur u1 first: Spéciale 4, then (pending cleared) Spéciale 1 of u2
  answerSpeciale(state, 'u1', { kind: 'take', ref: { placer: 'u2', seat: 2, stackIndex: 0 } });
  const res = resolveReponsePhase(state);
  assert.deepEqual(res.pending, { kind: 'execution', asker: 'u1', answerer: 'u3' });
  answerExecution(state, 'u1', 'u4');
  assert.equal(state.players['u4']!.powers.length, 0);
  assert.equal(state.lastTurn.ouiFor['u1'], true);
});

test('#1835 Spéciale 4 resolves at its original place in the board order', () => {
  const state = game(42);
  state.players['u3']!.god = 'zeus';
  state.players['u4']!.god = 'brahma';
  ask(state, 'u2', 'qa', 2);
  ask(state, 'u3', 'qb', 3);
  pose(state, 'u1', 4);
  fireSpecialesAtPhaseStart(state, 'reponse');
  answerSpeciale(state, 'u1', { kind: 'take', ref: { placer: 'u3', seat: 3, stackIndex: 0 } });
  const res = resolveReponsePhase(state);
  assert.deepEqual(res.answers.map((a) => a.cardId), ['qa', 'qb']);
});

test('#1835 trigger order: from the meneur, clockwise', () => {
  const state = game(43);
  state.meneurIndex = 2; // u3
  for (const u of ['u1', 'u2', 'u3', 'u4']) pose(state, u, 7);
  fireSpecialesAtPhaseStart(state, 'pioche');
  const order: string[] = [];
  while (state.specialePending) {
    order.push(state.specialePending.owner);
    answerSpeciale(state, state.specialePending.owner, null);
  }
  assert.deepEqual(order, ['u3', 'u4', 'u1', 'u2']);
});

test('#1835 a Spéciale whose owner or target is eliminated has no effect (discarded)', () => {
  const state = game(44);
  state.players['u4']!.powers = ['pow_sabotage'];
  pose(state, 'u2', 2);
  pose(state, 'u1', 5, { targetSeat: 3 });
  state.players['u2']!.alive = false; // eliminated owner
  state.players['u4']!.alive = false; // eliminated target
  ask(state, 'u3', 'x', 0);
  fireSpecialesAtPhaseStart(state, 'pioche');
  fireSpecialesAtPhaseStart(state, 'reponse');
  assert.equal(state.specialePending, null);
  assert.equal(state.boardBySeat['u3']!.questionSlots[0]!.length, 1); // Spéciale 2 of the dead: no effect
  assert.equal(state.players['u4']!.powers.length, 1);
  assert.equal(state.boardBySeat['u2']!.specialSlot, null);
  assert.equal(state.boardBySeat['u1']!.specialSlot, null);
  assert.ok(state.specialesShown!.every((s) => s.noEffect));
  assert.equal(state.specialesShown!.length, 2);
});

test('#1835 a triggered Spéciale is shown to every seat, then discarded; cleared at the turn end', () => {
  const state = game(45);
  pose(state, 'u2', 3);
  fireSpecialesAtPhaseStart(state, 'question');
  for (const u of ['u1', 'u2', 'u3', 'u4']) {
    const shown = project(state, u).specialesShown;
    assert.deepEqual(shown, [{ owner: 'u2', cardId: 'act_action_special_3', effectKey: 'action_special_3', noEffect: false }]);
  }
  assert.ok(state.discard.actions.includes('act_action_special_3'));
  advanceTurn(state);
  assert.deepEqual(project(state, 'u1').specialesShown, []);
});

test('#1835 Spéciale 7: choice lists the pile, only the owner sees it; a bad pick is refused; auto = top of the pile', () => {
  const state = game(46);
  pose(state, 'u1', 7);
  fireSpecialesAtPhaseStart(state, 'pioche');
  const view = project(state, 'u1').specialeChoice;
  assert.equal(view?.effectKey, 'action_special_7');
  assert.equal(project(state, 'u2').specialeChoice, null);
  rejects(() => answerSpeciale(state, 'u1', { kind: 'pouvoir', effectKey: 'nope' }));
  const top = state.drawPiles.pouvoirs[state.drawPiles.pouvoirs.length - 1]!;
  assert.deepEqual(autoSpecialeChoice(state, 'u1', 'action_special_7'), { kind: 'pouvoir', effectKey: top.replace(/^pow_/, '') });
  answerSpeciale(state, 'u1', null);
  assert.ok(state.players['u1']!.powers.includes(top));
});

test('#1835 Spéciale 8: exactly 2 attributs, present in the pile', () => {
  const state = game(47);
  pose(state, 'u1', 8);
  fireSpecialesAtPhaseStart(state, 'pioche');
  rejects(() => answerSpeciale(state, 'u1', { kind: 'attributs', valeurs: ['rouges'] }));
  const before = state.players['u1']!.hand.attributs.length;
  answerSpeciale(state, 'u1', { kind: 'attributs', valeurs: ['bleus', 'bleus'] });
  const got = state.players['u1']!.hand.attributs.slice(before);
  assert.deepEqual(got.map((id) => id.replace(/^attr_/, '').replace(/_\d+$/, '')), ['bleus', 'bleus']);
});

test('#1835 P35: a question submission is validated whole before anything is applied', () => {
  const state = game(48);
  state.players['u1']!.hand.attributs.push('q1');
  state.players['u1']!.hand.actions.push('act_action_special_3');
  const intent = { plays: [{ cardId: 'q1', card: grec('q1'), targetSeat: 0 }] }; // self-target
  rejects(() => validateQuestions(state, 'u1', intent), 'SELF_TARGET');
  assert.equal(state.boardBySeat['u1']!.specialSlot, null);
});
