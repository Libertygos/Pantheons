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
  const meneurBefore = c.state.meneurIndex; // first meneur is drawn at random (#1837)
  for (const s of seats) c.submitPioche(s.userId, {});
  assert.equal(c.state.phase, 'question');

  for (const s of seats) c.submitQuestion(s.userId, { plays: [] });
  assert.equal(c.state.phase, 'reponse'); // réponse auto-resolved, declaration window open

  const tourBefore = c.state.tour;
  for (const s of seats) c.submitDeclaration(s.userId, {}); // all pass
  assert.equal(c.state.phase, 'pioche');
  assert.equal(c.state.tour, tourBefore + 1);
  assert.equal(c.state.meneurIndex, (meneurBefore + 1) % seats.length); // meneur rotated clockwise
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

// ---- #1835 Spéciales ----

test('#1835 P35: a refused question submission leaves the Spéciale in hand, not placed', () => {
  const c = fresh();
  for (const s of seats) c.submitPioche(s.userId, {});
  const p = c.state.players['u1']!;
  p.hand.actions.push('act_action_special_3');
  const attr = p.hand.attributs[0]!;
  const card = c['index'].attributs.get(attr)!;
  assert.throws(() => c.submitQuestion('u1', { plays: [{ cardId: attr, card, targetSeat: 0 }] }, [{ cardId: 'act_action_special_3' }]));
  assert.equal(c.state.boardBySeat['u1']!.specialSlot, null);
  assert.ok(p.hand.actions.includes('act_action_special_3'));
  assert.ok(p.hand.attributs.includes(attr));
});

test('#1835 Spéciale 7 pauses the pioche until its owner chooses; an absent owner is auto-picked', () => {
  const c = fresh();
  c.state.players['u1']!.hand.actions.push('act_action_special_7');
  for (const s of seats) c.submitPioche(s.userId, {});
  for (const s of seats) c.submitQuestion(s.userId, { plays: [] }, s.userId === 'u1' ? [{ cardId: 'act_action_special_7' }] : []);
  assert.equal(c.state.phase, 'reponse');
  for (const s of seats) c.submitDeclaration(s.userId, {});
  assert.equal(c.state.phase, 'pioche');
  assert.equal(c.state.specialePending?.owner, 'u1');
  assert.throws(() => c.submitPioche('u2', {}));
  const key = c.state.drawPiles.pouvoirs[0]!.replace(/^pow_/, '');
  c.submitSpeciale('u1', { kind: 'pouvoir', effectKey: key });
  assert.equal(c.state.specialePending, null);
  assert.ok(c.state.players['u1']!.powers.includes(`pow_${key}`));
  c.submitPioche('u2', {});
});

test('#1835 Spéciale 2 pauses the réponse; the choice resumes it', () => {
  const c = fresh();
  for (const s of seats) c.submitPioche(s.userId, {});
  c.state.players['u1']!.hand.actions.push('act_action_special_2');
  const att = (u: string) => c.state.players[u]!.hand.attributs[0]!;
  const play = (u: string, seat: number) => ({ plays: [{ cardId: att(u), card: c['index'].attributs.get(att(u))!, targetSeat: seat }] });
  c.submitQuestion('u1', { plays: [] }, [{ cardId: 'act_action_special_2' }]);
  c.submitQuestion('u2', play('u2', 2));
  c.submitQuestion('u3', play('u3', 0));
  c.submitQuestion('u4', { plays: [] });
  assert.equal(c.state.phase, 'reponse');
  assert.equal(c.state.specialePending?.effectKey, 'action_special_2');
  assert.ok(!c.state.reponseProgress);
  assert.throws(() => c.submitDeclaration('u2', {}));
  c.submitSpeciale('u1', null);
  assert.equal(c.state.specialePending, null);
  assert.equal(c.state.barrier.phase, 'reponse'); // resolved, declaration window open
  assert.equal(c.state.lastTurn.tour, c.state.tour);
});

test('#1835 a disconnected Spéciale owner is auto-picked at once', () => {
  const c = fresh();
  c.state.players['u1']!.hand.actions.push('act_action_special_8');
  for (const s of seats) c.submitPioche(s.userId, {});
  for (const s of seats) c.submitQuestion(s.userId, { plays: [] }, s.userId === 'u1' ? [{ cardId: 'act_action_special_8' }] : []);
  for (const s of seats) c.submitDeclaration(s.userId, {});
  assert.equal(c.state.specialePending?.owner, 'u1');
  const before = c.state.players['u1']!.hand.attributs.length;
  c.state.players['u1']!.connected = false;
  c.onConnectivityChange();
  assert.equal(c.state.specialePending, null);
  assert.equal(c.state.players['u1']!.hand.attributs.length, before + 2);
});
