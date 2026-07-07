/**
 * App shell: entry resolution (handoff → stored session → bounce, wog-room.md §1) then two
 * routes — the landing page and /room/:code. The live socket crosses the navigate via the
 * active-room baton (net/active-room.ts), never via React state.
 */
import { useEffect, useState } from 'react';
import type { Session } from './auth/handoff.js';
import { bounceToPlatform, resolveEntry } from './net/entry.js';
import { roomCodeFromPath, usePath } from './router.js';
import { TopBar } from './components/TopBar.js';
import { LandingScreen } from './screens/LandingScreen.js';
import { RoomScreen } from './screens/RoomScreen.js';
import { fr } from './i18n/fr.js';

const HTTP_URL = import.meta.env.VITE_SERVER_HTTP ?? window.location.origin;
const WS_URL =
  import.meta.env.VITE_SERVER_WS ?? window.location.origin.replace(/^http/, 'ws');

const TOAST_KEY = 'pantheons.toast';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'auth' | 'ready' | 'bounce'>('auth');
  const path = usePath();

  useEffect(() => {
    void resolveEntry(HTTP_URL).then((entry) => {
      if (entry.outcome === 'authenticated') {
        setSession(entry.session);
        setStatus('ready');
      } else {
        setStatus('bounce');
        bounceToPlatform();
      }
    });
  }, []);

  if (status === 'auth') return <Centered>{fr.connecting}</Centered>;
  if (status === 'bounce' || !session) return <Centered>{fr.handoffFailed}</Centered>;

  const roomCode = roomCodeFromPath(path);
  if (roomCode) {
    return (
      <RoomScreen key={roomCode} code={roomCode} session={session} httpUrl={HTTP_URL} wsUrl={WS_URL} />
    );
  }
  return (
    <>
      <TopBar />
      <Toast />
      <LandingScreen session={session} httpUrl={HTTP_URL} wsUrl={WS_URL} />
    </>
  );
}

/** One-shot notice carried across a navigate (room not found, session expired, …). */
function Toast() {
  const [message] = useState(() => {
    const m = sessionStorage.getItem(TOAST_KEY);
    sessionStorage.removeItem(TOAST_KEY);
    return m;
  });
  if (!message) return null;
  return (
    <div style={{ maxWidth: 520, margin: '16px auto 0', padding: '0 16px' }}>
      <div className="notice notice--erreur" role="status">
        {message}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="plein-centre">
      <span className="libelle">{children}</span>
    </div>
  );
}
