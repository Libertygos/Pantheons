import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './setup.js';
import { project } from './projection.js';
import { applyQuestions, placeSpeciale, resolveReponsePhase } from './rules.js';
import { GOD_IDS } from './types.js';
import type { ActionCard, AttributCard } from './types.js';

const seats = [
  { userId: 'u1', displayName: 'Alice' },
  { userId: 'u2', displayName: 'Bob' },
  { userId: 'u3', displayName: 'Carol' },
  { userId: 'u4', displayName: 'Dan' },
];

test('projection: viewer sees own god but never another player\'s secret god', () => {
  const { state } = createGame('r1', seats, 42);
  const view = project(state, 'u1');

  assert.equal(view.self.god, state.players['u1']!.god);

  // No opponent view carries a god / hand contents.
  for (const opp of view.opponents) {
    assert.ok(!('god' in opp), 'opponent view must not contain god');
    assert.ok(!('hand' in opp), 'opponent view must not contain hand contents');
  }

  // Deep scan: the serialized projection must not contain any OTHER player's GodId.
  const others = seats.filter((s) => s.userId !== 'u1').map((s) => state.players[s.userId]!.god);
  const serialized = JSON.stringify({ ...view, self: { ...view.self, god: '__self__' } });
  for (const godId of others) {
    // A god id could coincide with the viewer's own; only fail if it's exclusively another's.
    if (godId === state.players['u1']!.god) continue;
    assert.ok(!serialized.includes(`"${godId}"`), `projection leaked god ${godId}`);
  }
});

test('projection: opponents expose counts, not contents', () => {
  const { state } = createGame('r1', seats, 7);
  state.players['u2']!.hand.attributs.push('secret_a', 'secret_b');
  state.players['u2']!.hand.actions.push('secret_c');
  const view = project(state, 'u1');
  const opp = view.opponents.find((o) => o.userId === 'u2')!;
  assert.equal(opp.handCounts.attributs, 2);
  assert.equal(opp.handCounts.actions, 1);
  assert.ok(!JSON.stringify(view).includes('secret_a'));
  assert.ok(!JSON.stringify(view).includes('secret_c'));
});

test('projection with index: viewer gets own card detail, opponents leak nothing', () => {
  const { state, index } = createGame('r1', seats, 99);
  // Give players distinct hands so a leak is detectable.
  state.players['u1']!.hand.attributs.push(state.drawPiles.attributs.pop()!);
  state.players['u2']!.hand.attributs.push(state.drawPiles.attributs.pop()!);

  const view = project(state, 'u1', index);

  // Own detail resolved 1:1 against own ids.
  assert.equal(view.self.handCards!.attributs.length, view.self.hand.attributs.length);
  for (const card of view.self.handCards!.attributs) {
    assert.ok(view.self.hand.attributs.includes(card.id));
  }
  assert.equal(view.self.powerCards!.length, view.self.powers.length);

  // Another player's hand card id must not appear anywhere in the serialized projection.
  const u2CardId = state.players['u2']!.hand.attributs[0]!;
  assert.ok(!JSON.stringify(view).includes(`"${u2CardId}"`), 'projection leaked opponent card id');
});

test('projection: every god id is a known enum key', () => {
  const { state } = createGame('r1', seats, 1);
  for (const s of seats) {
    assert.ok(GOD_IDS.includes(state.players[s.userId]!.god), 'dealt god must be valid');
  }
});

test('projection: posed questions are FACE DOWN — placer sees content, target after resolution, bystanders never', () => {
  const { state } = createGame('r1', seats, 55);
  const card: AttributCard = { id: 'q_secret', type: 'attribut', axe: 'pantheon', valeur: 'grec' };
  state.players['u1']!.hand.attributs.push('q_secret');
  applyQuestions(state, 'u1', { plays: [{ cardId: 'q_secret', card, targetSeat: 1 }] });

  const placedFor = (viewer: string) => project(state, viewer).boardBySeat['u1']!.questionSlots[1]![0]!;

  // Before resolution: placer sees it; target and bystander see only kind + occupancy.
  assert.equal(placedFor('u1').card?.id, 'q_secret');
  assert.equal(placedFor('u2').card, null);
  assert.equal(placedFor('u3').card, null);
  assert.equal(placedFor('u3').cardKind, 'attribut');
  assert.ok(!JSON.stringify(project(state, 'u3')).includes('q_secret'), 'bystander projection leaked the question');

  // After resolution: the target now sees what it answered; bystanders still don't.
  resolveReponsePhase(state);
  assert.equal(placedFor('u2').card?.id, 'q_secret');
  assert.equal(placedFor('u3').card, null);
  assert.equal(typeof placedFor('u3').answeredOui, 'boolean'); // oui/non stays public
});

test('projection: special slot content is owner-only (occupancy public)', () => {
  const { state } = createGame('r1', seats, 57);
  const speciale: ActionCard = {
    id: 'act_action_special_5', type: 'action', subtype: 'speciale',
    effectKey: 'action_special_5', triggerPhase: 'pioche',
  };
  state.players['u1']!.hand.actions.push(speciale.id);
  placeSpeciale(state, 'u1', speciale, { targetSeat: 2 });

  const own = project(state, 'u1').boardBySeat['u1']!.specialSlot!;
  assert.equal((own.card as ActionCard).effectKey, 'action_special_5');
  assert.equal(own.targetSeat, 2);

  const other = project(state, 'u2').boardBySeat['u1']!.specialSlot!;
  assert.equal(other.card, null);
  assert.equal(other.targetSeat, -1, 'the spéciale target choice must not leak');
  const opp = project(state, 'u2').opponents.find((o) => o.userId === 'u1')!;
  assert.equal(opp.hasSpecialCard, true);
});

test('projection: undealt personnages (Déduction pool) never leak', () => {
  const { state } = createGame('r1', seats, 59);
  for (const s of seats) {
    const view = project(state, s.userId);
    assert.ok(!('undealtGods' in view), 'projection must not carry undealtGods');
    const serialized = JSON.stringify(view);
    for (const god of state.undealtGods) {
      assert.ok(!serialized.includes(`"${god}"`), `projection leaked undealt god ${god}`);
    }
  }
});
