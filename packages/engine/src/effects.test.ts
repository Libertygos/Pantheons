/**
 * Effects wired from the transcribed card faces (docs/card-catalog.md §3–4, 2026-07-07):
 * power draw/question modifiers, Non malus, Spéciale triggers, activations, Âmes sœurs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './setup.js';
import {
  activatePower,
  applyPioche,
  applyQuestions,
  fireSpecialesAtPhaseStart,
  placeSpeciale,
  questionCap,
  resolveReponsePhase,
  RuleError,
} from './rules.js';
import { resolveDeclarations } from './declaration.js';
import { GODS } from './data/gods.js';
import { getAction } from './data/actions.js';
import type { ActionCard, AttributCard, GameState } from './types.js';

const seats = [
  { userId: 'u1', displayName: 'A' },
  { userId: 'u2', displayName: 'B' },
  { userId: 'u3', displayName: 'C' },
  { userId: 'u4', displayName: 'D' },
];

function game(seed = 1): GameState {
  return createGame('r', seats, seed).state;
}

/** Force a player's (single) power to a known key. */
function givePower(state: GameState, uid: string, key: string): void {
  state.players[uid]!.powers = [`pow_${key}`];
  state.players[uid]!.clonedPowerKey = null;
}

function attributCard(id: string, valeur: 'grec' | 'feminin' = 'grec'): AttributCard {
  return valeur === 'grec'
    ? { id, type: 'attribut', axe: 'pantheon', valeur: 'grec' }
    : { id, type: 'attribut', axe: 'genre', valeur: 'feminin' };
}

function specialeCard(n: number): ActionCard {
  const def = getAction(`action_special_${n}`)!;
  return {
    id: `act_${def.effectKey}`, type: 'action', subtype: 'speciale',
    effectKey: def.effectKey, triggerPhase: def.triggerPhase!,
  };
}

// ---- deck integrity ---------------------------------------------------------

test('setup: full 27-card action deck (9 non / 9 multiple / 9 spéciale) with payloads', () => {
  const state = game();
  assert.equal(state.drawPiles.actions.length, 27);
  const nonIds = state.drawPiles.actions.filter((id) => id.startsWith('act_action_non_'));
  assert.equal(nonIds.length, 9);
  // Non cards carry a question and multiples carry their transcribed god set.
  const m1 = getAction('action_multiple_1')!;
  assert.deepEqual(m1.gods, ['brahma', 're', 'zeus', 'loki']);
  const n7 = getAction('action_non_7')!;
  assert.equal(n7.axe, 'couleurYeux');
  assert.equal(n7.valeur, 'rouges');
  // Undealt personnages tracked for Déduction.
  assert.equal(state.undealtGods.length, 12 - seats.length);
});

// ---- pioche modifiers -------------------------------------------------------

test('Étude: pioche draws 1 attribut + 1 action instead of 2 attributs', () => {
  const state = game(3);
  givePower(state, 'u1', 'etude');
  const p = state.players['u1']!;
  const attrBefore = p.hand.attributs.length;
  const actBefore = p.hand.actions.length;
  applyPioche(state, 'u1', {});
  assert.equal(p.hand.attributs.length, attrBefore + 1);
  assert.equal(p.hand.actions.length, actBefore + 1);
});

test('Optimisme: 3 attributs when no oui last turn (and not on tour 1)', () => {
  const state = game(5);
  givePower(state, 'u1', 'optimisse');
  applyPioche(state, 'u1', {});
  assert.equal(state.players['u1']!.hand.attributs.length, 2); // tour 1: no previous turn

  state.tour = 2;
  state.lastTurn = { ouiFor: {}, nonAnswerers: {} };
  const before = state.players['u1']!.hand.attributs.length;
  applyPioche(state, 'u1', {});
  assert.equal(state.players['u1']!.hand.attributs.length, before + 3);
});

// ---- question caps ----------------------------------------------------------

test('Connaissance raises the cap to 3; Concentration allows stacking a target', () => {
  const state = game(7);
  givePower(state, 'u1', 'connaissance');
  assert.equal(questionCap(state, 'u1'), 3);

  givePower(state, 'u2', 'concentration');
  const p = state.players['u2']!;
  p.hand.attributs.push('x1', 'x2');
  applyQuestions(state, 'u2', {
    plays: [
      { cardId: 'x1', card: attributCard('x1'), targetSeat: 0 },
      { cardId: 'x2', card: attributCard('x2', 'feminin'), targetSeat: 0 },
    ],
  });
  assert.equal(state.boardBySeat['u2']!.questionSlots[0]!.length, 2);
});

