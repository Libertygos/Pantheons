/**
 * Descripteurs texte des cartes question (chrome : tooltips, alt, tuiles de secours) —
 * extraits de l'ancien BoardSlots pour être partagés entre sièges, main et dock.
 */
import { GODS, type GodId, type QuestionCard } from '@pantheons/engine';
import { godCardSrc, SUBTYPE_LABEL, VALEUR_LABEL } from '../assets.js';
import type { GameCardFace } from './GameCard.js';

const BAND: Record<string, string> = {
  bleus: 'var(--turquoise)',
  verts: 'var(--vert)',
  rouges: 'var(--vermillon)',
};

export function describeQuestionCard(card: QuestionCard): string {
  if (card.type === 'attribut') return VALEUR_LABEL[card.valeur] ?? String(card.valeur);
  if (card.subtype === 'non' && card.valeur) {
    return `${SUBTYPE_LABEL.non} · ${VALEUR_LABEL[String(card.valeur)] ?? card.valeur}`;
  }
  return SUBTYPE_LABEL[card.subtype];
}

export function questionCardBand(card: QuestionCard): string | undefined {
  return card.type === 'attribut' ? BAND[String(card.valeur)] : undefined;
}

/** Face d'inspection d'une carte Personnage (loupe : portraits du pense-bête, déclaration, dieu du dock). */
export function godCardFace(id: GodId): GameCardFace {
  return {
    src: godCardSrc(id),
    alt: GODS[id].label,
    typeLabel: 'Personnage',
    bodyLabel: GODS[id].label,
    tint: 'teinte-personnage',
  };
}
