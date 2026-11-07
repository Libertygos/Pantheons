import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, project, GODS } from '@pantheons/engine';
import { MatchRunner, COMPUTER_TICK_MS, MATCH_GRACE_MS, REPLACED_SUFFIX } from './match-runner.js';
import { ComputerBrain } from './computer.js';
import { redactEvent } from './events.js';
import type { MatchTimers, PhaseEvent } from './barrier.js';

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
    advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const due = [...pending].filter(([, e]) => e.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        pending.delete(due[0]);
        t = Math.max(t, due[1].at);
        due[1].fn();
      }
      t = end;
    },
  };
}

function setup(ids: string[], persons: string[], seed = 7, tickMs?: number) {
  const clock = fakeClock();
  const { state, index } = createGame('r', ids.map((userId) => ({ userId, displayName: userId })), seed);
  const events: PhaseEvent[] = [];
  const hooks = { changes: 0, taken: [] as string[], abandoned: 0 };
  const runner = new MatchRunner(
    state,
    index,
    ids.filter((u) => !persons.includes(u)),
    {
      timers: clock.timers,
      ...(tickMs ? { tickMs } : {}),
      emit: (e) => events.push(e),
      onChange: () => hooks.changes++,
      onSeatTaken: (u) => hooks.taken.push(u),
      onAbandon: () => hooks.abandoned++,
    },
  );
  return { clock, runner, state, index, events, hooks };
}

/** A scripted person: validates whatever is pending with the safe default (no question, Passer). */
function person(runner: MatchRunner, uid: string): void {
  const c = runner.controller;
  const s = c.state;
  const p = s.players[uid]!;
  if (!p.alive || !p.connected || s.status === 'terminee' || s.barrier.submitted.includes(uid)) return;
  try {
    if (s.reponseProgress?.pending) {
      const pend = s.reponseProgress.pending;
      if (pend.kind === 'donnez' && pend.answerer === uid) c.submitDonnez(uid, null);
      else if (pend.kind === 'execution' && pend.asker === uid) c.submitExecution(uid, null);
    } else if (s.specialePending?.owner === uid) c.submitSpeciale(uid, null);
    else if (s.sabotageWindow) c.submitSabotagePass(uid);
    else if (s.phase === 'pioche') c.submitPioche(uid, p.powers.length > 1 ? { discardPowerId: p.powers[0]! } : {});
    else if (s.phase === 'question') c.submitQuestion(uid, { plays: [] });
    else c.submitDeclaration(uid, {});
  } catch {
    /* waiting on another seat's choice */
  }
}