test('Refus royal: blocks a non-answerer from asking this tour', () => {
  const state = game(9);
  givePower(state, 'u1', 'refus_royal');
  state.tour = 2;
  state.lastTurn = { ouiFor: {}, nonAnswerers: { u1: ['u3'] } };
  activatePower(state, 'u1', { effectKey: 'refus_royal', target: 'u3' });
  state.players['u3']!.hand.attributs.push('x1');
  assert.throws(
    () => applyQuestions(state, 'u3', { plays: [{ cardId: 'x1', card: attributCard('x1'), targetSeat: 0 }] }),
    (e: unknown) => e instanceof RuleError && e.code === 'ASK_BLOCKED',
  );
  // Passing (no plays) stays legal.
  applyQuestions(state, 'u3', { plays: [] });
});

// ---- Non effects ------------------------------------------------------------

test('Non 7 (yeux rouges): on « non », the answerer discards their power', () => {
  const state = game(11);
  state.players['u2']!.god = 'zeus'; // yeux bleus → répond non
  const card: ActionCard = {
    id: 'act_action_non_7', type: 'action', subtype: 'non',
    axe: 'couleurYeux', valeur: 'rouges', effectKey: 'action_non_7',
  };
  state.players['u1']!.hand.actions.push(card.id);
  applyQuestions(state, 'u1', { plays: [{ cardId: card.id, card, targetSeat: 1 }] });
  const { answers } = resolveReponsePhase(state);
  assert.equal(answers.find((a) => a.cardId === card.id)!.oui, false);
  assert.equal(state.players['u2']!.powers.length, 0);
  assert.equal(state.discard.pouvoirs.length, 1);
  // « aucun oui » stats recorded for next turn's powers.
  assert.equal(state.lastTurn.ouiFor['u1'], undefined);
  assert.deepEqual(state.lastTurn.nonAnswerers['u1'], ['u2']);
});

test('Non 3 (Panthéon Egyptien): on « non », asker and answerer swap powers', () => {
  const state = game(13);
  state.players['u2']!.god = 'zeus'; // pas égyptien → non
  givePower(state, 'u1', 'etude');
  givePower(state, 'u2', 'sabotage');
  const card: ActionCard = {
    id: 'act_action_non_3', type: 'action', subtype: 'non',
    axe: 'pantheon', valeur: 'egyptien', effectKey: 'action_non_3',
  };
  state.players['u1']!.hand.actions.push(card.id);
  applyQuestions(state, 'u1', { plays: [{ cardId: card.id, card, targetSeat: 1 }] });
  resolveReponsePhase(state);
  assert.deepEqual(state.players['u1']!.powers, ['pow_sabotage']);
  assert.deepEqual(state.players['u2']!.powers, ['pow_etude']);
});

test('Non 1 (féminin): on « non », the answerer gives 2 cards to the asker', () => {
  const state = game(15);
  state.players['u2']!.god = 'zeus'; // masculin → non
  state.players['u2']!.hand.attributs.push('attr_grec_1');
  state.players['u2']!.hand.actions.push('act_action_multiple_9');
  const card: ActionCard = {
    id: 'act_action_non_1', type: 'action', subtype: 'non',
    axe: 'genre', valeur: 'feminin', effectKey: 'action_non_1',
  };
  state.players['u1']!.hand.actions.push(card.id);
  applyQuestions(state, 'u1', { plays: [{ cardId: card.id, card, targetSeat: 1 }] });
  resolveReponsePhase(state);
  assert.ok(state.players['u1']!.hand.attributs.includes('attr_grec_1'));
  assert.ok(state.players['u1']!.hand.actions.includes('act_action_multiple_9'));
  assert.equal(state.players['u2']!.hand.attributs.length, 0);
});

// ---- Exécution --------------------------------------------------------------

test('Exécution: on answering « oui », skip the action draw and discard the chosen power', () => {
  const state = game(17);
  state.players['u2']!.god = 'zeus';
  givePower(state, 'u2', 'execution');
  givePower(state, 'u3', 'sabotage');
  activatePower(state, 'u2', { effectKey: 'execution', target: 'u3' });

  const card = attributCard('q1'); // grec → u2 répond oui
  state.players['u1']!.hand.attributs.push('q1');
  applyQuestions(state, 'u1', { plays: [{ cardId: 'q1', card, targetSeat: 1 }] });
  const actBefore = state.players['u2']!.hand.actions.length;
  resolveReponsePhase(state);
  assert.equal(state.players['u2']!.hand.actions.length, actBefore); // draw skipped
  assert.equal(state.players['u3']!.powers.length, 0); // power executed
});

