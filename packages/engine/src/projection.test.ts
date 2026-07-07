import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './setup.js';
import { project } from './projection.js';
import { GOD_IDS } from './types.js';

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
