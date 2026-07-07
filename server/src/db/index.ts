/**
 * DB client + lazy user upsert (T-12). The row is created on first entry (Decision 4).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
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

/** Readiness-probe dependency check: throws when Postgres is unreachable. */
export async function pingDb(): Promise<void> {
  getDb();
  await pool!.query('SELECT 1');
}

/**
 * Apply the drizzle migrations at boot (idempotent — every statement is IF NOT EXISTS).
 * The folder ships with the package: server/drizzle next to dist/, both locally and in
 * the production image, hence the ../../ from this compiled module (dist/db/).
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../drizzle',
  );
  await migrate(getDb(), { migrationsFolder });
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
