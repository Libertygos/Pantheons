/**
 * Barre haute de partie, amincie (Visual V2 §6.6) : marque, numéro de tour, pense-bête
 * (tiroir), aide, quitter. La phase et l'état de la barrière vivent dans le PhaseTracker ;
 * le meneur est un badge sur sa plaque de siège.
 */
import { fr } from '../i18n/fr.js';

export function GameTopBar({
  tour,
  notesOpen,
  onNotes,
  onHelp,
  onExit,
}: {
  tour: number;
  notesOpen: boolean;
  onNotes: () => void;
  onHelp: () => void;
  onExit: () => void;
}) {
  return (
    <div className="jeu__barre">
      <span className="jeu__marque">PANTHÉONS</span>
      <span className="jeu__tour">
        {fr.tour} {tour}
      </span>
      <span className="jeu__barre-droite">
        <button
          className="btn btn--nu btn--petit jeu__notes"
          onClick={onNotes}
          aria-label={notesOpen ? fr.penseBete.fermer : fr.penseBete.ouvrir}
          title={fr.penseBete.title}
          aria-expanded={notesOpen}
          aria-controls="tiroir-pense-bete"
        >
          <NotebookIcon />
          {fr.penseBete.title}
        </button>
        <button className="btn btn--nu btn--petit" onClick={onHelp} aria-label={fr.jeu.aide}>
          ?
        </button>
        <button className="btn btn--nu btn--petit" onClick={onExit}>
          {fr.jeu.quitter}
        </button>
      </span>
    </div>
  );
}

/** Carnet filaire — même langage de trait que les pictos des trois temps. */
function NotebookIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="7" y="4.5" width="19" height="23" rx="2" />
      <path d="M12 4.5v23" />
      <path d="M16.5 11h5.5M16.5 16h5.5M16.5 21h3.5" />
    </svg>
  );
}
