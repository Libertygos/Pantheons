// In-process Prometheus gauges (mirrors WoG O-METRICS). Counts only — no hidden game state.
let activeRooms = 0;
let connectedPlayers = 0;

export function recordRoomOpened(): void {
  activeRooms++;
}

export function recordRoomClosed(): void {
  if (activeRooms > 0) activeRooms--;
}

export function recordPlayerConnected(): void {
  connectedPlayers++;
}

export function recordPlayerDisconnected(): void {
  if (connectedPlayers > 0) connectedPlayers--;
}

/** For test isolation only — not for production use. */
export function resetMetrics(): void {
  activeRooms = 0;
  connectedPlayers = 0;
}

/** Prometheus text exposition format (version 0.0.4). */
export function metricsText(): string {
  return [
    '# HELP pantheons_active_rooms Number of live match rooms in process',
    '# TYPE pantheons_active_rooms gauge',
    `pantheons_active_rooms ${activeRooms}`,
    '# HELP pantheons_connected_players Number of currently connected players',
    '# TYPE pantheons_connected_players gauge',
    `pantheons_connected_players ${connectedPlayers}`,
    '',
  ].join('\n');
}
