/**
 * Pantheons server bootstrap: Express (handoff exchange + deletion) + Colyseus (rooms).
 * Server-authoritative; mirrors the WoG server shape (Decision 2).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PantheonsRoom } from './rooms/PantheonsRoom.js';
import { lookupRoom } from './rooms/room-registry.js';
import { normalizeRoomCode } from './rooms/room-code.js';
import { verifyHandoffToken } from './auth/handoff.js';
import { issueSession } from './auth/session.js';
import { ensureUser, pingDb, runMigrations } from './db/index.js';
import { createDeletionRouter } from './routes/deletion.js';
import { metricsText } from './http/metrics.js';

const PORT = Number(process.env.PORT ?? 2567);
const HANDOFF_SECRET = process.env.HANDOFF_JWT_SECRET ?? '';
const SESSION_SECRET = process.env.SESSION_JWT_SECRET ?? '';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? '';

const app = express();
app.use(express.json());

// Liveness probe: process is up and responding. Never fails on external state.
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Readiness probe: DB reachable → 200; unreachable → 503 (mirrors WoG O-PROBES).
// Without DATABASE_URL (local dev) the check is skipped.
app.get('/healthz/ready', async (_req, res) => {
  if (process.env.DATABASE_URL) {
    try {
      await pingDb();
    } catch {
      return res.status(503).json({ status: 'not_ready', reason: 'db_unreachable' });
    }
  }
  return res.status(200).json({ status: 'ok' });
});

// Prometheus metrics (mirrors WoG O-METRICS). Counts only — no hidden state.
app.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsText());
});

/**
 * Handoff exchange: client POSTs the handoff token (read from the URL fragment client-side,
 * then cleared). We verify it (aud==="pantheons"), lazily create the user row, and return the
 * game's OWN session S-JWT. The handoff token is never reused as a session token.
 */
app.post('/auth/exchange', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) return res.status(400).json({ error: 'missing token' });
  try {
    const claims = verifyHandoffToken(token, HANDOFF_SECRET);
    await ensureUser(claims.sub, claims.displayName); // lazy row on first entry
    const session = issueSession(claims.sub, SESSION_SECRET, claims.displayName);
    return res.json({
      sessionToken: session,
      userId: claims.sub,
      displayName: claims.displayName ?? claims.sub,
    });
  } catch (err) {
    return res.status(401).json({ error: 'handoff_rejected' });
  }
});

/**
 * Room-existence probe (wog-room.md §3.1): lets a reloaded client decide between
 * reconnect / fresh join / "room not found" without opening a socket to a dead room.
 */
app.get('/api/rooms/:code/exists', (req, res) => {
  const found = lookupRoom(normalizeRoomCode(req.params.code));
  if (!found) return res.json({ exists: false });
  return res.json({ exists: true, phase: found.phase, roomId: found.roomId });
});

// Deletion endpoint (cluster-internal; gateway must not expose externally).
app.use(createDeletionRouter(INTERNAL_TOKEN));

// Same-origin SPA (wog-room.md §0): the game server serves the built client so the
// WebSocket and all /api/* calls share the page host. `/room/:code` deep links fall back
// to index.html (client-side routing).
const clientDist =
  process.env.CLIENT_DIST ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(['/', '/room/:code'], (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define('pantheons', PantheonsRoom);

// Boot-time schema migrations (idempotent). Fail hard: with a DB configured, serving
// traffic against a missing schema would only surface later on the first /auth/exchange.
if (process.env.DATABASE_URL) {
  try {
    await runMigrations();
    // eslint-disable-next-line no-console
    console.log('[pantheons] db migrations applied');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[pantheons] db migration failed', err);
    process.exit(1);
  }
}

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[pantheons] listening on :${PORT}`);
});
