/**
 * Resume record (wog-room.md §5): survives a reload; drives the landing auto-redirect and
 * the reconnect path. The Colyseus reconnection token ROTATES on every new room object —
 * re-persist it after every (re)connect or the *second* refresh uses a stale token.
 */
const RESUME_KEY = 'pantheons.resume';

export type ResumePhase = 'LOBBY' | 'IN_PROGRESS';

export interface ResumeRecord {
  roomCode: string;
  reconnectionToken: string;
  seatId: number;
  phase: ResumePhase;
}

export function saveResume(record: ResumeRecord): void {
  localStorage.setItem(RESUME_KEY, JSON.stringify(record));
}

export function loadResume(): ResumeRecord | null {
  const raw = localStorage.getItem(RESUME_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ResumeRecord;
    return typeof parsed?.roomCode === 'string' && typeof parsed?.reconnectionToken === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function clearResume(): void {
  localStorage.removeItem(RESUME_KEY);
}
