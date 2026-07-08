/**
 * Barre haute de partie, amincie (Visual V2 §6.6) : marque, numéro de tour, aide,
 * quitter. La phase et l'état de la barrière vivent dans le PhaseTracker ; le meneur
 * est un badge sur sa plaque de siège.
 */
import { fr } from '../i18n/fr.js';

export function GameTopBar({
  tour,
  onHelp,
  onExit,
}: {
  tour: number;
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
