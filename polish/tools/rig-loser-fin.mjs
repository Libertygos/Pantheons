/**
 * S6 — rig the LOSER-perspective end screen (the one fin state no ordinary bot run can
 * reach: a bot only wins by knowing the browser player's god). Path predicted in S4:
 * the Déduction power (« regardez une carte personnage qui n'a pas été piochée », once
 * per tour, deterministic index (tour-1) % undealt.length — rules.ts) lets a 2-player
 * bot see all 10 undealt personnage cards over 10 all-pass tours; the 12th god — not
 * seen, not its own — is the host's. It then declares correctly and WINS, and the
 * browser host photographs the losing fin: winner's VERSO + « Le dieu d'Ophélie restera
 * secret. » (projection rule).
 *
 * The bot's tour-1 power draw is random (1/12) — the script retries fresh rooms until
 * Déduction lands. Deck exhaustion mid-rig is safe: drawFrom() skips empty piles.
 * Output: 42-fin-defaite--{1280,390}.png into $OUT (default polish/screenshots/before).
 */
import { chromium } from 'playwright';
import { Client } from 'colyseus.js';
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = 'http://localhost:2567';
const WS = 'ws://localhost:2567';
const OUT = process.env.OUT ?? '/home/user/Pantheons/polish/screenshots/before';
const SECRET = 'devsecret';
fs.mkdirSync(OUT, { recursive: true });

const ALL_GOD_IDS = [
  'brahma', 'ganesh', 'sarasvati',
  'zeus', 'athena', 'artemis',
  're', 'bastet', 'isis',
  'loki', 'odin', 'frigg',
];

