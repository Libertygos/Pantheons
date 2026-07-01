import { useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import type { PlayerProjection } from '@pantheons/engine';
import { GODS } from '@pantheons/engine';
import { resolveSession } from './auth/handoff.js';
import { joinRoom, type LobbyState } from './net/room.js';
import { Lobby } from './components/Lobby.js';
import { PhaseIndicator } from './components/PhaseIndicator.js';
import { BoardSlots } from './components/BoardSlots.js';
import { PenseBeteGrid } from './components/PenseBeteGrid.js';
import { CardImage } from './components/CardImage.js';
import { godCardSrc } from './assets.js';
import { fr } from './i18n/fr.js';

const HTTP_URL = import.meta.env.VITE_SERVER_HTTP ?? 'http://localhost:2567';
const WS_URL = import.meta.env.VITE_SERVER_WS ?? 'ws://localhost:2567';

export function App() {
  const [status, setStatus] = useState<'auth' | 'lobby' | 'game' | 'error' | 'over'>('auth');
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [proj, setProj] = useState<PlayerProjection | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await resolveSession(HTTP_URL).catch(() => null);
      if (!session) {
        setBanner(fr.handoffFailed);
        setStatus('error');
        return;
      }
      const room = await joinRoom(WS_URL, session.sessionToken, {
        onLobby: (l) => { if (!cancelled) { setLobby(l); setStatus('lobby'); } },
        onState: (p) => { if (!cancelled) { setProj(p); setStatus(p.status === 'terminee' ? 'over' : 'game'); } },
        onError: (m) => setBanner(m),
        onEvent: () => {},
        onLeave: () => setBanner(fr.disconnected),
      }).catch(() => null);
      if (room) roomRef.current = room;
      else if (!cancelled) { setBanner(fr.handoffFailed); setStatus('error'); }
    })();
    return () => { cancelled = true; roomRef.current?.leave(); };
  }, []);

  const send = (type: string, payload: unknown) => roomRef.current?.send(type, payload);

  if (status === 'auth') return <Centered>{fr.connecting}</Centered>;
  if (status === 'error') return <Centered>{banner ?? fr.handoffFailed}</Centered>;
  if (status === 'lobby' && lobby) return <Lobby lobby={lobby} onStart={() => send('start', {})} />;
  if (!proj) return <Centered>{fr.connecting}</Centered>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      {banner && <div style={{ background: '#402', padding: 8, borderRadius: 6, marginBottom: 8 }}>{banner}</div>}
      <PhaseIndicator p={proj} />

      <section style={{ display: 'flex', gap: 16 }}>
        <div>
          <h3>{fr.yourGod}</h3>
          <CardImage src={godCardSrc(proj.self.god)} label={GODS[proj.self.god].label} width={120} />
          <p style={{ fontSize: 12 }}>
            Attributs: {proj.self.hand.attributs.length} · Actions: {proj.self.hand.actions.length} · Pouvoirs: {proj.self.powers.length}
          </p>
          <PhaseActions proj={proj} send={send} />
        </div>
        <div style={{ flex: 1 }}>
          <PenseBeteGrid opponents={proj.opponents.map((o) => ({ userId: o.userId, displayName: o.displayName }))} />
        </div>
      </section>

      <h3>Plateaux</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {proj.seatOrder.map((uid) => {
          const board = proj.boardBySeat[uid];
          if (!board) return null;
          const name = uid === proj.self.userId ? proj.self.displayName : proj.opponents.find((o) => o.userId === uid)?.displayName ?? uid;
          return <BoardSlots key={uid} board={board} ownerName={name} />;
        })}
      </div>

      {status === 'over' && (
        <Centered>{fr.gameOver(proj.winner ?? '?')}</Centered>
      )}
    </div>
  );
}

/** Minimal phase-action controls wiring the three submissions to the barrier. */
function PhaseActions({ proj, send }: { proj: PlayerProjection; send: (t: string, p: unknown) => void }) {
  if (proj.barrier.youSubmitted) return <p style={{ opacity: 0.6 }}>{fr.submit} ✓</p>;
  switch (proj.phase) {
    case 'pioche':
      return <button onClick={() => send('pioche', {})}>{fr.phases.pioche} — {fr.submit}</button>;
    case 'question':
      // Full targeting UI is Phase-1 polish; submitting 0 questions is a valid pass.
      return <button onClick={() => send('question', { intent: { plays: [] } })}>{fr.pass}</button>;
    case 'reponse':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => send('declaration', {})}>{fr.pass}</button>
          <button
            onClick={() => {
              const guesses: Record<string, string> = {};
              for (const o of proj.opponents) if (o.alive) guesses[o.userId] = proj.self.god; // placeholder guesses
              send('declaration', { guesses });
            }}
          >
            {fr.declaration.button}
          </button>
        </div>
      );
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: '#cdbde8' }}>{children}</div>;
}
