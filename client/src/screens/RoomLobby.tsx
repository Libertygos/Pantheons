/**
 * Lobby (wog-room.md §4): seat-slot list, ready toggle, host-only seat controls, start,
 * consented leave. Driven entirely by the pre-bound room; re-asks with REQUEST_LOBBY_STATE
 * on mount because the join-time broadcast races handler registration.
 */
import { useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { fr } from '../i18n/fr.js';
import type { LobbyState } from '../net/room.js';

export function RoomLobby({
  room,
  seatId,
  onLeave,
  notice,
}: {
  room: Room;
  seatId: number;
  onLeave: () => void;
  notice: string | null;
}) {
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [copied, setCopied] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    room.onMessage('LOBBY_STATE', (l: LobbyState) => setLobby(l));
    if (!requested.current) {
      requested.current = true;
      room.send('REQUEST_LOBBY_STATE', {});
    }
  }, [room]);

  if (!lobby) return <p style={{ textAlign: 'center', marginTop: 80 }}>{fr.connecting}</p>;

  const mySeat = lobby.seats[seatId];
  const isHost = seatId === lobby.hostSeat;
  const trailingEmpty = lobby.seats.length > 0 && !lobby.seats[lobby.seats.length - 1]!.occupied;

  const copyInvite = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${lobby.roomCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{fr.appTitle}</h1>
      <h2>{fr.lobby.title}</h2>
      {notice && <div style={{ background: '#530', padding: 8, borderRadius: 6, margin: '8px 0' }}>{notice}</div>}

      <p>
        {fr.lobby.code} : <strong style={{ letterSpacing: 3 }}>{lobby.roomCode}</strong>{' '}
        <button onClick={() => void copyInvite()} style={{ marginLeft: 8, cursor: 'pointer' }}>
          {copied ? fr.lobby.copied : fr.lobby.copyInvite}
        </button>
      </p>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {lobby.seats.map((seat) => (
          <li
            key={seat.seatId}
            style={{
              padding: '6px 12px',
              margin: '4px 0',
              border: '1px solid #446',
              borderRadius: 6,
              display: 'flex',
              justifyContent: 'space-between',
              opacity: seat.occupied ? 1 : 0.5,
            }}
          >
            <span>
              {seat.occupied ? seat.displayName : fr.lobby.seatEmpty}
              {seat.seatId === lobby.hostSeat && seat.occupied ? ` — ${fr.lobby.host}` : ''}
              {seat.seatId === seatId ? ' (vous)' : ''}
            </span>
            <span style={{ opacity: 0.8 }}>
              {seat.occupied
                ? seat.conn === 'DISCONNECTED'
                  ? fr.lobby.disconnectedSeat
                  : seat.ready
                    ? `✓ ${fr.lobby.ready}`
                    : fr.lobby.notReady
                : ''}
            </span>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => room.send('SET_READY', { ready: !mySeat?.ready })} style={{ cursor: 'pointer' }}>
          {mySeat?.ready ? fr.lobby.cancelReady : fr.lobby.imReady}
        </button>
        {isHost && (
          <>
            <button
              onClick={() => room.send('ADD_SEAT', {})}
              disabled={lobby.seats.length >= lobby.maxSeats}
              style={{ cursor: 'pointer' }}
            >
              {fr.lobby.addSeat}
            </button>
            <button
              onClick={() => room.send('REMOVE_SEAT', {})}
              disabled={lobby.seats.length <= lobby.minSeats || !trailingEmpty}
              style={{ cursor: 'pointer' }}
            >
              {fr.lobby.removeSeat}
            </button>
            <button
              onClick={() => room.send('START_MATCH', {})}
              disabled={!lobby.canStart}
              style={{ cursor: lobby.canStart ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
            >
              {fr.lobby.start}
            </button>
          </>
        )}
        <button onClick={onLeave} style={{ cursor: 'pointer' }}>
          {fr.lobby.leave}
        </button>
      </div>
      {isHost && !lobby.canStart && <p style={{ opacity: 0.6, marginTop: 8 }}>{fr.lobby.startHint}</p>}
    </div>
  );
}
