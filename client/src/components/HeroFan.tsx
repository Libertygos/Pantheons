/**
 * L'éventail des douze — le héros de la page d'accueil : les 12 cartes Personnage
 * finales tenues en éventail (recette brief §9.1 : pivot sous la carte, --i / --abs-i
 * par carte, centre devant en z). Survol OU focus clavier : la carte se redresse et
 * monte vers la caméra, ses voisines s'écartent d'une demi-largeur. Flottement
 * quasi imperceptible au repos (coupé sous prefers-reduced-motion). Sous 900px,
 * l'éventail se dégrade en rangée à défilement magnétique — jamais un éventail écrasé.
 */
import type { CSSProperties } from 'react';
import { ALL_GODS } from '@pantheons/engine';
import { godCardSrc } from '../assets.js';
import { fr } from '../i18n/fr.js';
import { GameCard } from './GameCard.js';

export function HeroFan() {
  const n = ALL_GODS.length;
  return (
    <div className="eventail" aria-label={fr.landing.fanAria} role="group">
      {ALL_GODS.map((god, idx) => {
        const i = idx - (n - 1) / 2;
        const abs = Math.abs(i);
        return (
          <div
            key={god.id}
            className="eventail__carte"
            role="img"
            aria-label={god.label}
            tabIndex={0}
            style={{ '--i': i, '--abs-i': abs, '--z': Math.round(40 - abs * 2) } as CSSProperties}
          >
            <GameCard
              size="lg"
              face={{
                src: godCardSrc(god.id),
                alt: god.label,
                typeLabel: 'Personnage',
                bodyLabel: god.label,
                tint: 'teinte-personnage',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
