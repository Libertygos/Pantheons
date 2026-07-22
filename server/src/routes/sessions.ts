/**
 * Remote-end endpoint (login_all_games.md §B, GAME-LOGIN-03).
 *
 * POST /internal/sessions/end
 *   - cluster-internal only (never exposed publicly; the gateway must not route it externally)
 *   - Authorization: Bearer <INTERNAL_SERVICE_TOKEN>, CONSTANT-TIME compared (same helper
 *     as the deletion route)
 *   - body { userId, sessionRef } — sessionRef optional
 *   - tears down the identified live session(s) so the player sees the standard "playing
 *     elsewhere" exit, not a raw disconnect
 *   - IDEMPOTENT: an already-gone / unknown session still returns 200 (never 404)
 *   - bad / missing token → 401, NO teardown
 *
 * The router takes an `endSessions(userId, sessionRef?) -> number` sink (the in-process
 * session directory in prod) so it is unit-testable without a live Colyseus server.
 */
import type { Request, Response, Router } from 'express';
import express from 'express';
import { checkInternalBearer } from './deletion.js';

export function createSessionsRouter(
  internalToken: string,
  endSessions: (userId: string, sessionRef?: string) => number,
): Router {
  const router = express.Router();

  router.post('/internal/sessions/end', (req: Request, res: Response) => {
    if (!checkInternalBearer(req.headers.authorization, internalToken)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    if (!userId) return res.status(400).json({ error: 'missing userId' });
    const sessionRef = typeof req.body?.sessionRef === 'string' ? req.body.sessionRef : undefined;

    // Idempotent: unknown / already-gone session → still 200 with ended: 0.
    const ended = endSessions(userId, sessionRef);
    return res.status(200).json({ status: 'ended', ended });
  });

  return router;
}
