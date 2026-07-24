/**
 * 4-player capture — the real product shape: arc of 3 opponents, pense-bête 3 rows.
 * S6: BOTS=6 runs the same traversal at 7 players (6 opponents, pense-bête 6 rows) and
 * numbers its states 36..41 with a « 7j » suffix (26..31 stay the 4p namespace).
 */
import { chromium } from 'playwright';
import { Client } from 'colyseus.js';
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = 'http://localhost:2567';
const WS = 'ws://localhost:2567';
// S2+: override the output dir per session (OUT=…/polish/screenshots/s2 node journey4p.mjs)
const OUT = process.env.OUT ?? '/home/user/Pantheons/polish/screenshots/before';
const SECRET = 'devsecret';
fs.mkdirSync(OUT, { recursive: true });

const b64u = (buf) => Buffer.from(buf).toString('base64url');
function mintToken(sub, username) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64u(JSON.stringify({ iss: 'gosgames', aud: 'pantheons', access: true, sub, username, iat: now, exp: now + 300 }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// S6: bot count override (3 = 4 players → states 26..31 « 4j » ; 6 = 7 players → 36..41 « 7j »)
const NBOTS = Number(process.env.BOTS ?? 3);
const SUFFIX = `${NBOTS + 1}j`;
const BASE_NUM = NBOTS === 3 ? 26 : 36;
const N = (i, name) => `${BASE_NUM + i}-${name}`;
const log = (...a) => console.log(`[${NBOTS + 1}p]`, ...a);

async function snap(page, name) {
  for (const [w, h, label] of [[1280, 800, '1280'], [390, 844, '390']]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(450);
    await page.screenshot({ path: `${OUT}/${name}--${label}.png`, fullPage: true }).catch(async () => {
      await page.screenshot({ path: `${OUT}/${name}--${label}.png` });
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(250);
  log('snap', name);
}

function makeBot(name, sub) {
  const bot = { name, sub, room: null, state: null, god: null, stateWaiters: [] };
  bot.connect = async (roomCode) => {
    const ex = await fetch(`${BASE}/auth/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: mintToken(sub, name) }),
    }).then((r) => r.json());
    const probe = await fetch(`${BASE}/api/rooms/${roomCode}/exists`).then((r) => r.json());
    const client = new Client(WS);
    bot.room = await client.joinById(probe.roomId, { sessionToken: ex.sessionToken, roomCode });
    for (const m of ['error', 'JOIN_OK', 'LOBBY_STATE', 'event', 'gameOver', 'reveal', 'RECONNECT_OK', 'CONN_STATUS', 'MATCH_ABORTED', 'SESSION_ENDED']) bot.room.onMessage(m, () => {});
    bot.room.onMessage('state', (proj) => {
      bot.state = proj;
      if (proj?.self?.god) bot.god = proj.self.god;
      bot.stateWaiters = bot.stateWaiters.filter((w) => !w(proj));
    });
    log(`bot ${name} joined`);
  };
  bot.waitState = (pred, timeout = 25000) => new Promise((resolve, reject) => {
    if (bot.state && pred(bot.state)) return resolve(bot.state);
    const t = setTimeout(() => reject(new Error(`bot ${name} waitState timeout`)), timeout);
    bot.stateWaiters.push((proj) => { if (pred(proj)) { clearTimeout(t); resolve(proj); return true; } return false; });
  });
  bot.ready = () => bot.room.send('SET_READY', { ready: true });
  bot.submitPioche = () => {
    const powers = bot.state?.self?.powerCards ?? [];
    bot.room.send('pioche', powers.length > 1 ? { discardPowerId: powers[0].id } : {});
  };
  // Ask ONE attribute question at a random legal opponent (spices up the table).
  bot.askOne = () => {
    const s = bot.state;
    const attr = s?.self?.handCards?.attributs?.[0];
    const target = s?.opponents?.find((o) => o.alive);
    const targetSeat = target ? s.seatOrder.indexOf(target.userId) : -1;
    if (attr && target && targetSeat >= 0) {
      bot.room.send('question', { intent: { plays: [{ cardId: attr.id, card: attr, targetSeat }] }, specialePlays: [] });
    } else {
      bot.room.send('question', { intent: { plays: [] }, specialePlays: [] });
    }
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
// Fixed body::before background layer (S2, B10) → absolute for fullPage captures.
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

await page.goto(`${BASE}/#token=${mintToken('user-jules', 'Jules')}`);
await page.waitForSelector('button:has-text("Créer un salon")');
await page.locator('button:has-text("Créer un salon")').click();
await page.waitForURL(/\/room\//);
await page.waitForSelector('button:has-text("Je suis prêt")');
const roomCode = page.url().split('/room/')[1];
log('room:', roomCode);

const BOT_DEFS = [
  ['Ophélie', 'u-b1'], ['Maxime', 'u-b2'], ['Chloé', 'u-b3'],
  ['Nadia', 'u-b4'], ['Théo', 'u-b5'], ['Camille', 'u-b6'],
];
const bots = BOT_DEFS.slice(0, NBOTS).map(([n, s]) => makeBot(n, s));
// 7 players: the lobby opens at 4 seats — the host adds the 3 missing ones first.
for (let i = 0; i < NBOTS - 3; i++) {
  await page.locator('button:has-text("Ajouter un siège")').click();
  await sleep(200);
}
for (const b of bots) { await b.connect(roomCode); await sleep(250); b.ready(); }
await sleep(600);
await snap(page, N(0, `salon-complet-${SUFFIX}`));

await page.locator('button:has-text("Je suis prêt")').click();
await page.waitForSelector('button:has-text("Démarrer la partie"):not([disabled])');
await page.locator('button:has-text("Démarrer la partie")').click();
await waitPhase(page, 'Pioche');
await sleep(1600);
await snap(page, N(1, `jeu-${SUFFIX}-pioche`));

await page.locator('button:has-text("Valider la pioche")').click();
for (const b of bots) { await b.waitState((s) => s.phase === 'pioche'); b.submitPioche(); }
await waitPhase(page, 'Question');
await sleep(500);
await snap(page, N(2, `jeu-${SUFFIX}-question`));

// Host asks one question at first opponent; bots each ask one too.
await page.locator('.main-ev__carte').last().click();
await sleep(300);
await page.locator('.pose-ev__deposer').first().click();
await sleep(300);
await page.locator('button:has-text("Valider 1 question")').click();
for (const b of bots) { await b.waitState((s) => s.phase === 'question'); b.askOne(); }
await waitPhase(page, 'Réponse');
await sleep(800);
await snap(page, N(3, `jeu-${SUFFIX}-reponse`));

// S2: the drawer no longer auto-opens — open it by its handle (badge visible before).
await page.locator('button[aria-controls="tiroir-pense-bete"]').click();
await sleep(600);
// S6 (full-view rule re-check at any table size): no horizontal overflow, every mark
// cell present — NBOTS × 12 — at BOTH viewports.
for (const [w, h, label] of [[1280, 800, '1280'], [390, 844, '390']]) {
  await page.setViewportSize({ width: w, height: h });
  await sleep(400);
  const pb = await page.evaluate((nbots) => {
    const defile = document.querySelector('.pb-defile');
    const cells = document.querySelectorAll('.pb-case').length;
    return {
      overflow: defile ? defile.scrollWidth - defile.clientWidth : -1,
      cells,
      expected: nbots * 12,
    };
  }, NBOTS);
  if (pb.overflow > 0 || pb.cells !== pb.expected) {
    throw new Error(
      `full-view rule broken at ${label}: overflow=${pb.overflow}px cells=${pb.cells}/${pb.expected}`,
    );
  }
  log(`full-view OK at ${label} — overflow 0, ${pb.cells}/${pb.expected} cells`);
}
await page.setViewportSize({ width: 1280, height: 800 });
await sleep(300);
await snap(page, N(4, `jeu-${SUFFIX}-pense-bete`));
await page.keyboard.press('Escape');
await sleep(400);

// S4: the declaration ceremony at the real table shape — 3 rows × 12 named gods.
// Mark a few pense-bête cells first so the modal shows marks + a live « N possibles ».
await page.locator('button[aria-controls="tiroir-pense-bete"]').click();
await sleep(400);
const cells4 = page.locator('.tiroir button[aria-pressed]');
if (await cells4.count() > 14) {
  await cells4.nth(0).click(); // row 1: exclu
  await cells4.nth(13).click(); await cells4.nth(13).click(); // row 2: retenu
}
await page.keyboard.press('Escape');
await sleep(400);
await page.locator('button:has-text("Déclarer « Panthéons »")').click();
await sleep(500);
await snap(page, N(5, `declaration-${SUFFIX}`));
await page.locator('button:has-text("Annuler")').click();
await sleep(300);

log('DONE');
await browser.close();
process.exit(0);
