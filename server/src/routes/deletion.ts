/**
 * Deletion endpoint (T-13, [OPUS]) — Decision 4.
 *
 * DELETE /internal/users/:id
 *   - cluster-internal only (never exposed publicly; gateway must not route it externally)
 *   - Authorization: Bearer <INTERNAL_SERVICE_TOKEN>, CONSTANT-TIME compared
 *   - IDEMPOTENT: unknown / already-deleted → 200 "deleted", NEVER 404
 *   - cascade = single `DELETE ... WHERE user_id = $1` (deleteUser)
 */
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, Router } from 'express';
import express from 'express';
import { deleteUser } from '../db/index.js';

/** Constant-time bearer check; false on any shape mismatch (fail closed). */
export function checkInternalBearer(authHeader: string | undefined, expectedToken: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const presented = authHeader.slice('Bearer '.length);
  const a = Buffer.from(presented);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) return false; // length leak is unavoidable; compare CT otherwise
  return timingSafeEqual(a, b);
}

export function createDeletionRouter(internalToken: string): Router {
  const router = express.Router();

  router.delete('/internal/users/:id', async (req: Request, res: Response) => {
    if (!checkInternalBearer(req.headers.authorization, internalToken)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ error: 'missing id' });

    try {
      await deleteUser(userId); // idempotent at the SQL layer
      // Unknown / already-deleted returns 200 "deleted" too — never 404.
      return res.status(200).json({ status: 'deleted' });
    } catch (err) {
      // A real failure (DB down) is a 500 — but "not found" is NOT an error here.
      return res.status(500).json({ error: 'deletion_failed' });
    }
  });

  return router;
}