// ---- Spéciales --------------------------------------------------------------

test('Spéciale 5 (pioche): the chosen player discards their power at phase start', () => {
  const state = game(19);
  givePower(state, 'u3', 'connaissance');
  state.players['u1']!.hand.actions.push('act_action_special_5');
  placeSpeciale(state, 'u1', specialeCard(5), { targetSeat: 2 });
  fireSpecialesAtPhaseStart(state, 'pioche');
  assert.equal(state.players['u3']!.powers.length, 0);
  assert.equal(state.boardBySeat['u1']!.specialSlot, null); // discarded after firing
  assert.ok(state.discard.actions.includes('act_action_special_5'));
});

test('Spéciale 1 (réponse): watches the target; a « oui » privately reveals their god', () => {
  const state = game(21);
  state.players['u2']!.god = 'zeus';
  state.players['u1']!.hand.actions.push('act_action_special_1');
  placeSpeciale(state, 'u1', specialeCard(1), { targetSeat: 1 });
  const card = attributCard('q1'); // grec → oui
  state.players['u1']!.hand.attributs.push('q1');
  applyQuestions(state, 'u1', { plays: [{ cardId: 'q1', card, targetSeat: 1 }] });
  fireSpecialesAtPhaseStart(state, 'reponse');
  const { reveals } = resolveReponsePhase(state);
  assert.deepEqual(reveals, [{ to: 'u1', kind: 'personnage', aboutUser: 'u2', god: 'zeus' }]);
});

test('Spéciale 1: placement without a target is rejected', () => {
  const state = game(23);
  state.players['u1']!.hand.actions.push('act_action_special_1');
  assert.throws(
    () => placeSpeciale(state, 'u1', specialeCard(1)),
    (e: unknown) => e instanceof RuleError && e.code === 'SPECIALE_TARGET_REQUIRED',
  );
});

test('Spéciale 3 (question): question cap becomes the live player count for that tour', () => {
  const state = game(25);
  state.players['u1']!.hand.actions.push('act_action_special_3');
  placeSpeciale(state, 'u1', specialeCard(3));
  fireSpecialesAtPhaseStart(state, 'question');
  assert.equal(questionCap(state, 'u1'), seats.length);
});

test('Spéciale 7 (pioche): takes the coveted power from the pile', () => {
  const state = game(27);
  state.players['u1']!.hand.actions.push('act_action_special_7');
  const coveted = state.drawPiles.pouvoirs.find((id) => id.startsWith('pow_'));
  assert.ok(coveted);
  const key = coveted!.replace(/^pow_/, '');
  placeSpeciale(state, 'u1', specialeCard(7), { pouvoirChoisi: key });
  fireSpecialesAtPhaseStart(state, 'pioche');
  assert.ok(state.players['u1']!.powers.includes(coveted!));
  assert.ok(!state.drawPiles.pouvoirs.includes(coveted!));
});

test('Spéciale 8 (pioche): takes two chosen attributs from the pile', () => {
  const state = game(29);
  state.players['u1']!.hand.actions.push('act_action_special_8');
  placeSpeciale(state, 'u1', specialeCard(8), { attributsChoisis: ['rouges', 'nordique'] });
  fireSpecialesAtPhaseStart(state, 'pioche');
  const hand = state.players['u1']!.hand.attributs;
  assert.ok(hand.some((id) => id.startsWith('attr_rouges_')));
  assert.ok(hand.some((id) => id.startsWith('attr_nordique_')));
});

test('Spéciale 9 (pioche): may stack two questions on the same target this tour', () => {
  const state = game(31);
  state.players['u1']!.hand.actions.push('act_action_special_9');
  placeSpeciale(state, 'u1', specialeCard(9));
  fireSpecialesAtPhaseStart(state, 'pioche');
  const p = state.players['u1']!;
  p.hand.attributs.push('x1', 'x2');
  applyQuestions(state, 'u1', {
    plays: [
      { cardId: 'x1', card: attributCard('x1'), targetSeat: 1 },
      { cardId: 'x2', card: attributCard('x2', 'feminin'), targetSeat: 1 },
    ],
  });
  assert.equal(state.boardBySeat['u1']!.questionSlots[1]!.length, 2);
});

