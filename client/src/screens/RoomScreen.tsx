/**
 * Room screen (wog-room.md §3): owns acquiring the Colyseus room and driving the
 * lobby → board → end lifecycle. Acquisition order: adopt the live-socket baton (fresh
 * same-tab navigate) → probe existence → reconnect with the stored token → fresh join.
 *
 * Never-send guarantee (§5.3): after a reconnect the board is seeded from the
 * RECONNECT_OK payload's fresh per-seat projection ONLY — no merge with cached state.
 */
import { useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import type { PlayerProjection } from '@pantheons/engine';
import { fr } from '../i18n/fr.js';
import { navigate } from '../router.js';
import { depositForTeardown, peekActiveRoom } from '../net/active-room.js';
import { joinGameRoom, onceMessage, reconnectGameRoom, roomExists, type RoomWelcome } from '../net/room.js';
import { clearResume, loadResume, saveResume } from '../state/resume.js';
import { RoomLobby } from './RoomLobby.js';
import { GameView } from './GameView.js';
import type { Session } from '../auth/handoff.js';

type View = 'connecting' | 'lobby' | 'game' | 'duplicate';

interface ReconnectOk extends RoomWelcome {
  state: PlayerProjection;
}

export function RoomScreen({
  code,
  session,
  httpUrl,
  wsUrl,
}: {
  code: string;
  session: Session;
  httpUrl: string;
  wsUrl: string;
}) {
  const [view, setView] = useState<View>('connecting');
  const [proj, setProj] = useState<PlayerProjection | null>(null);
  const [over, setOver] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [seatId, setSeatId] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const seatRef = useRef(0);
  const startedRef = useRef(false);
  const intentionalRef = useRef(false);
  const viewRef = useRef<View>('connecting');
  viewRef.current = view;

  const goHome = (message?: string) => {
    clearResume();
    if (message) sessionStorage.setItem('pantheons.toast', message);
    navigate('/', { replace: true });
  };

  /** Wire room-level handlers once and hand the socket to the current view. */
  const bindRoom = (room: Room, seat: number, hostSeat: number, initial: View, initialProj?: PlayerProjection) => {
    roomRef.current = room;
    seatRef.current = seat;
    setSeatId(seat);

    room.onMessage('state', (p: PlayerProjection) => {
      setProj(p);
      setOver(p.status === 'terminee');
      if (viewRef.current !== 'game') {
        // §4.3: the first projection is the start signal.
        const resume = loadResume();
        if (resume) saveResume({ ...resume, phase: 'IN_PROGRESS' });
        setBanner(null);
        setView('game');
      }
    });
    room.onMessage('gameOver', () => setOver(true));
    room.onMessage('event', () => {});
    room.onMessage('CONN_STATUS', () => {});
    room.onMessage('error', (m: { message: string }) => setBanner(m.message));
    room.onMessage('MATCH_ABORTED', (m: { message?: string }) => {
      // §5.5: back to the same room's fresh lobby with a notice.
      const resume = loadResume();
      if (resume) saveResume({ ...resume, phase: 'LOBBY' });
      setProj(null);
      setOver(false);
      setBanner(m?.message ?? fr.room.aborted);
      setView('lobby');
    });
    room.onLeave(() => {
      roomRef.current = null;
      if (!intentionalRef.current) setBanner(fr.disconnected);
    });

    if (initialProj) {
      setProj(initialProj);
      setOver(initialProj.status === 'terminee');
    }
    setView(initial);
  };

  useEffect(() => {
    if (startedRef.current) return; // StrictMode double-invoke guard
    startedRef.current = true;
    let cancelled = false;

    const freshJoin = async () => {
      try {
        const room = await joinGameRoom(wsUrl, httpUrl, session.sessionToken, code);
        const welcome = await onceMessage<RoomWelcome>(room, 'JOIN_OK');
        if (cancelled) return void room.leave(false);
        saveResume({
          roomCode: code,
          reconnectionToken: room.reconnectionToken,
          seatId: welcome.seatId,
          phase: 'LOBBY',
        });
        bindRoom(room, welcome.seatId, welcome.hostSeat, 'lobby');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'ALREADY_IN_ROOM') {
          // §5.4: the seat is genuinely live in another tab — keep the resume.
          setView('duplicate');
          return;
        }
        goHome(fr.room.errors[message] ?? message);
      }
    };

    const connect = async () => {
      // 1. Adopt — the fresh same-tab path; no new socket.
      const adopted = peekActiveRoom(code);
      if (adopted) {
        bindRoom(adopted.room, adopted.seatId, adopted.hostSeat, 'lobby');
        return;
      }
      // 2. Probe.
      const probe = await roomExists(httpUrl, code);
      if (cancelled) return;
      if (!probe.exists) {
        goHome(fr.room.notFound);
        return;
      }
      // 3. Reconnect or fresh-join.
      const resume = loadResume();
      const hasToken = resume?.roomCode === code && !!resume.reconnectionToken;
      if (hasToken) {
        try {
          const room = await reconnectGameRoom(wsUrl, resume.reconnectionToken);
          if (cancelled) return void room.leave(false);
          if (probe.phase === 'LOBBY') {
            // Re-persist the ROTATED token; host unknown until the first LOBBY_STATE.
            saveResume({ ...resume, reconnectionToken: room.reconnectionToken, phase: 'LOBBY' });
            bindRoom(room, resume.seatId, -1, 'lobby');
          } else {
            // Register first, then re-ask: the reconnect-time unicast races handler
            // registration (wog-room.md §4.1) and Colyseus drops unhandled messages.
            const okPromise = onceMessage<ReconnectOk>(room, 'RECONNECT_OK');
            room.send('REQUEST_STATE', {});
            const ok = await okPromise;
            if (cancelled) return void room.leave(false);
            saveResume({ ...resume, reconnectionToken: room.reconnectionToken, phase: 'IN_PROGRESS' });
            bindRoom(room, ok.seatId, ok.hostSeat, 'game', ok.state);
          }
          return;
        } catch {
          if (cancelled) return;
          if (probe.phase === 'LOBBY') {
            await freshJoin(); // grace expired — lobby seats are re-bindable
          } else {
            goHome(fr.room.sessionExpired);
          }
          return;
        }
      }
      // No stored token (fresh invite link, or a different device/tab).
      if (probe.phase === 'LOBBY') {
        await freshJoin();
      } else {
        goHome(fr.room.inProgress);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      // §3.3: genuine unmount that is not an intentional leave → deposit with a fuse; the
      // fuse fires leave(false) so the server opens the reconnection grace window.
      const room = roomRef.current;
      if (room && !intentionalRef.current) {
        depositForTeardown({ room, roomCode: code, seatId: seatRef.current, hostSeat: -1 });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const leaveIntentionally = () => {
    intentionalRef.current = true;
    const room = roomRef.current;
    try {
      room?.send('LEAVE_ROOM', {});
      void room?.leave(true); // consented — the seat is freed server-side
    } catch {
      /* already gone */
    }
    roomRef.current = null;
    goHome();
  };

  if (view === 'duplicate') {
    return (
      <div className="plein-centre">
        <div>
          <h2 className="titre-affiche">{fr.room.duplicateTitle}</h2>
          <p style={{ color: 'var(--texte-faible)' }}>{fr.room.duplicateBody}</p>
        </div>
      </div>
    );
  }
  if (view === 'lobby' && roomRef.current) {
    return <RoomLobby room={roomRef.current} seatId={seatId} onLeave={leaveIntentionally} notice={banner} />;
  }
  if (view === 'game' && proj) {
    return (
      <GameView
        proj={proj}
        send={(t, p) => roomRef.current?.send(t, p)}
        banner={banner}
        over={over}
        onExit={leaveIntentionally}
      />
    );
  }
  return (
    <div className="plein-centre">
      <span className="libelle">{fr.connecting}</span>
    </div>
  );
}
