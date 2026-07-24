/**
 * Barre haute de partie, amincie (Visual V2 §6.6) : marque, numéro de tour, aide, quitter.
 * S4 : elle porte aussi VOS statuts personnels — « Meneur : vous » (B17, la chartreuse
 * est l'usage réservé du meneur) et « Éliminé » persistant (B12). La phase et l'état de
 * la barrière vivent dans le PhaseTracker ; le meneur adverse est un badge sur sa plaque ;
 * le pense-bête se commande par sa poignée au bord droit (QoL §3).
 */
import { fr } from '../i18n/fr.js';

export function GameTopBar({
  tour,
  meneurVous = false,
  elimine = false,
  onHelp,
  onExit,
}: {
  tour: number;
  /** B17 : vous êtes le meneur — rien d'autre ne vous le disait. */
  meneurVous?: boolean;
  /** B12 : l'état « Éliminé » persistant (le dock porte son jumeau). */
  elimine?: boolean;
  onHelp: () => void;
  onExit: () => void;
}) {
  return (
    <div className="jeu__barre">
      <span className="jeu__marque">PANTHÉONS</span>
      <span className="jeu__tour">
        {fr.tour} {tour}
      </span>
      {meneurVous && <span className="jeu__meneur">{fr.jeu.meneurVous}</span>}
      {elimine && <span className="jeu__elimine">{fr.jeu.elimine}</span>}
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