test('Spéciale 2 (réponse): discards two posed questions, those aiming its owner first', () => {
  const state = game(33);
  // u2 and u3 each pose one question against u1 (seat 0).
  for (const [asker, cid] of [['u2', 'y1'], ['u3', 'y2']] as const) {
    state.players[asker]!.hand.attributs.push(cid);
    applyQuestions(state, asker, { plays: [{ cardId: cid, card: attributCard(cid), targetSeat: 0 }] });
  }
  state.players['u1']!.hand.actions.push('act_action_special_2');
  placeSpeciale(state, 'u1', specialeCard(2));
  fireSpecialesAtPhaseStart(state, 'reponse');
  assert.equal(state.boardBySeat['u2']!.questionSlots[0]!.length, 0);
  assert.equal(state.boardBySeat['u3']!.questionSlots[0]!.length, 0);
  const { answers } = resolveReponsePhase(state);
  assert.equal(answers.length, 0);
});

// ---- activations ------------------------------------------------------------

test('Sabotage: discards a posed attribut when someone has 3+ questions, once per tour', () => {
  const state = game(35);
  givePower(state, 'u4', 'sabotage');
  givePower(state, 'u1', 'concentration');
  // 3 questions against u2 (seat 1): two stacked from u1 + one from u3.
  state.players['u1']!.hand.attributs.push('x1', 'x2');
  applyQuestions(state, 'u1', {
    plays: [
      { cardId: 'x1', card: attributCard('x1'), targetSeat: 1 },
      { cardId: 'x2', card: attributCard('x2', 'feminin'), targetSeat: 1 },
    ],
  });
  state.players['u3']!.hand.attributs.push('x3');
  applyQuestions(state, 'u3', { plays: [{ cardId: 'x3', card: attributCard('x3'), targetSeat: 1 }] });

  activatePower(state, 'u4', { effectKey: 'sabotage', placer: 'u1', targetSeat: 1, stackIndex: 0 });
  assert.equal(state.boardBySeat['u1']!.questionSlots[1]!.length, 1);
  assert.throws(
    () => activatePower(state, 'u4', { effectKey: 'sabotage', placer: 'u3', targetSeat: 1 }),
    (e: unknown) => e instanceof RuleError && e.code === 'POWER_ALREADY_USED',
  );
});

test('Clonage: copies the target power; Étude then applies to the cloner', () => {
  const state = game(37);
  givePower(state, 'u1', 'clonage');
  givePower(state, 'u2', 'etude');
  activatePower(state, 'u1', { effectKey: 'clonage', target: 'u2' });
  assert.equal(state.players['u1']!.clonedPowerKey, 'etude');
  const p = state.players['u1']!;
  const actBefore = p.hand.actions.length;
  applyPioche(state, 'u1', {});
  assert.equal(p.hand.actions.length, actBefore + 1); // Étude cloné
});

test('Déduction: reveals an undealt personnage privately (condition: no oui last turn)', () => {
  const state = game(39);
  givePower(state, 'u1', 'deduction');
  state.tour = 2;
  state.lastTurn = { ouiFor: {}, nonAnswerers: {} };
  const { reveal } = activatePower(state, 'u1', { effectKey: 'deduction' });
  assert.ok(reveal?.god);
  assert.ok(state.undealtGods.includes(reveal!.god!));
  // Every dealt god is someone's secret; the reveal must be an UNDEALT card.
  for (const uid of state.seatOrder) assert.notEqual(reveal!.god, state.players[uid]!.god);
});

test('Espionnage: privately reads a question posed by another player', () => {
  const state = game(41);
  givePower(state, 'u3', 'espionnage');
  state.tour = 2;
  state.lastTurn = { ouiFor: {}, nonAnswerers: {} };
  state.players['u1']!.hand.attributs.push('q1');
  applyQuestions(state, 'u1', { plays: [{ cardId: 'q1', card: attributCard('q1'), targetSeat: 1 }] });
  const { reveal } = activatePower(state, 'u3', { effectKey: 'espionnage', placer: 'u1', targetSeat: 1 });
  assert.equal(reveal?.kind, 'question');
  assert.equal(reveal?.card?.id, 'q1');
});

// ---- Âmes sœurs -------------------------------------------------------------

test('Âmes sœurs: the declarer need not guess the other soulmate holder', () => {
  const state = game(43);
  givePower(state, 'u1', 'ames_soeurs_1');
  givePower(state, 'u3', 'ames_soeurs_2');
  const guesses: Record<string, string> = {};
  for (const opp of ['u2', 'u4']) guesses[opp] = state.players[opp]!.god;
  // u3 deliberately NOT guessed.
  state.declarations.push({ declarer: 'u1', guesses: guesses as Record<string, never> });
  const result = resolveDeclarations(state);
  assert.equal(result.winner, 'u1');
});
