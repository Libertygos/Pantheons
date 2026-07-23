/**
 * SESSION 1 journey traversal — Pantheons deep polish "before" screenshots.
 * Browser host (Playwright chromium) + headless bot (colyseus.js) in one process.
 * Screenshots at 1280x800 and 390x844 into polish/screenshots/before/.
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

const GOD_LABEL = {
  brahma: 'Brahma', ganesh: 'Ganesh', sarasvati: 'Sarasvati',
  zeus: 'Zeus', athena: 'Athena', artemis: 'Artemis',
  re: 'Rê', bastet: 'Bastet', isis: 'Isis',
  loki: 'Loki', odin: 'Odin', frigg: 'Frigg',
};

// ---------- helpers ----------
const b64u = (buf) => Buffer.from(buf).toString('base64url');
function mintToken(sub, username) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64u(JSON.stringify({
    iss: 'gosgames', aud: 'pantheons', access: true, sub, username,
    iat: now, exp: now + 300,
  }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[journey]', ...a);

async function snap(page, name) {
  // 1280 first (interaction viewport), then 390, then restore.
  for (const [w, h, label] of [[1280, 800, '1280'], [390, 844, '390']]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(450);
    await page.screenshot({ path: `${OUT}/${name}--${label}.png`, fullPage: true }).catch(async (e) => {
      log(`fullPage failed for ${name}--${label} (${e.message}), viewport-only`);
      await page.screenshot({ path: `${OUT}/${name}--${label}.png` });
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(250);
  log('snap', name);
}

// ---------- bot ----------
function makeBot(name, sub) {
  const bot = {
    name, sub, room: null, state: null, lobby: null, god: null,
    events: [], stateWaiters: [],
  };
  bot.connect = async (roomCode) => {
    const ex = await fetch(`${BASE}/auth/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: mintToken(sub, name) }),
    }).then((r) => r.json());
    const probe = await fetch(`${BASE}/api/rooms/${roomCode}/exists`).then((r) => r.json());
    if (!probe.exists) throw new Error('room not found: ' + roomCode);
    const client = new Client(WS);
    bot.room = await client.joinById(probe.roomId, { sessionToken: ex.sessionToken, roomCode });
    for (const m of ['error', 'JOIN_OK', 'LOBBY_STATE', 'event', 'gameOver', 'reveal', 'RECONNECT_OK', 'CONN_STATUS', 'MATCH_ABORTED', 'ROOM_CREATED', 'SESSION_ENDED']) {
      bot.room.onMessage(m, (msg) => { bot.events.push([m, msg]); if (m === 'LOBBY_STATE') bot.lobby = msg; });
    }
    bot.room.onMessage('state', (proj) => {
      bot.state = proj;
      if (proj?.self?.god) bot.god = proj.self.god;
      bot.stateWaiters = bot.stateWaiters.filter((w) => !w(proj));
    });
    log(`bot ${name} joined ${roomCode}`);
  };
  bot.waitState = (pred, timeout = 20000) => new Promise((resolve, reject) => {
    if (bot.state && pred(bot.state)) return resolve(bot.state);
    const t = setTimeout(() => reject(new Error(`bot ${name} waitState timeout`)), timeout);
    bot.stateWaiters.push((proj) => {
      if (pred(proj)) { clearTimeout(t); resolve(proj); return true; }
      return false;
    });
  });
  bot.ready = () => bot.room.send('SET_READY', { ready: true });
  bot.submitPioche = () => {
    const powers = bot.state?.self?.powerCards ?? [];
    bot.room.send('pioche', powers.length > 1 ? { discardPowerId: powers[0].id } : {});
  };
  bot.passQuestions = () => bot.room.send('question', { intent: { plays: [] }, specialePlays: [] });
  bot.passDeclaration = () => bot.room.send('declaration', {});
  return bot;
}

// ---------- host-side waits ----------
async function waitPhase(page, phaseLabel, timeout = 25000) {
  await page.waitForSelector(`.traqueur__etape--active:has-text("${phaseLabel}")`, { timeout });
}

// ---------- main ----------
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
// Capture-only fix: body uses background-attachment: fixed, which Playwright fullPage
// screenshots do not paint past the first screenful (white below). Switch to scroll for
// captures — rendering is otherwise identical. (Logged as a mobile-compat finding.)
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
page.on('console', (m) => { if (m.type() === 'error') log('page console error:', m.text()); });
page.on('pageerror', (e) => log('PAGE ERROR:', e.message));

// === A. Landing ===
await page.goto(`${BASE}/#token=${mintToken('user-jules', 'Jules')}`);
await page.waitForSelector('button:has-text("Créer un salon")');
await sleep(800); // let the hero fan settle
await snap(page, '01-accueil');

// Bad code error
await page.locator('.code-input input, input').first().click();
await page.keyboard.type('XXXXX');
await snap(page, '02-accueil-code-rempli');
await page.locator('button:has-text("Rejoindre")').click();
await page.waitForSelector('[role="alert"]', { timeout : 10000 });
await snap(page, '03-accueil-erreur-code');

// Room-not-found deep link
await page.goto(`${BASE}/room/QQQQQ`);
await sleep(1200);
await snap(page, '04-salon-introuvable');

// === B. Lobby ===
await page.goto(`${BASE}/`);
await page.waitForSelector('button:has-text("Créer un salon")');
await page.locator('button:has-text("Créer un salon")').click();
await page.waitForURL(/\/room\//);
await page.waitForSelector('button:has-text("Je suis prêt")');
const roomCode = page.url().split('/room/')[1];
log('room code:', roomCode);
await snap(page, '05-salon-hote-seul');

// Admin host: shrink to 2 seats
await page.locator('button:has-text("Retirer un siège")').click();
await sleep(200);
await page.locator('button:has-text("Retirer un siège")').click();
await sleep(300);
await snap(page, '06-salon-2-sieges');

// Bot joins + ready
const bot = makeBot('Ophélie', 'user-bot-1');
await bot.connect(roomCode);
await sleep(400);
bot.ready();
await sleep(400);
await snap(page, '07-salon-bot-pret');

// Host ready → start enabled
await page.locator('button:has-text("Je suis prêt")').click();
await page.waitForSelector('button:has-text("Démarrer la partie"):not([disabled])');
await snap(page, '08-salon-tous-prets');

// === C. Match — turn 1 ===
await page.locator('button:has-text("Démarrer la partie")').click();
await waitPhase(page, 'Pioche');
await sleep(1600); // doorway animation
await snap(page, '09-jeu-pioche');

// Host validates pioche first (observe own confirmation), bot holds
await page.locator('button:has-text("Valider la pioche")').click();
await page.waitForSelector('.fait-chip', { timeout: 10000 });
await snap(page, '10-jeu-pioche-validee-attente');

bot.submitPioche();
await waitPhase(page, 'Question');
await bot.waitState((s) => s.phase === 'question');
await sleep(500);
await snap(page, '11-jeu-question');

// Select a hand card → legal targets. NOTE (bug log): fan overlap means a card's center
// is covered by its right neighbor — the LAST card is the only one Playwright can click
// at center. Recorded as finding for the interrogation.
await page.locator('.main-ev__carte').last().click();
await sleep(400);
await snap(page, '12-jeu-question-carte-choisie');

// Place on the bot's seat
await page.locator('.pose-ev__deposer').first().click();
await sleep(400);
await snap(page, '13-jeu-question-posee');

// Contextual help (seats zone)
await page.locator('.btn-aide--arc').click();
await sleep(400);
await snap(page, '14-aide-sieges');
await page.keyboard.press('Escape');
await sleep(300);
// If still open, click close button
if (await page.locator('.voile').count()) {
  await page.locator('.voile button:has-text("Fermer")').first().click().catch(() => {});
  await sleep(300);
}

// Pense-bête drawer + tri-state marks
await page.locator('button[aria-label="Ouvrir le pense-bête"]').click();
await sleep(500);
const cells = page.locator('.tiroir button[aria-pressed]');
if (await cells.count() > 3) {
  await cells.nth(0).click(); // exclu
  await cells.nth(1).click(); await cells.nth(1).click(); // retenu
  await sleep(300);
}
await snap(page, '15-pense-bete');
await page.keyboard.press('Escape');
await sleep(400);

// Hold-to-reveal god (per viewport, held during shot)
for (const [w, h, label] of [[1280, 800, '1280'], [390, 844, '390']]) {
  await page.setViewportSize({ width: w, height: h });
  await sleep(400);
  const dieu = page.locator('.dock-dieu');
  await dieu.scrollIntoViewIfNeeded();
  const box = await dieu.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(700);
  await page.screenshot({ path: `${OUT}/16-dieu-revele--${label}.png` });
  await page.mouse.up();
}
await page.setViewportSize({ width: 1280, height: 800 });
log('snap 16-dieu-revele');

// Validate questions → waiting chip
await page.locator('button:has-text("Valider 1 question")').click();
await page.waitForSelector('.fait-chip', { timeout: 10000 });
await snap(page, '17-jeu-question-validee-attente');

bot.passQuestions();
await waitPhase(page, 'Réponse');
await bot.waitState((s) => s.phase === 'reponse');
await sleep(600);
await snap(page, '18-jeu-reponse');

// Declaration modal (then cancel). BUG (logged): the pense-bête drawer auto-opens in
// réponse and stacks ABOVE .voile modals (tiroir z57 vs voile z-auto) — capture the
// authentic overlap, then Escape to close the drawer so the modal is usable.
await page.locator('button:has-text("Déclarer « Panthéons »")').click();
await sleep(500);
await snap(page, '19-declaration-modale');
await page.mouse.move(10, 300); // clear any hover loupe (it captures the first Escape)
await sleep(200);
await page.keyboard.press('Escape');
await sleep(300);
await page.locator('button:has-text("Annuler")').click();
await sleep(300);

// Pass declaration on both sides → turn 2
await page.locator('button:has-text("Passer")').first().click();
await sleep(300);
bot.passDeclaration();
await waitPhase(page, 'Pioche');
await bot.waitState((s) => s.phase === 'pioche' && s.tour === 2);
await sleep(500);
await snap(page, '20-jeu-tour2-pioche');

// === D. Turn 2 → win by declaration ===
await page.locator('button:has-text("Valider la pioche")').click();
bot.submitPioche();
await waitPhase(page, 'Question');
await bot.waitState((s) => s.phase === 'question');
await sleep(300);
// host passes questions
await page.locator('button:has-text("Passer sans question")').click();
bot.passQuestions();
await waitPhase(page, 'Réponse');
await bot.waitState((s) => s.phase === 'reponse');
await sleep(400);

log('bot god is', bot.god);
await page.locator('button:has-text("Déclarer « Panthéons »")').click();
await sleep(400);
await page.mouse.move(10, 300);
await sleep(200);
await page.keyboard.press('Escape'); // close auto-opened drawer covering the modal
await sleep(300);
await page.locator(`.decl-dieu[title="${GOD_LABEL[bot.god]}"]`).click();
await sleep(300);
await snap(page, '21-declaration-choisie');
await page.locator('button:has-text("Je déclare « Panthéons »")').click();
bot.passDeclaration();
await page.waitForSelector('.voile:has-text("Panthéons"), .fin, [class*="fin"]', { timeout: 20000 }).catch(() => {});
await sleep(1500);
await snap(page, '22-fin-victoire');

// Back home (Escape first: drawer may cover the end-screen button)
await page.mouse.move(10, 300);
await sleep(200);
await page.keyboard.press('Escape');
await sleep(300);
await page.locator('button:has-text("Retour à l’accueil"), button:has-text("Retour à l\'accueil")').first().click().catch(async () => {
  log('retour button not found, navigating home');
  await page.goto(`${BASE}/`);
});
await sleep(800);

try { bot.room?.leave(true); } catch {}

// === E. Game 2 — wrong declaration → elimination, + disconnect banner ===
await page.waitForSelector('button:has-text("Créer un salon")', { timeout: 10000 });
await page.locator('button:has-text("Créer un salon")').click();
await page.waitForURL(/\/room\//);
await page.waitForSelector('button:has-text("Je suis prêt")');
const code2 = page.url().split('/room/')[1];
log('room 2 code:', code2);
await page.locator('button:has-text("Retirer un siège")').click();
await sleep(200);
await page.locator('button:has-text("Retirer un siège")').click();
const bot2 = makeBot('Ophélie', 'user-bot-2');
await bot2.connect(code2);
await sleep(300);
bot2.ready();
await sleep(300);
await page.locator('button:has-text("Je suis prêt")').click();
await page.waitForSelector('button:has-text("Démarrer la partie"):not([disabled])');
await page.locator('button:has-text("Démarrer la partie")').click();
await waitPhase(page, 'Pioche');
await sleep(1500);

// Bot disconnects mid-phase → observe host's view of a stalled/disconnected seat
bot2.room.connection.close();
await sleep(2500);
await snap(page, '23-jeu-adversaire-deconnecte');

// Bot reconnects (fresh join impossible in-match; use reconnect token)
try {
  const client2 = new Client(WS);
  bot2.room = await client2.reconnect(bot2.room.reconnectionToken);
  bot2.room.onMessage('state', (proj) => { bot2.state = proj; if (proj?.self?.god) bot2.god = proj.self.god; bot2.stateWaiters = bot2.stateWaiters.filter((w) => !w(proj)); });
  for (const m of ['error', 'RECONNECT_OK', 'gameOver', 'event', 'CONN_STATUS']) bot2.room.onMessage(m, () => {});
  log('bot2 reconnected');
} catch (e) {
  log('bot2 reconnect failed:', e.message);
}
await sleep(1500);

// Play through to réponse, then declare WRONG → elimination
await page.locator('button:has-text("Valider la pioche")').click();
bot2.submitPioche();
await waitPhase(page, 'Question');
await bot2.waitState((s) => s.phase === 'question');
await page.locator('button:has-text("Passer sans question")').click();
bot2.passQuestions();
await waitPhase(page, 'Réponse');
await bot2.waitState((s) => s.phase === 'reponse');
await sleep(400);

const wrong = bot2.god === 'zeus' ? 'odin' : 'zeus';
log('bot2 god:', bot2.god, '— declaring wrong:', wrong);
await page.locator('button:has-text("Déclarer « Panthéons »")').click();
await sleep(300);
await page.mouse.move(10, 300);
await sleep(200);
await page.keyboard.press('Escape'); // close auto-opened drawer covering the modal
await sleep(300);
await page.locator(`.decl-dieu[title="${GOD_LABEL[wrong]}"]`).click();
await sleep(200);
await page.locator('button:has-text("Je déclare « Panthéons »")').click();
await sleep(500);
bot2.passDeclaration();
await sleep(2500);
await snap(page, '24-declaration-ratee');

// Whatever the post-elimination state is (game over for 2p, or continues)
await sleep(2000);
await snap(page, '25-apres-elimination');

log('DONE');
await browser.close();
process.exit(0);
