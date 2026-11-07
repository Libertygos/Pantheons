import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyQuestions, type AttributCard } from '@pantheons/engine';
import { MatchController, WINDOW_MS, type MatchTimers } from './barrier.js';

const seats = ['u1', 'u2', 'u3', 'u4'].map((userId) => ({ userId, displayName: userId }));

/** Fake clock: tests advance time by hand, never sleep. */
function fakeClock() {
  let t = 1_000_000;
  let next = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: MatchTimers = {
    now: () => t,
    setTimeout: (fn, ms) => {
      const id = next++;
      pending.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimeout: (h) => void pending.delete(h as number),
  };
  return {
    timers,
    armed: () => pending.size,
    advance(ms: number) {
      t += ms;
      for (const [id, e] of [...pending]) {
        if (e.at <= t) {
          pending.delete(id);
          e.fn();
        }
      }
    },
  };
}

function fresh() {
  const clock = fakeClock();
  const { state, index } = createGame('r', seats, 99);
  let fired = 0;
  const c = new MatchController(state, index, () => {}, () => {}, { timers: clock.timers, onTimer: () => fired++ });
  return { c, clock, fired: () => fired };
}

const attr = (id: string, valeur: 'grec' | 'feminin' = 'grec'): AttributCard =>
  valeur === 'grec'
    ? { id, type: 'attribut', axe: 'pantheon', valeur: 'grec' }
    : { id, type: 'attribut', axe: 'genre', valeur: 'feminin' };

/** Question phase where u2 has 3 questions against him; u1 and u3 already validated. */
function questionPhaseWithOverwhelmed(c: MatchController, holder: string | null) {
  const s = c.state;
  s.phase = 'question';
  s.barrier = { phase: 'question', submitted: [], deadline: null };
  s.players['u1']!.powers = ['pow_concentration'];
  for (const u of ['u2', 'u3', 'u4']) s.players[u]!.powers = [];
  if (holder) s.players[holder]!.powers = ['pow_sabotage'];
  s.players['u1']!.hand.attributs.push('x1', 'x2');
  applyQuestions(s, 'u1', {
    plays: [
      { cardId: 'x1', card: attr('x1'), targetSeat: 1 },
      { cardId: 'x2', card: attr('x2', 'feminin'), targetSeat: 1 },
    ],
  });
  s.players['u3']!.hand.attributs.push('x3');
  applyQuestions(s, 'u3', { plays: [{ cardId: 'x3', card: attr('x3'), targetSeat: 1 }] });
  s.barrier.submitted.push('u1', 'u3');
}

test('#1834 declaration window: one shared deadline, closes at 30 s, silent players pass', () => {
  const { c, clock, fired } = fresh();
  for (const s of seats) c.submitPioche(s.userId, {});
  for (const s of seats) c.submitQuestion(s.userId, { plays: [] });
  assert.equal(c.state.phase, 'reponse');
  assert.equal(c.state.barrier.deadline, 1_000_000 + WINDOW_MS);
  const tour = c.state.tour;
  c.submitDeclaration('u1', {}); // one player chooses; the deadline does not move
  clock.advance(WINDOW_MS - 1);
  assert.equal(c.state.phase, 'reponse');
  clock.advance(1);
  assert.equal(c.state.phase, 'pioche'); // u2..u4 silent = Passer
  assert.equal(c.state.tour, tour + 1);
  assert.equal(c.state.declarations.length, 0);
  assert.equal(c.state.barrier.deadline, null);
  assert.equal(fired(), 1);
});

test('#1834 declaration window: a silent player does not cancel a declaration made in time', () => {
  const { c, clock } = fresh();
  for (const s of seats) c.submitPioche(s.userId, {});
  for (const s of seats) c.submitQuestion(s.userId, { plays: [] });
  const guesses: Record<string, string> = {};
  for (const uid of ['u2', 'u3', 'u4']) guesses[uid] = c.state.players[uid]!.god;
  c.submitDeclaration('u1', { guesses });
  clock.advance(WINDOW_MS);
  assert.equal(c.state.status, 'terminee');
  assert.equal(c.state.winner, 'u1');
});

test('#1834 declaration window: no timer left once everyone chose', () => {
  const { c, clock } = fresh();
  for (const s of seats) c.submitPioche(s.userId, {});
  for (const s of seats) c.submitQuestion(s.userId, { plays: [] });
  for (const s of seats) c.submitDeclaration(s.userId, {});
  assert.equal(c.state.phase, 'pioche');
  assert.equal(clock.armed(), 0);
});

test('#1834 no deadline is armed on pioche, question or pending choices', () => {
  const { c, clock } = fresh();
  assert.equal(c.state.barrier.deadline, null);
  assert.equal(clock.armed(), 0);
  c.submitPioche('u1', {});
  c.submitPioche('u2', {});
  c.submitPioche('u3', {});
  c.submitPioche('u4', {});
  assert.equal(c.state.phase, 'question');
  assert.equal(c.state.barrier.deadline, null);
  assert.equal(clock.armed(), 0);
  c.submitQuestion('u1', { plays: [] });
  clock.advance(10 * WINDOW_MS);
  assert.equal(c.state.phase, 'question'); // waits for the humans, forever
  assert.deepEqual(c.state.barrier.submitted, ['u1']);
  // A pending Exécution choice of a connected asker is never auto-declined by time.
  c.state.reponseProgress = {
    pending: { kind: 'execution', asker: 'u1', answerer: 'u2' },
  } as never;
  clock.advance(10 * WINDOW_MS);
  assert.ok((c.state.reponseProgress as { pending?: unknown } | null)?.pending);
  assert.equal(clock.armed(), 0);
});

test('#1834 Sabotage window: opens when a holder meets the condition, closes at 30 s', () => {
  const { c, clock, fired } = fresh();
  questionPhaseWithOverwhelmed(c, 'u4');
  c.submitQuestion('u2', { plays: [] });
  assert.ok(!c.state.sabotageWindow as boolean);
  c.submitQuestion('u4', { plays: [] });
  assert.equal(c.state.phase, 'question'); // held before the answers
  assert.deepEqual(c.state.sabotageWindow?.holders, ['u4']);
  assert.equal(c.state.sabotageWindow?.deadline, 1_000_000 + WINDOW_MS);
  clock.advance(WINDOW_MS - 1);
  assert.ok(c.state.sabotageWindow);
  clock.advance(1);
  assert.ok(!c.state.sabotageWindow); // silence = Passer
  assert.equal(c.state.phase, 'reponse');
  assert.equal(fired(), 1);
});

test('#1834 Sabotage window: Saboter inside the window discards the card and closes it', () => {
  const { c } = fresh();
  questionPhaseWithOverwhelmed(c, 'u4');
  c.submitQuestion('u2', { plays: [] });
  c.submitQuestion('u4', { plays: [] });
  c.activatePower('u4', { effectKey: 'sabotage', placer: 'u1', targetSeat: 1, stackIndex: 0 });
  assert.ok(!c.state.sabotageWindow);
  assert.equal(c.state.phase, 'reponse');
});

test('#1834 Sabotage window: Passer closes it at once; Sabotage outside the window is refused', () => {
  const { c } = fresh();
  questionPhaseWithOverwhelmed(c, 'u4');
  assert.throws(
    () => c.activatePower('u4', { effectKey: 'sabotage', placer: 'u1', targetSeat: 1, stackIndex: 0 }),
    /fenêtre de Sabotage/,
  );
  c.submitQuestion('u2', { plays: [] });
  c.submitQuestion('u4', { plays: [] });
  c.submitSabotagePass('u4');
  assert.ok(!c.state.sabotageWindow);
  assert.equal(c.state.phase, 'reponse');
  assert.throws(
    () => c.activatePower('u4', { effectKey: 'sabotage', placer: 'u1', targetSeat: 1, stackIndex: 0 }),
    /fenêtre de Sabotage/,
  );
});

test('#1834 Sabotage window: a Clonage copying Sabotage is a holder', () => {
  const { c } = fresh();
  questionPhaseWithOverwhelmed(c, null);
  c.state.players['u4']!.powers = ['pow_clonage'];
  c.state.players['u4']!.clonedPowerKey = 'sabotage';
  c.submitQuestion('u2', { plays: [] });
  c.submitQuestion('u4', { plays: [] });
  assert.deepEqual(c.state.sabotageWindow?.holders, ['u4']);
});

test('#1834 Sabotage window: no window without a holder, or when nobody got 3 questions', () => {
  const a = fresh();
  questionPhaseWithOverwhelmed(a.c, null); // 3 questions, nobody holds Sabotage
  a.c.submitQuestion('u2', { plays: [] });
  a.c.submitQuestion('u4', { plays: [] });
  assert.ok(!a.c.state.sabotageWindow);
  assert.equal(a.c.state.phase, 'reponse');

  const b = fresh();
  b.c.state.players['u4']!.powers = ['pow_sabotage']; // holder, but no overwhelmed player
  for (const s of seats) b.c.submitPioche(s.userId, {});
  for (const s of seats) b.c.submitQuestion(s.userId, { plays: [] });
  assert.ok(!b.c.state.sabotageWindow);
  assert.equal(b.c.state.phase, 'reponse');
});

test('#1834 Sabotage window: a disconnected holder passes at once', () => {
  const { c } = fresh();
  questionPhaseWithOverwhelmed(c, 'u4');
  c.state.players['u4']!.connected = false;
  c.submitQuestion('u2', { plays: [] });
  assert.ok(!c.state.sabotageWindow);
  assert.equal(c.state.phase, 'reponse');
});
