/**
 * DB client + lazy user upsert (T-12). The row is created on first entry (Decision 4).
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  pool = new pg.Pool({ connectionString });
  db = drizzle(pool, { schema });
  return db;
}

/** Lazily create/refresh the user row on first entry. Idempotent. */
export async function ensureUser(userId: string, displayName?: string): Promise<void> {
  const database = getDb();
  await database
    .insert(schema.users)
    .values({ userId, displayName: displayName ?? null, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: schema.users.userId,
      set: { lastSeenAt: new Date(), ...(displayName ? { displayName } : {}) },
    });
}

/** Deletion cascade (Decision 4): one predicate, user_stats cascades via FK. Idempotent. */
export async function deleteUser(userId: string): Promise<void> {
  const database = getDb();
  await database.execute(sql`DELETE FROM ${schema.users} WHERE ${schema.users.userId} = ${userId}`);
}

export { schema };
