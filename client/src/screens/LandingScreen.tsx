/**
 * Landing (wog-room.md §2): resume auto-redirect, Create-a-room CTA, Join-by-code form.
 * `bindAndNavigate` persists the resume record, stashes the live room in the baton, and
 * routes to /room/<code> — the socket survives the client-side navigation.
 *
 * Visual V2 « cartes sur une table de nuit » : l'éventail des douze cartes Personnage en
 * héros (le titre partage son espace), zone d'action sur un mat de table (CTA lumineux +
 * code segmenté), les trois temps du tour posés comme trois cartes ordonnées I·II·III
 * sur une ligne pointillée, la légende en jetons de jeu.
 */
import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import { PANTHEONS, type Pantheon } from '@pantheons/engine';
import { fr } from '../i18n/fr.js';
import { APP_VERSION } from '../version.js';
import { navigate } from '../router.js';
import { clearActiveRoom, setActiveRoom } from '../net/active-room.js';
import { createGameRoom, joinGameRoom, onceMessage, type RoomWelcome } from '../net/room.js';
import { loadResume, saveResume } from '../state/resume.js';
import type { Session } from '../auth/handoff.js';
import { VALEUR_LABEL } from '../assets.js';
import { HeroFan } from '../components/HeroFan.js';
import { PantheonIcon } from '../components/PantheonIcon.js';
import { CodeInput } from '../components/CodeInput.js';

const ROOM_CODE_LENGTH = 5;

const TEMPS = ['pioche', 'question', 'reponse'] as const;
const TEMPS_CHIP: Record<(typeof TEMPS)[number], string> = {
  pioche: 'I',
  question: 'II',
  reponse: 'III',
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
    if (code.length < ROOM_CODE_LENGTH) return;
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
        <div className="landing__titre-bloc">
          <h1 className="titre-affiche landing__titre">Panthéons</h1>
          <p className="landing__sous-titre">Le Jeu des Dieux</p>
        </div>

        <HeroFan />

        <p className="landing__tagline">{fr.appTagline}</p>

        <div className="landing__mat surface-levee">
          <button
            className="btn btn--primaire btn--lueur"
            onClick={() => void handleCreate()}
            disabled={busy}
          >
            {fr.landing.create}
          </button>

          <form
            className="landing__rejoindre"
            aria-labelledby="rejoindre-libelle"
            onSubmit={(e) => {
              e.preventDefault();
              void handleJoin();
            }}
          >
            {/* B15 : les cases de code portent enfin leur libellé visible */}
            <span className="libelle landing__rejoindre-libelle" id="rejoindre-libelle">
              {fr.landing.joinTitle}
            </span>
            <div className="landing__rejoindre-champs">
              <CodeInput
                value={joinCode}
                onChange={setJoinCode}
                length={ROOM_CODE_LENGTH}
                disabled={busy}
              />
              <button
                type="submit"
                className="btn"
                disabled={busy || joinCode.length < ROOM_CODE_LENGTH}
              >
                {fr.landing.join}
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="notice notice--erreur landing__erreur" role="alert">
            {error}
          </div>
        )}
      </header>

      <hr className="tri-bande tri-bande--fine" aria-hidden="true" />

      <section className="landing__regles" aria-label={fr.landing.reglesAria}>
        <h2 className="titre-affiche landing__regles-titre">{fr.landing.reglesTitre}</h2>

        <div className="temps-rang">
          {TEMPS.map((temps) => (
            <article className={`carte-temps carte-temps--${temps}`} key={temps}>
              <span className="carte-temps__chip" aria-hidden="true">
                {TEMPS_CHIP[temps]}
              </span>
              <TempsPicto temps={temps} />
              <h3 className="carte-temps__phase">{fr.phases[temps]}</h3>
              <p className="carte-temps__texte">{fr.landing.regles[temps]}</p>
            </article>
          ))}
        </div>

        <div className="axes" aria-label={fr.landing.axesAria}>
          <span className="axe">
            <EyeToken color="var(--vermillon)" />
            {VALEUR_LABEL['rouges']}
          </span>
          <span className="axe">
            <EyeToken color="var(--turquoise)" />
            {VALEUR_LABEL['bleus']}
          </span>
          <span className="axe">
            <EyeToken color="var(--vert)" />
            {VALEUR_LABEL['verts']}
          </span>
          {PANTHEONS.map((p: Pantheon) => (
            <span className="axe" key={p}>
              <span className="jeton">
                <PantheonIcon pantheon={p} size={24} />
              </span>
              {VALEUR_LABEL[p]}
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

/** Pictogrammes filaires des trois temps — même langage que PantheonIcon (trait 1.4). */
function TempsPicto({ temps }: { temps: (typeof TEMPS)[number] }) {
  return (
    <svg
      className="carte-temps__picto"
      width="34"
      height="34"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {temps === 'pioche' && (
        <g>
          <rect x="5.5" y="7" width="11" height="17" rx="1.5" transform="rotate(-7 11 15.5)" />
          <rect x="15" y="7.5" width="11" height="17" rx="1.5" transform="rotate(7 20.5 16)" />
          <path d="M20.5 13v6M17.5 16h6" />
        </g>
      )}
      {temps === 'question' && (
        <g>
          <rect x="10" y="5.5" width="12" height="18" rx="1.5" />
          <path d="M13.8 11.5c0-3.4 4.9-3.3 4.9-.5 0 1.9-2.6 2-2.6 4.2" />
          <circle cx="16" cy="19" r="0.4" fill="currentColor" />
          <path d="M16 26.5v2.5" />
        </g>
      )}
      {temps === 'reponse' && (
        <g>
          <path d="M5.5 7.5h21v13H15l-5.5 5v-5h-4z" />
          <path d="M10.5 14l2.6 2.6 5-5" />
          <path d="M20.5 11.8l3.6 3.6M24.1 11.8l-3.6 3.6" />
        </g>
      )}
    </svg>
  );
}

/** Jeton « œil » de la légende : l'amande filaire, l'iris dans la couleur de l'axe. */
function EyeToken({ color }: { color: string }) {
  return (
    <svg
      width="30"
      height="18"
      viewBox="0 0 30 18"
      fill="none"
      stroke="var(--filet-fort)"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <path d="M2 9c4.4-5.3 8.7-8 13-8s8.6 2.7 13 8c-4.4 5.3-8.7 8-13 8S6.4 14.3 2 9Z" fill="var(--nuit-3)" />
      <circle cx="15" cy="9" r="4.2" fill={color} stroke="none" />
      <circle cx="15" cy="9" r="1.6" fill="var(--nuit-3)" stroke="none" />
    </svg>
  );
}

function mapError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return fr.room.errors[message] ?? message;
}
