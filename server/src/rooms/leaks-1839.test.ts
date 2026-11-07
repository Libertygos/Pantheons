import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, type AttributCard } from '@pantheons/engine';
import { MatchController, type PhaseEvent } from './barrier.js';
import { redactEvent } from './events.js';

const seats = ['u1', 'u2', 'u3', 'u4'].map((userId) => ({ userId, displayName: userId }));

function fresh() {
  const { state, index } = createGame('r', seats, 99);
  const events: PhaseEvent[] = [];
  const c = new MatchController(state, index, (e) => events.push(e));
  return { c, index, events };
}

function toQuestionPhase(c: MatchController) {
  for (const s of seats) c.submitPioche(s.userId, {});
}

/** u1 -> seat 1 (u2) and u3 -> seat 1 (u2): a bystander (u4) and a target (u2) to compare. */
function playRound(c: MatchController, index: ReturnType<typeof fresh>['index']) {
  toQuestionPhase(c);
  const first = (u: string) => c.state.players[u]!.hand.attributs[0]!;
  const play = (u: string, seat: number) => ({
    plays: [{ cardId: first(u), card: index.attributs.get(first(u))!, targetSeat: seat }],
  });
  const ids = { u1: first('u1'), u3: first('u3') };
  c.submitQuestion('u1', play('u1', 1));
  c.submitQuestion('u2', { plays: [] });
  c.submitQuestion('u3', play('u3', 1));
  c.submitQuestion('u4', { plays: [] });
  return ids;
}

test('#1839 P12: a seat never receives another seat\'s question ids (end-of-answers event)', () => {
  const { c, index, events } = fresh();
  const ids = playRound(c, index);
  const ev = events.find((e) => e.type === 'reponseResolved')!;
  assert.equal(ev.answers!.length, 2);
  // Bystander u4: no id at all, but slot, target, family and oui/non are there.
  const u4 = redactEvent(ev, 'u4');
  const raw4 = JSON.stringify(u4);
  assert.ok(!raw4.includes(ids.u1) && !raw4.includes(ids.u3), 'bystander got a card id');
  assert.ok(!raw4.includes('cardId'));
  for (const a of u4.answers!) {
    assert.equal(typeof a.oui, 'boolean');
    assert.equal(a.cardKind, 'attribut');
    assert.equal(a.targetUser, 'u2');
  }
  // Placer u1 learns only his own id; u3's stays hidden from him.
  const raw1 = JSON.stringify(redactEvent(ev, 'u1'));
  assert.ok(raw1.includes(ids.u1) && !raw1.includes(ids.u3));
  // The questioned player u2 answered both: he knows both.
  const raw2 = JSON.stringify(redactEvent(ev, 'u2'));
  assert.ok(raw2.includes(ids.u1) && raw2.includes(ids.u3));
});

test('#1839 P12: the declaration event carries no guess details to any seat', () => {
  const { c, index, events } = fresh();
  playRound(c, index);
  const guesses = Object.fromEntries(['u2', 'u3', 'u4'].map((u) => [u, 'zeus']));
  c.submitDeclaration('u1', { guesses });
  for (const u of ['u2', 'u3', 'u4']) c.submitDeclaration(u, {});
  const ev = events.find((e) => e.type === 'declarationResolved')!;
  assert.ok(ev, 'declaration resolved');
  for (const viewer of ['u1', 'u2', 'u3', 'u4']) {
    const red = redactEvent(ev, viewer);
    const raw = JSON.stringify(red);
    assert.ok(!raw.includes('matched'), `${viewer} got per-guess results`);
    assert.ok(!raw.includes('zeus'));
    assert.ok(red.declaration!.outcomes.every((o) => Object.keys(o).sort().join() === 'declarer,won'));
  }
  // The table still learns that u1 won or was eliminated.
  const t = redactEvent(ev, 'u4').declaration!;
  assert.equal(t.outcomes[0]!.declarer, 'u1');
  assert.equal(t.outcomes[0]!.won, c.state.winner === 'u1');
});

test('#1839 P29: a second validation in the same phase is refused (every submit kind)', () => {
  const { c } = fresh();
  c.submitPioche('u1', {});
  const handBefore = c.state.players['u1']!.hand.attributs.length;
  assert.throws(() => c.submitPioche('u1', {}), /déjà validé/);
  assert.equal(c.state.players['u1']!.hand.attributs.length, handBefore, 'no second draw');
  for (const u of ['u2', 'u3', 'u4']) c.submitPioche(u, {});
  c.submitQuestion('u1', { plays: [] });
  assert.throws(() => c.submitQuestion('u1', { plays: [] }), /déjà validé/);
  for (const u of ['u2', 'u3', 'u4']) c.submitQuestion(u, { plays: [] });
  assert.equal(c.state.phase, 'reponse');
  c.submitDeclaration('u1', {});
  assert.throws(() => c.submitDeclaration('u1', { guesses: { u2: 'zeus' } }), /déjà validé/);
  assert.equal(c.state.declarations.length, 0);
});

test('#1839 P29: a second Sabotage pass is refused', () => {
  const { c } = fresh();
  toQuestionPhase(c);
  c.state.sabotageWindow = { holders: ['u1', 'u2'], decided: ['u1'], deadline: null };
  assert.throws(() => c.submitSabotagePass('u1'), /déjà décidé/);
});

