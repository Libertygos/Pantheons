/**
 * Durable per-user store (T-12) — Postgres via Drizzle. Decision 4: all player data is keyed
 * by the platform `user_id`; the local row is created LAZILY on first entry. Game state lives
 * in-memory in the Colyseus room, so this store is deliberately small — which makes the
 * deletion cascade a single `DELETE ... WHERE user_id = $1`.
 */
import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';

/** One row per platform user. PK is the platform user_id (never a local surrogate). */
export const users = pgTable('users', {
  userId: text('user_id').primaryKey(), // platform user_id — the durable key
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Small aggregate stats, also user_id-keyed so the cascade stays one predicate. */
export const userStats = pgTable('user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.userId, { onDelete: 'cascade' }),
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
