/**
 * Descripteurs texte des cartes question (chrome : tooltips, alt, tuiles de secours) —
 * extraits de l'ancien BoardSlots pour être partagés entre sièges, main et dock.
 *
 * S3 : les légendes de chrome (`questionCardTexte`) citent le texte VERBATIM des faces
 * (card-catalog.md §2–3, orthographe [sic] conservée — « Êtes vous », « y'a »… jamais
 * « corrigée ») pour que l'effet se lise sans la loupe, y compris au tactile.
 */
import { GODS, data, type GodId, type QuestionCard } from '@pantheons/engine';
import { godCardSrc, SUBTYPE_LABEL, VALEUR_LABEL } from '../assets.js';
import { fr } from '../i18n/fr.js';
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

/** Questions verbatim des 9 faces Attribut (card-catalog.md §2 — [sic] conservé). */
const ATTRIBUT_QUESTION: Record<string, string> = {
  masculin: '« Êtes vous un personnage masculin? »',
  feminin: '« Êtes vous un personnage féminin? »',
  bleus: '« Avez vous les yeux bleus? »',
  verts: '« Avez vous les yeux verts? »',
  rouges: '« Avez vous les yeux rouges? »',
  hindou: '« Faites vous partie du panthéon Hindou? »',
  grec: '« Faites vous partie du panthéon Grec? »',
  egyptien: '« Faites vous partie du panthéon Egyptien? »',
  nordique: '« Faites vous partie du panthéon Nordique? »',
};

/**
 * Texte de face pour la légende de chrome (S3). Attribut : la question verbatim.
 * Action : le texte verbatim du catalogue moteur — les Multiple recomposent leur set
 * avec les LIBELLÉS des dieux (les ids `brahma, re…` sont techniques), les Spéciales
 * ajoutent leur phase de déclenchement (bande blanche de la face) en chrome.
 */
export function questionCardTexte(card: QuestionCard): string | null {
  if (card.type === 'attribut') return ATTRIBUT_QUESTION[String(card.valeur)] ?? null;
  const def = data.ACTIONS[card.effectKey];
  if (!def) return null;
  if (def.subtype === 'multiple' && def.gods) {
    return `« Êtes vous l'un de ces personnages? » — ${def.gods
      .map((g) => GODS[g].label)
      .join(', ')}.`;
  }
  if (def.subtype === 'speciale' && def.triggerPhase) {
    return `${def.texte} ${fr.jeu.declenchement(fr.phases[def.triggerPhase])}`;
  }
  return def.texte;
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