test('#1839 P34: forged card content is refused / ignored, the server uses its own data', () => {
  const { c, index } = fresh();
  toQuestionPhase(c);
  const id = c.state.players['u1']!.hand.attributs[0]!;
  const real = index.attributs.get(id)!;
  const forged: AttributCard = { id, type: 'attribut', axe: 'pantheon', valeur: real.valeur === 'grec' ? 'nordique' : 'grec' };
  c.submitQuestion('u1', { plays: [{ cardId: id, card: forged, targetSeat: 1 }] });
  assert.deepEqual(c.state.boardBySeat['u1']!.questionSlots[1]![0]!.card, real);
});

test('#1839 P34: a card not in hand, or posed twice, is refused and nothing is placed', () => {
  const { c, index } = fresh();
  toQuestionPhase(c);
  const mine = c.state.players['u1']!.hand.attributs;
  const theirs = c.state.players['u2']!.hand.attributs[0]!;
  const handBefore = [...mine];
  const p = (id: string, seat: number) => ({ cardId: id, card: index.attributs.get(id)!, targetSeat: seat });
  assert.throws(() => c.submitQuestion('u1', { plays: [p(theirs, 1)] }), /absente/);
  assert.throws(() => c.submitQuestion('u1', { plays: [p(mine[0]!, 1), p(mine[0]!, 2)] }), /deux fois/);
  assert.throws(() => c.submitQuestion('u1', { plays: [p(mine[0]!, 1)] }, [{ cardId: mine[0]! }]), /deux fois|Spéciale/);
  assert.deepEqual(c.state.players['u1']!.hand.attributs, handBefore);
  assert.ok(c.state.boardBySeat['u1']!.questionSlots.every((s) => !s || s.length === 0));
  assert.ok(!c.state.barrier.submitted.includes('u1'));
});

test('#1839 P35: a refused question set leaves the Spéciale (and the questions) in hand', () => {
  const { c, index } = fresh();
  toQuestionPhase(c);
  const p = c.state.players['u1']!;
  p.hand.actions.push('act_action_special_3');
  const a0 = p.hand.attributs[0]!;
  const good = { cardId: a0, card: index.attributs.get(a0)!, targetSeat: 1 };
  // refused: self target (invalid question) with a valid Spéciale
  assert.throws(() => c.submitQuestion('u1', { plays: [{ ...good, targetSeat: 0 }] }, [{ cardId: 'act_action_special_3' }]));
  // refused: unknown Spéciale id next to a valid question
  assert.throws(() => c.submitQuestion('u1', { plays: [good] }, [{ cardId: 'act_nope' }]));
  assert.equal(c.state.boardBySeat['u1']!.specialSlot, null);
  assert.ok(p.hand.actions.includes('act_action_special_3'));
  assert.ok(p.hand.attributs.includes(a0));
  assert.ok(!c.state.barrier.submitted.includes('u1'));
  // The same Spéciale + question is accepted whole once valid.
  c.submitQuestion('u1', { plays: [good] }, [{ cardId: 'act_action_special_3' }]);
  assert.ok(c.state.boardBySeat['u1']!.specialSlot);
  assert.ok(!p.hand.actions.includes('act_action_special_3'));
});

test('#1839 P34: malformed plays / specialePlays fail with a clean rule error, nothing placed', () => {
  const { c } = fresh();
  toQuestionPhase(c);
  const bad = (x: unknown) => x as never;
  assert.throws(() => c.submitQuestion('u1', bad({ plays: 'nope' })), /invalides/);
  assert.throws(() => c.submitQuestion('u1', bad({ plays: { length: 1 } })), /invalides/);
  assert.throws(() => c.submitQuestion('u1', { plays: [] }, bad('x')), /invalides/);
  assert.ok(!c.state.barrier.submitted.includes('u1'));
});

test('#1839 P12 room level: each client\'s `event` message is its own redacted copy', async () => {
  const { PantheonsRoom } = await import('./PantheonsRoom.js');
  const { c, index, events } = fresh();
  const ids = playRound(c, index);
  const ev = events.find((e) => e.type === 'reponseResolved')!;
  const room = new PantheonsRoom() as unknown as {
    clientByUser: Map<string, { send(t: string, m: unknown): void }>;
    controller: MatchController | null;
    onPhaseEvent(e: PhaseEvent): void;
    broadcastProjections(): void;
    setPatchRate(ms: number | null): void;
    clock: { stop(): void };
  };
  const sent: Record<string, { type: string; msg: unknown }[]> = {};
  for (const u of ['u1', 'u2', 'u3', 'u4']) {
    sent[u] = [];
    room.clientByUser.set(u, { send: (type, msg) => sent[u]!.push({ type, msg }) });
  }
  room.setPatchRate(null); // the Room constructor starts a patch interval that would keep node alive
  room.clock.stop();
  room.controller = c;
  room.broadcastProjections = () => {}; // projections are covered by the engine tests
  room.onPhaseEvent(ev);
  for (const u of ['u1', 'u2', 'u3', 'u4']) {
    const got = sent[u]!.filter((m) => m.type === 'event');
    assert.equal(got.length, 1);
    assert.deepEqual(got[0]!.msg, redactEvent(ev, u));
  }
  // u4 may see neither card id; u1 only his own.
  const raw4 = JSON.stringify(sent['u4']);
  assert.ok(!raw4.includes(ids.u1) && !raw4.includes(ids.u3));
  const raw1 = JSON.stringify(sent['u1']);
  assert.ok(raw1.includes(ids.u1) && !raw1.includes(ids.u3));
});
