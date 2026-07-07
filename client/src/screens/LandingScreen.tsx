/**
 * Landing (wog-room.md §2): resume auto-redirect, Create-a-room CTA, Join-by-code form.
 * `bindAndNavigate` persists the resume record, stashes the live room in the baton, and
 * routes to /room/<code> — the socket survives the client-side navigation.
 *
 * Visual: the pense-bête itself is the poster — mono display title, la frise des douze,
 * the three-phase turn as a givre-on-navy grid, the eye-colour legend as the only colour.
 */
import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import { PANTHEONS } from '@pantheons/engine';
import { fr } from '../i18n/fr.js';
import { APP_VERSION } from '../version.js';
import { navigate } from '../router.js';
import { clearActiveRoom, setActiveRoom } from '../net/active-room.js';
import { createGameRoom, joinGameRoom, onceMessage, type RoomWelcome } from '../net/room.js';
import { loadResume, saveResume } from '../state/resume.js';
import type { Session } from '../auth/handoff.js';
import { GodFrieze } from '../components/GodFrieze.js';
import { PantheonIcon } from '../components/PantheonIcon.js';

const PANTHEON_LABEL: Record<string, string> = {
  hindou: 'Hindou',
  grec: 'Grec',
  egyptien: 'Égyptien',
  nordique: 'Nordique',
};

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
    <div className="landing">
      <header className="landing__hero">
        <h1 className="titre-affiche landing__titre">Panthéons</h1>
        <p className="landing__sous-titre">Le Jeu des Dieux</p>

        <GodFrieze />

        <p className="landing__tagline">{fr.appTagline}</p>

        <div className="landing__actions">
          <button className="btn btn--primaire" onClick={() => void handleCreate()} disabled={busy}>
            {fr.landing.create}
          </button>

          <form
            className="landing__rejoindre"
            onSubmit={(e) => {
              e.preventDefault();
              void handleJoin();
            }}
          >
            <input
              className="champ-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={fr.landing.codePlaceholder}
              maxLength={8}
              aria-label={fr.landing.joinTitle}
            />
            <button type="submit" className="btn" disabled={busy || !joinCode.trim()}>
              {fr.landing.join}
            </button>
          </form>
        </div>

        {error && (
          <div className="notice notice--erreur landing__erreur" role="alert">
            {error}
          </div>
        )}
      </header>

      <section className="landing__regles" aria-label="Comment on joue">
        <h2 className="titre-affiche landing__regles-titre">Un tour, trois temps — tous en même temps</h2>
        <div className="regles-grille">
          <div className="regle">
            <span className="regle__phase">Pioche</span>
            <p className="regle__texte">
              Assurez-vous d’avoir exactement un pouvoir, puis piochez deux cartes Attribut.
            </p>
          </div>
          <div className="regle">
            <span className="regle__phase">Question</span>
            <p className="regle__texte">
              Posez jusqu’à deux questions — jamais deux au même joueur. Chaque carte posée
              interroge le dieu secret d’un adversaire.
            </p>
          </div>
          <div className="regle">
            <span className="regle__phase">Réponse</span>
            <p className="regle__texte">
              Chacun répond oui ou non, sans mentir. Sûr de vous ? Déclarez « Panthéons » et
              nommez le dieu de chacun. Tout juste : vous gagnez. Une erreur : vous êtes éliminé.
            </p>
          </div>
        </div>

        <div className="axes" aria-label="Les trois axes de déduction">
          <span className="axe">
            <span className="axe__pastille" style={{ background: 'var(--vermillon)' }} />
            Yeux rouges
          </span>
          <span className="axe">
            <span className="axe__pastille" style={{ background: 'var(--turquoise)' }} />
            Yeux bleus
          </span>
          <span className="axe">
            <span className="axe__pastille" style={{ background: 'var(--vert)' }} />
            Yeux verts
          </span>
          {PANTHEONS.map((p) => (
            <span className="axe" key={p}>
              <PantheonIcon pantheon={p} size={24} />
              {PANTHEON_LABEL[p]}
            </span>
          ))}
        </div>
      </section>

      <footer className="landing__pied">
        <span className="libelle">
          {session.displayName ?? session.userId} · {fr.landing.version(APP_VERSION)} · 4 à 7 joueurs
        </span>
      </footer>
    </div>
  );
}

function mapError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return fr.room.errors[message] ?? message;
}