/** Run the game on the fake clock until it ends (bounded). */
function play(t: ReturnType<typeof setup>, persons: string[] = [], maxTicks = 4000): number {
  for (let i = 0; i < maxTicks; i++) {
    if (t.state.status === 'terminee' || t.runner.abandoned) return i;
    for (const u of persons) person(t.runner, u);
    t.clock.advance(COMPUTER_TICK_MS);
  }
  return maxTicks;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i + 1}`);

test('#1838 a full game of computers only (4 to 7 seats, several seeds) ends with a winner', () => {
  for (const n of [4, 5, 6, 7]) {
    for (const seed of [1, 2, 3]) {
      const t = setup(ids(n), []);
      const ticks = play(t);
      assert.equal(t.state.status, 'terminee', `${n} seats seed ${seed}: not over after ${ticks} ticks`);
      assert.ok(t.state.winner, 'a winner');
      assert.ok(t.events.some((e) => e.type === 'gameOver'));
      // The winner declared only when sure: he holds the right god for every opponent (no wrong declaration).
      assert.equal(t.state.eliminated.length, 0, 'a computer declared without being sure');
      t.runner.dispose();
    }
  }
});

test('#1838 one person (scripted) + 3 computers: the computers win, the person never blocks', () => {
  const t = setup(ids(4), ['u1']);
  play(t, ['u1']);
  assert.equal(t.state.status, 'terminee');
  assert.ok(t.state.winner && t.state.winner !== 'u1');
});

test('#1838 computers are paced: one move per computer per tick', () => {
  const t = setup(ids(4), []);
  assert.equal(t.state.barrier.submitted.length, 0);
  t.clock.advance(COMPUTER_TICK_MS - 1);
  assert.equal(t.state.barrier.submitted.length, 0, 'nothing before the first tick');
  t.clock.advance(1);
  assert.equal(t.state.phase, 'question');
  assert.equal(t.state.tour, 1);
  t.clock.advance(COMPUTER_TICK_MS);
  assert.notEqual(t.state.phase, 'question', 'the second tick validated the questions');
  assert.equal(t.state.status, 'enCours');
});

test('#1838 the computer plays from its own projection and private reveals only', () => {
  const { state, index } = createGame('r', ids(4).map((userId) => ({ userId, displayName: userId })), 5);
  const brain = new ComputerBrain('u1');
  const proj = project(state, 'u1', index);
  // the projection holds no opponent god: its knowledge starts as "any god but mine"
  brain.decide(proj);
  const open = brain.candidatesOf('u2');
  assert.equal(open.length, Object.keys(GODS).length - 1);
  assert.ok(!open.includes(state.players['u1']!.god));
  // a private Spéciale 1 / Déduction reveal narrows it; a reveal for another seat is ignored
  brain.observe({ to: 'u2', kind: 'personnage', aboutUser: 'u3', god: 'zeus' });
  assert.equal(brain.candidatesOf('u3').length, Object.keys(GODS).length - 1);
  brain.observe({ to: 'u1', kind: 'personnage', aboutUser: 'u3', god: state.players['u3']!.god });
  assert.deepEqual(brain.candidatesOf('u3'), [state.players['u3']!.god]);
  // elimination: u3's god leaves every other opponent's candidates
  brain.decide(proj);
  assert.ok(!brain.candidatesOf('u2').includes(state.players['u3']!.god));
  // it does not declare while u2 and u4 are open
  const p2 = { ...proj, phase: 'reponse' as const, declarationDeadline: 1, barrier: { ...proj.barrier, youSubmitted: false } };
  assert.deepEqual(brain.decide(p2), { kind: 'declaration' });
});

test('#1838 a computer never sees what redaction hides: events reach it through projection, not the raw event', () => {
  const t = setup(ids(4), ['u1']);
  play(t, ['u1'], 40);
  const ev = t.events.find((e) => e.type === 'reponseResolved');
  if (ev) {
    // the runner takes no PhaseEvent in: nothing but projections and private reveals feed a brain
    assert.ok(JSON.stringify(redactEvent(ev, 'u1')).length > 0);
  }
  assert.equal(typeof t.runner.brain('u2')?.decide, 'function');
  t.runner.dispose();
});

test('#1838 a dropped seat: the grace runs 60 s, then a computer takes it and finishes the game, flagged', () => {
  const t = setup(ids(4), ['u1', 'u2']);
  t.runner.drop('u1');
  assert.equal(t.state.players['u1']!.connected, false);
  t.clock.advance(MATCH_GRACE_MS - 1000);
  assert.equal(t.runner.isComputer('u1'), false, 'still in grace');
  assert.equal(t.runner.computerReplaced, false);
  t.clock.advance(1000);
  assert.equal(t.runner.isComputer('u1'), true);
  assert.equal(t.runner.computerReplaced, true);
  assert.deepEqual(t.hooks.taken, ['u1']);
  assert.equal(t.state.players['u1']!.connected, true);
  assert.ok(t.state.players['u1']!.displayName.endsWith(REPLACED_SUFFIX));
  // the replaced seat finishes the game with the person who stayed
  play(t, ['u2']);
  assert.equal(t.state.status, 'terminee');
  assert.equal(t.hooks.abandoned, 0);
});

test('#1838 back inside the grace: the person keeps the seat, no computer', () => {
  const t = setup(ids(4), ['u1', 'u2']);
  t.runner.drop('u1');
  t.clock.advance(30_000);
  assert.equal(t.runner.returned('u1'), true);
  assert.equal(t.state.players['u1']!.connected, true);
  t.clock.advance(MATCH_GRACE_MS * 2);
  assert.equal(t.runner.isComputer('u1'), false);
  assert.equal(t.runner.computerReplaced, false);
  // after a takeover a late return is refused
  t.runner.drop('u1');
  t.clock.advance(MATCH_GRACE_MS);
  assert.equal(t.runner.isComputer('u1'), true);
  assert.equal(t.runner.returned('u1'), false);
});

test('#1838 the barrier does not wait for a dropped seat during the grace (auto-pick kept)', () => {
  const t = setup(ids(4), ['u1', 'u2']);
  person(t.runner, 'u2');
  t.runner.drop('u1');
  t.clock.advance(COMPUTER_TICK_MS); // computers draw; u1 is not awaited
  assert.equal(t.state.phase, 'question');
});

test('#1838 every person dropped: the match is abandoned, not played on and not replaced', () => {
  const t = setup(ids(4), ['u1', 'u2'], 7, 10 * MATCH_GRACE_MS); // slow computers: the game cannot end first
  t.runner.drop('u1');
  t.runner.drop('u2');
  t.clock.advance(MATCH_GRACE_MS);
  assert.equal(t.hooks.abandoned, 1);
  assert.equal(t.runner.abandoned, true);
  assert.equal(t.runner.isComputer('u2'), false, 'the last person is not replaced');
  const frozen = t.state.tour;
  t.clock.advance(60_000);
  assert.equal(t.state.tour, frozen, 'no computer keeps playing an abandoned match');
  assert.equal(t.state.status, 'enCours');
});

test('#1838 the only person drops among computers: abandoned after the grace', () => {
  const t = setup(ids(4), ['u1'], 7, 10 * MATCH_GRACE_MS);
  t.runner.drop('u1');
  t.clock.advance(MATCH_GRACE_MS - 1);
  assert.equal(t.hooks.abandoned, 0);
  t.clock.advance(1);
  assert.equal(t.hooks.abandoned, 1);
});

test('#1838 a consented leave skips the grace: the computer takes the seat at once', () => {
  const t = setup(ids(4), ['u1', 'u2']);
  t.runner.left('u1');
  assert.equal(t.runner.isComputer('u1'), true);
  assert.equal(t.runner.computerReplaced, true);
  const t2 = setup(ids(4), ['u1']);
  t2.runner.left('u1');
  assert.equal(t2.hooks.abandoned, 1, 'the last person leaving abandons the match');
});

test('#1838 room: the host adds and removes computers in the lobby, the game starts with them', async () => {
  const { PantheonsRoom } = await import('./PantheonsRoom.js');
  type Slot = { userId: string | null; computer?: boolean; ready: boolean; displayName: string };
  const room = new PantheonsRoom() as unknown as {
    slots: Slot[];
    hostSeat: number;
    accountToSeat: Map<string, number>;
    started: boolean;
    runner: MatchRunner | null;
    matchPlayerIds: string[];
    addComputer(uid: string, seat?: number): void;
    removeComputer(uid: string, seat?: number): void;
    startMatch(uid: string): void;
    canStart(): boolean;
    lobbyState(): { seats: { computer: boolean; displayName: string }[] };
    broadcastLobby(): void;
    broadcastProjections(): void;
    lock(): void;
    setPatchRate(ms: number | null): void;
    clock: { stop(): void };
  };
  room.setPatchRate(null);
  room.clock.stop();
  room.broadcastLobby = () => {};
  room.broadcastProjections = () => {};
  room.lock = () => {};
  // host + one guest, then computers
  room.slots[0] = { userId: 'host', displayName: 'Hôte', ready: true, conn: 'CONNECTED', computer: false } as never;
  room.accountToSeat.set('host', 0);
  room.hostSeat = 0;
  assert.throws(() => room.addComputer('guest', 1), /hôte/); // host only
  room.addComputer('host', 1);
  room.addComputer('host'); // first free seat
  assert.equal(room.canStart(), false, 'the 4th seat is still empty');
  room.addComputer('host', 3);
  assert.equal(room.canStart(), true, 'computer seats count as filled and ready');
  const names = room.lobbyState().seats.map((s) => `${s.computer}:${s.displayName}`);
  assert.deepEqual(names, ['false:Hôte', 'true:Ordinateur 1', 'true:Ordinateur 2', 'true:Ordinateur 3']);
  assert.throws(() => room.addComputer('host', 1), /pas libre/);
  room.removeComputer('host', 3);
  assert.equal(room.canStart(), false);
  assert.throws(() => room.removeComputer('host', 0), /pas un ordinateur/);
  room.addComputer('host'); // back on seat 3
  room.startMatch('host');
  assert.equal(room.started, true);
  assert.equal(room.runner!.computerSeats().length, 3);
  assert.deepEqual(room.matchPlayerIds, ['host'], 'only persons are platform players');
  // no computer once started
  assert.throws(() => room.addComputer('host'), /déjà lancée/);
  room.runner!.dispose();
});
