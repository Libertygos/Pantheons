/**
 * Pantheons server bootstrap: Express (handoff exchange + deletion) + Colyseus (rooms).
 * Server-authoritative; mirrors the WoG server shape (Decision 2).
 */
import http from 'node:http';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PantheonsRoom } from './rooms/PantheonsRoom.js';
import { verifyHandoffToken } from './auth/handoff.js';
import { issueSession } from './auth/session.js';
import { ensureUser } from './db/index.js';
import { createDeletionRouter } from './routes/deletion.js';

const PORT = Number(process.env.PORT ?? 2567);
const HANDOFF_SECRET = process.env.HANDOFF_JWT_SECRET ?? '';
const SESSION_SECRET = process.env.SESSION_JWT_SECRET ?? '';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? '';

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => res.json({ ok: true }));

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
    return res.json({ sessionToken: session, userId: claims.sub });
  } catch (err) {
    return res.status(401).json({ error: 'handoff_rejected' });
  }
});

// Deletion endpoint (cluster-internal; gateway must not expose externally).
app.use(createDeletionRouter(INTERNAL_TOKEN));

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define('pantheons', PantheonsRoom);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[pantheons] listening on :${PORT}`);
});
