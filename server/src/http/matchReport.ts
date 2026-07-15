/**
 * Match-result reporting to the gosgames platform (TICKET-102 contract):
 * POST {GOSGAMES_INTERNAL_URL}/api/internal/matches, auth via the shared
 * X-Internal-Token header (same INTERNAL_SERVICE_TOKEN as the inbound
 * deletion endpoint — one platform↔game service token).
 *
 * Best-effort by design: stats must never break the game flow, so a missing
 * configuration is a silent no-op (local dev) and a failed POST only logs.
 * The platform owns playerCount and isTestMatch — we send raw facts only.
 */

export interface MatchReport {
  playerAccountIds: string[];
  startedAt: Date;
  endedAt: Date;
}

const GAME_SLUG = 'pantheons';

export async function reportMatch(report: MatchReport): Promise<void> {
  const base = (process.env.GOSGAMES_INTERNAL_URL ?? '').replace(/\/$/, '');
  const token = process.env.INTERNAL_SERVICE_TOKEN ?? '';
  if (!base || !token) return;

  try {
    const res = await fetch(`${base}/api/internal/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: JSON.stringify({
        gameSlug: GAME_SLUG,
        playerAccountIds: report.playerAccountIds,
        startedAt: report.startedAt.toISOString(),
        endedAt: report.endedAt.toISOString(),
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[pantheons] match report rejected: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[pantheons] match report failed', err);
  }
}