const b64u = (buf) => Buffer.from(buf).toString('base64url');
function mintToken(sub, username) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64u(JSON.stringify({ iss: 'gosgames', aud: 'pantheons', access: true, sub, username, iat: now, exp: now + 900 }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[rig]', ...a);

function makeBot(name, sub) {
  const bot = { name, sub, room: null, state: null, god: null, reveals: [], stateWaiters: [] };
  bot.connect = async (roomCode) => {
    const ex = await fetch(`${BASE}/auth/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: mintToken(sub, name) }),
    }).then((r) => r.json());
    const probe = await fetch(`${BASE}/api/rooms/${roomCode}/exists`).then((r) => r.json());
    const client = new Client(WS);
    bot.room = await client.joinById(probe.roomId, { sessionToken: ex.sessionToken, roomCode });
    for (const m of ['error', 'JOIN_OK', 'LOBBY_STATE', 'event', 'gameOver', 'RECONNECT_OK', 'CONN_STATUS', 'MATCH_ABORTED', 'SESSION_ENDED']) {
      bot.room.onMessage(m, () => {});
    }
    bot.room.onMessage('reveal', (r) => {
      bot.reveals.push(r);
      log('reveal:', JSON.stringify(r));
    });
    bot.room.onMessage('state', (proj) => {
      bot.state = proj;
      if (proj?.self?.god) bot.god = proj.self.god;
      bot.stateWaiters = bot.stateWaiters.filter((w) => !w(proj));
    });
  };
  bot.waitState = (pred, timeout = 25000) => new Promise((resolve, reject) => {
    if (bot.state && pred(bot.state)) return resolve(bot.state);
    const t = setTimeout(() => reject(new Error(`bot waitState timeout`)), timeout);
    bot.stateWaiters.push((proj) => { if (pred(proj)) { clearTimeout(t); resolve(proj); return true; } return false; });
  });
  bot.ready = () => bot.room.send('SET_READY', { ready: true });
  bot.submitPioche = () => {
    const powers = bot.state?.self?.powerCards ?? [];
    // Never discard Déduction — it IS the rig.
    const discard = powers.find((p) => p.effectKey !== 'deduction') ?? powers[0];
    bot.room.send('pioche', powers.length > 1 ? { discardPowerId: discard.id } : {});
  };
  bot.passQuestions = () => bot.room.send('question', { intent: { plays: [] }, specialePlays: [] });
  bot.passDeclaration = () => bot.room.send('declaration', {});
  return bot;
}

async function waitPhase(page, phaseLabel, timeout = 25000) {
  await page.waitForSelector(`.traqueur__etape--active:has-text("${phaseLabel}")`, { timeout });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  const inject = () => {
    const s = document.createElement('style');
    s.textContent = 'body::before { position: absolute !important; }';
    document.head.appendChild(s);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', inject);
  else inject();
});
const page = await context.newPage();
page.on('pageerror', (e) => log('PAGE ERROR:', e.message));

const MAX_TRIES = 60;
let done = false;
for (let attempt = 1; attempt <= MAX_TRIES && !done; attempt++) {
  await page.goto(`${BASE}/#token=${mintToken('user-jules', 'Jules')}`);
  await page.waitForSelector('button:has-text("Créer un salon")');
  await page.locator('button:has-text("Créer un salon")').click();
  await page.waitForURL(/\/room\//);
  await page.waitForSelector('button:has-text("Je suis prêt")');
  const roomCode = page.url().split('/room/')[1];
  await page.locator('button:has-text("Retirer un siège")').click();
  await sleep(150);
  await page.locator('button:has-text("Retirer un siège")').click();
  const bot = makeBot('Ophélie', `u-rig-${attempt}`);
  await bot.connect(roomCode);
  await sleep(250);
  bot.ready();
  await sleep(250);
  await page.locator('button:has-text("Je suis prêt")').click();
  await page.waitForSelector('button:has-text("Démarrer la partie"):not([disabled])');
  await page.locator('button:has-text("Démarrer la partie")').click();
  await waitPhase(page, 'Pioche');
  await sleep(400);

  // Tour 1 pioche resolves the power draw — check what the bot got.
  await page.locator('button:has-text("Valider la pioche")').click();
  await bot.waitState((s) => s.phase === 'pioche');
  bot.submitPioche();
  await bot.waitState((s) => s.phase === 'question');
  const power = bot.state.self.powerCards[0]?.effectKey;
  log(`attempt ${attempt} (room ${roomCode}): bot power = ${power}`);
  if (power !== 'deduction') {
    try { bot.room.leave(true); } catch {}
    continue; // fresh room, fresh deal
  }

  // Déduction landed. The gate `noOuiLastTurn` is FALSE at tour 1 (effects.ts) — the
  // first legal activation is tour 2. Tours 2..11 give reveal indexes (tour-1)%10 =
  // 1..9 then 0: all 10 undealt gods over 11 all-pass tours.
  const LAST_TOUR = 11;
  const hostId = bot.state.opponents[0].userId;
  const seen = new Set();
  for (let tour = 1; tour <= LAST_TOUR; tour++) {
    if (tour > 1) {
      await waitPhase(page, 'Pioche');
      await page.locator('button:has-text("Valider la pioche")').click();
      await bot.waitState((s) => s.phase === 'pioche' && s.tour === tour);
      bot.submitPioche();
      await bot.waitState((s) => s.phase === 'question' && s.tour === tour);
      bot.room.send('power', { effectKey: 'deduction' });
    }
    await sleep(250);
    await waitPhase(page, 'Question');
    // The private reveal is unicast to the bot only. The host simply passes.
    await page.locator('button:has-text("Passer sans question")').click();
    bot.passQuestions();
    await waitPhase(page, 'Réponse');
    await bot.waitState((s) => s.phase === 'reponse' && s.tour === tour);
    for (const r of bot.reveals) if (r.kind === 'personnage' && r.god) seen.add(r.god);
    log(`tour ${tour}: seen ${seen.size}/10 undealt gods`);
    if (tour < LAST_TOUR) {
      await page.locator('button:has-text("Passer")').first().click();
      bot.passDeclaration();
      continue;
    }
    // Last tour: wait out the 10th reveal (each tour's unicast lands a beat after the
    // réponse state message — observed in run 1), then the host's god is the one left.
    await page.locator('button:has-text("Passer")').first().click();
    for (let i = 0; i < 40 && seen.size < 10; i++) {
      await sleep(250);
      for (const r of bot.reveals) if (r.kind === 'personnage' && r.god) seen.add(r.god);
    }
    const candidates = ALL_GOD_IDS.filter((g) => g !== bot.god && !seen.has(g));
    if (candidates.length !== 1) {
      throw new Error(`deduction incomplete: candidates = ${candidates.join(',')}`);
    }
    log(`bot deduces host god = ${candidates[0]} → declaring to WIN`);
    bot.room.send('declaration', { guesses: { [hostId]: candidates[0] } });
  }

  // The browser host LOST — photograph the staged fin (verso + « restera secret »).
  await page.waitForSelector('.fin', { timeout: 20000 });
  await sleep(2800); // staged sequence settles
  for (const [w, h, label] of [[1280, 800, '1280'], [390, 844, '390']]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(450);
    await page.screenshot({ path: `${OUT}/42-fin-defaite--${label}.png`, fullPage: true });
  }
  const note = await page.locator('.fin__note').textContent();
  log('fin note:', note);
  if (!/restera secret/.test(note ?? '')) throw new Error('loser fin: secret note missing');
  if (await page.locator('.fin__dieu--secret').count() === 0) throw new Error('loser fin: verso block missing');
  log('DONE — loser fin captured');
  done = true;
}

if (!done) throw new Error(`Déduction never dealt to the bot in ${MAX_TRIES} rooms`);
await browser.close();
process.exit(0);
