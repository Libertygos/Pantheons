/**
 * 4-player capture — the real product shape: arc of 3 opponents, pense-bête 3 rows.
 */
import { chromium } from 'playwright';
import { Client } from 'colyseus.js';
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = 'http://localhost:2567';
const WS = 'ws://localhost:2567';
const OUT = '/home/user/Pantheons/polish/screenshots/before';
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
const log = (...a) => console.log('[4p]', ...a);

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
await context.addInitScript(() => {
  const inject = () => {
    const s = document.createElement('style');
    s.textContent = 'body { background-attachment: scroll !important; }';
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

const bots = [makeBot('Ophélie', 'u-b1'), makeBot('Maxime', 'u-b2'), makeBot('Chloé', 'u-b3')];
for (const b of bots) { await b.connect(roomCode); await sleep(250); b.ready(); }
await sleep(600);
await snap(page, '26-salon-complet-4j');

await page.locator('button:has-text("Je suis prêt")').click();
await page.waitForSelector('button:has-text("Démarrer la partie"):not([disabled])');
await page.locator('button:has-text("Démarrer la partie")').click();
await waitPhase(page, 'Pioche');
await sleep(1600);
await snap(page, '27-jeu-4j-pioche');

await page.locator('button:has-text("Valider la pioche")').click();
for (const b of bots) { await b.waitState((s) => s.phase === 'pioche'); b.submitPioche(); }
await waitPhase(page, 'Question');
await sleep(500);
await snap(page, '28-jeu-4j-question');

// Host asks one question at first opponent; bots each ask one too.
await page.locator('.main-ev__carte').last().click();
await sleep(300);
await page.locator('.pose-ev__deposer').first().click();
await sleep(300);
await page.locator('button:has-text("Valider 1 question")').click();
for (const b of bots) { await b.waitState((s) => s.phase === 'question'); b.askOne(); }
await waitPhase(page, 'Réponse');
await sleep(800);
await snap(page, '29-jeu-4j-reponse');

// Drawer is auto-open in réponse; capture the 3-row pense-bête grid as-is.
await snap(page, '30-jeu-4j-pense-bete');

log('DONE');
await browser.close();
process.exit(0);
