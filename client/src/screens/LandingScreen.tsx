/**
 * Landing (wog-room.md §2): resume auto-redirect, Create-a-room CTA, Join-by-code form.
 * `bindAndNavigate` persists the resume record, stashes the live room in the baton, and
 * routes to /room/<code> — the socket survives the client-side navigation.
 */
import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import { fr } from '../i18n/fr.js';
import { APP_VERSION } from '../version.js';
import { navigate } from '../router.js';
import { clearActiveRoom, setActiveRoom } from '../net/active-room.js';
import { createGameRoom, joinGameRoom, onceMessage, type RoomWelcome } from '../net/room.js';
import { loadResume, saveResume } from '../state/resume.js';
import type { Session } from '../auth/handoff.js';

export function LandingScreen({
  session,
  httpUrl,
  wsUrl,
}: {
  session: Session;
  httpUrl: string;
  wsUrl: string;
}) {
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);

  // §2.1: an existing resume record redirects straight back into the room.
  useEffect(() => {
    const resume = loadResume();
    if (resume) {
      setResumed(true);
      navigate(`/room/${resume.roomCode}`, { replace: true });
    }
  }, []);
  if (resumed) return null;

  const bindAndNavigate = (room: Room, welcome: RoomWelcome) => {
    saveResume({
      roomCode: welcome.roomCode,
      reconnectionToken: room.reconnectionToken,
      seatId: welcome.seatId,
      phase: 'LOBBY',
    });
    setActiveRoom({ room, roomCode: welcome.roomCode, seatId: welcome.seatId, hostSeat: welcome.hostSeat });
    navigate(`/room/${welcome.roomCode}`);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    clearActiveRoom();
    try {
      const room = await createGameRoom(wsUrl, session.sessionToken);
      const welcome = onceMessage<RoomWelcome>(room, 'ROOM_CREATED');
      bindAndNavigate(room, await welcome);
    } catch (err) {
      setError(mapError(err));
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    setError(null);
    clearActiveRoom();
    try {
      const room = await joinGameRoom(wsUrl, httpUrl, session.sessionToken, code);
      const welcome = onceMessage<RoomWelcome>(room, 'JOIN_OK');
      bindAndNavigate(room, await welcome);
    } catch (err) {
      setError(mapError(err));
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{fr.appTitle}</h1>
      <p style={{ opacity: 0.75 }}>{fr.appTagline}</p>
      <p>{fr.landing.welcome(session.userId)}</p>

      <button onClick={handleCreate} disabled={busy} style={{ padding: '10px 24px', fontSize: 16, cursor: 'pointer' }}>
        {fr.landing.create}
      </button>

      <h3 style={{ marginTop: 32 }}>{fr.landing.joinTitle}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleJoin();
        }}
        style={{ display: 'flex', gap: 8, justifyContent: 'center' }}
      >
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder={fr.landing.codePlaceholder}
          maxLength={8}
          style={{ textTransform: 'uppercase', padding: 8, width: 120, textAlign: 'center', letterSpacing: 2 }}
        />
        <button type="submit" disabled={busy || !joinCode.trim()} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          {fr.landing.join}
        </button>
      </form>
      {error && <p style={{ color: '#e66' }}>{error}</p>}

      <footer style={{ marginTop: 64, opacity: 0.5, fontSize: 12 }}>{fr.landing.version(APP_VERSION)}</footer>
    </div>
  );
}

function mapError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return fr.room.errors[message] ?? message;
}
