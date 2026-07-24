/**
 * Lobby (wog-room.md §4): seat-slot list, ready toggle, host-only seat controls, start,
 * consented leave. Driven entirely by the pre-bound room; re-asks with REQUEST_LOBBY_STATE
 * on mount because the join-time broadcast races handler registration.
 *
 * Visual: the seat list is the pense-bête grid — numbered givre row-heads 1..7 on navy,
 * hairline rules; ready/disconnected speak the legend colours (vert / vermillon).
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

  if (!lobby) {
    return (
      <div className="plein-centre">
        <span className="libelle">{fr.connecting}</span>
      </div>
    );
  }

  const mySeat = lobby.seats[seatId];
  const isHost = seatId === lobby.hostSeat;
  const trailingEmpty = lobby.seats.length > 0 && !lobby.seats[lobby.seats.length - 1]!.occupied;
  const occupied = lobby.seats.filter((s) => s.occupied).length;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${lobby.roomCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible (contexte non sécurisé) : le code reste lisible juste au-dessus
    }
  };

  return (
    <div className="lobby">
      <header className="lobby__entete">
        <h1 className="titre-affiche lobby__titre">Panthéons</h1>

        <div className="lobby__code-bloc">
          <span className="libelle lobby__code-libelle">{fr.lobby.code}</span>
          <strong className="lobby__code">{lobby.roomCode}</strong>
          <div className="lobby__inviter">
            {/* un vrai bouton (pas un lien nu) + confirmation verte sur place */}
            <button
              className={`btn btn--petit ${copied ? 'btn--copie' : ''}`}
              onClick={() => void copyInvite()}
            >
              {copied ? `✓ ${fr.lobby.copied}` : fr.lobby.copyInvite}
            </button>
          </div>
          <div className="tri-bande" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        {notice && (
          <div className="notice notice--erreur lobby__notice" role="alert">
            {notice}
          </div>
        )}
      </header>

      <ul className="sieges" aria-label={fr.lobby.players}>
        {lobby.seats.map((seat) => {
          const isMe = seat.seatId === seatId;
          const isHostSeat = seat.seatId === lobby.hostSeat && seat.occupied;
          return (
            <li key={seat.seatId} className={`siege ${seat.occupied ? '' : 'siege--libre'}`}>
              <span className="siege__num" aria-hidden="true">
                {seat.seatId + 1}
              </span>
              <span className="siege__nom">
                <span className="siege__nom-texte">
                  {seat.occupied ? seat.displayName : fr.lobby.seatEmpty}
                </span>
                {isHostSeat && <span className="siege__badge siege__badge--hote">{fr.lobby.host}</span>}
                {isMe && seat.occupied && <span className="siege__badge">{fr.jeu.vous}</span>}
              </span>
              <span
                className={`siege__etat ${
                  !seat.occupied
                    ? ''
                    : seat.conn === 'DISCONNECTED'
                      ? 'siege__etat--deco'
                      : seat.ready
                        ? 'siege__etat--pret'
                        : 'siege__etat--attente'
                }`}
              >
                {seat.occupied
                  ? seat.conn === 'DISCONNECTED'
                    ? fr.lobby.disconnectedSeat
                    : seat.ready
                      ? `✓ ${fr.lobby.ready}`
                      : fr.lobby.notReady
                  : ''}
              </span>
            </li>
          );
        })}
      </ul>

      {/* B9 : table au complet et prête → la ligne d'état le dit, au lieu de rester
          bloquée sur « En attente de joueurs » */}
      <p className={`lobby__hint ${lobby.canStart ? 'lobby__hint--pret' : ''}`}>
        {lobby.canStart ? fr.lobby.readyToStart : fr.lobby.waiting(occupied, lobby.minSeats)}
      </p>
      {/* S5 : la porte de démarrage expliquée à tous, une ligne — min/max du serveur
          (les salons de test admin ont leur propre minimum côté serveur). */}
      <p className="lobby__gate">{fr.lobby.gate(lobby.minSeats, lobby.maxSeats)}</p>

      <div className="lobby__controles">
        <button
          className={`btn ${mySeat?.ready ? '' : 'btn--givre'}`}
          onClick={() => room.send('SET_READY', { ready: !mySeat?.ready })}
        >
          {mySeat?.ready ? fr.lobby.cancelReady : fr.lobby.imReady}
        </button>
        {isHost && (
          <>
            <button
              className="btn"
              onClick={() => room.send('ADD_SEAT', {})}
              disabled={lobby.seats.length >= lobby.maxSeats}
            >
              {fr.lobby.addSeat}
            </button>
            <button
              className="btn"
              onClick={() => room.send('REMOVE_SEAT', {})}
              disabled={lobby.seats.length <= lobby.minSeats || !trailingEmpty}
            >
              {fr.lobby.removeSeat}
            </button>
            <button
              className="btn btn--primaire"
              onClick={() => room.send('START_MATCH', {})}
              disabled={!lobby.canStart}
            >
              {fr.lobby.start}
            </button>
          </>
        )}
        <button className="btn btn--nu" onClick={onLeave}>
          {fr.lobby.leave}
        </button>
      </div>
      {/* S5 : l'ancien rappel réservé à l'hôte est absorbé par la ligne .lobby__gate,
          visible de tous — une seule source pour la porte de démarrage. */}
    </div>
  );
}
