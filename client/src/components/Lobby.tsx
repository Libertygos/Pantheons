/** Lobby view — mirrors WoG: min 4 / max 7, host starts once the floor is met. */
import { fr } from '../i18n/fr.js';
import type { LobbyState } from '../net/room.js';

export function Lobby({ lobby, onStart }: { lobby: LobbyState; onStart: () => void }) {
  return (
    <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <h1>{fr.appTitle}</h1>
      <p style={{ opacity: 0.75 }}>{fr.appTagline}</p>
      <h2>{fr.lobby.title}</h2>
      <p>{fr.lobby.waiting(lobby.players.length, lobby.min)}</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {lobby.players.map((pl) => (
          <li key={pl.userId} style={{ padding: 4 }}>
            {pl.displayName}
          </li>
        ))}
      </ul>
      <button
        disabled={!lobby.canStart}
        onClick={onStart}
        style={{ padding: '8px 20px', cursor: lobby.canStart ? 'pointer' : 'not-allowed' }}
      >
        {fr.lobby.start}
      </button>
      {!lobby.canStart && <div style={{ opacity: 0.6, marginTop: 8 }}>{fr.lobby.needMore(lobby.min)}</div>}
    </div>
  );
}
