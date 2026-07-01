import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './setup.js';
import {
  applyPioche,
  applyQuestions,
  evaluateQuestion,
  resolveReponsePhase,
  advanceTurn,
  RuleError,
} from './rules.js';
import { GODS } from './data/gods.js';
import type { AttributCard } from './types.js';

const seats = [
  { userId: 'u1', displayName: 'A' },
  { userId: 'u2', displayName: 'B' },
  { userId: 'u3', displayName: 'C' },
  { userId: 'u4', displayName: 'D' },
];

test('evaluateQuestion: pantheon attribut resolves against god truth', () => {
  const card: AttributCard = { id: 'c', type: 'attribut', axe: 'pantheon', valeur: 'grec' };
  assert.equal(evaluateQuestion('zeus', card), true);
  assert.equal(evaluateQuestion('loki', card), false);
});

test('evaluateQuestion: multiple resolves by membership', () => {
  assert.equal(
    evaluateQuestion('zeus', { id: 'm', type: 'action', subtype: 'multiple', gods: ['zeus', 'odin', 'isis', 'loki'], effectKey: 'm' }),
    true,
  );
  assert.equal(
    evaluateQuestion('athena', { id: 'm', type: 'action', subtype: 'multiple', gods: ['zeus', 'odin', 'isis', 'loki'], effectKey: 'm' }),
    false,
  );
});

test('pioche: draws 2 attributs and keeps exactly one power', () => {
  const { state } = createGame('r', seats, 3);
  const before = state.players['u1']!.hand.attributs.length;
  applyPioche(state, 'u1', {});
  assert.equal(state.players['u1']!.hand.attributs.length, before + 2);
  assert.equal(state.players['u1']!.powers.length, 1);
});

test('question: rejects two questions to the same target', () => {
  const { state } = createGame('r', seats, 5);
  const p = state.players['u1']!;
  p.hand.attributs.push('x1', 'x2');
  const card: AttributCard = { id: 'x1', type: 'attribut', axe: 'pantheon', valeur: 'grec' };
  const card2: AttributCard = { id: 'x2', type: 'attribut', axe: 'genre', valeur: 'feminin' };
  assert.throws(
    () =>
      applyQuestions(state, 'u1', {
        plays: [
          { cardId: 'x1', card, targetSeat: 1 },
          { cardId: 'x2', card: card2, targetSeat: 1 },
        ],
      }),
    (e: unknown) => e instanceof RuleError && e.code === 'DUPLICATE_TARGET',
  );
});

test('question: Spéciale cannot be played as a question', () => {
  const { state } = createGame('r', seats, 9);
  state.players['u1']!.hand.actions.push('s1');
  assert.throws(
    () =>
      applyQuestions(state, 'u1', {
        plays: [{ cardId: 's1', card: { id: 's1', type: 'action', subtype: 'speciale', effectKey: 's', triggerPhase: 'question' }, targetSeat: 1 }],
      }),
    (e: unknown) => e instanceof RuleError && e.code === 'SPECIALE_AS_QUESTION',
  );
});

test('réponse: a "oui" earns the asked player an action draw', () => {
  const { state } = createGame('r', seats, 11);
  // Force u2's god to a known pantheon and ask a matching question from u1.
  state.players['u2']!.god = 'zeus';
  const grec = GODS['zeus'].pantheon; // 'grec'
  const card: AttributCard = { id: 'q1', type: 'attribut', axe: 'pantheon', valeur: grec };
  state.players['u1']!.hand.attributs.push('q1');
  applyQuestions(state, 'u1', { plays: [{ cardId: 'q1', card, targetSeat: 1 }] });

  const actionsBefore = state.players['u2']!.hand.actions.length;
  const results = resolveReponsePhase(state);
  const r = results.find((x) => x.cardId === 'q1')!;
  assert.equal(r.oui, true);
  assert.equal(state.players['u2']!.hand.actions.length, actionsBefore + 1);
});

test('advanceTurn: rotates meneur clockwise and bumps tour', () => {
  const { state } = createGame('r', seats, 13);
  assert.equal(state.meneurIndex, 0);
  assert.equal(state.tour, 1);
  advanceTurn(state);
  assert.equal(state.meneurIndex, 1);
  assert.equal(state.tour, 2);
});
