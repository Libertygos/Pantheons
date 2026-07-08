/**
 * Descripteurs texte des cartes question (chrome : tooltips, alt, tuiles de secours) —
 * extraits de l'ancien BoardSlots pour être partagés entre sièges, main et dock.
 */
import type { QuestionCard } from '@pantheons/engine';
import { SUBTYPE_LABEL, VALEUR_LABEL } from '../assets.js';

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
