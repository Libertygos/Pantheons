/**
 * Aide contextuelle par zone : un « ? » discret posé sur chaque zone de la table ouvre
 * une boîte qui rappelle les règles et les cartes de CETTE zone (même dispositif que sur
 * les autres jeux gosgames). Le rappel général des règles reste dans la barre haute.
 */
import { useEffect, useState } from 'react';
import { fr } from '../i18n/fr.js';

export type AideSujet = keyof typeof fr.aideZones.zones;

export function AideZone({ sujet, className }: { sujet: AideSujet; className?: string }) {
  const [open, setOpen] = useState(false);
  const aide = fr.aideZones.zones[sujet];

  // ESC ferme CETTE modale et rien d'autre : capture + stopPropagation, même convention
  // que la loupe — le gestionnaire de couches de GameView (modale → tiroir) ne voit rien.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  return (
    <>
      <button
        type="button"
        className={['btn-aide', className].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
        aria-label={`${fr.aideZones.bouton} — ${aide.titre}`}
        title={`${fr.aideZones.bouton} — ${aide.titre}`}
      >
        ?
      </button>
      {open && (
        <div className="voile" onClick={() => setOpen(false)}>
          <div className="modale modale--aide" onClick={(e) => e.stopPropagation()}>
            <h2 className="titre-affiche modale__titre">{aide.titre}</h2>
            {aide.corps.map((p) => (
              <p className="modale__texte" key={p}>
                {p}
              </p>
            ))}
            <div className="modale__pied">
              <button className="btn" onClick={() => setOpen(false)}>
                {fr.aide.fermer}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
