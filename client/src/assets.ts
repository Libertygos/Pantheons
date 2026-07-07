/**
 * Asset manifest — identity → immutable card face (Decision 5: faces are finished images
 * the client only DISPLAYS; there is no compositing, no text overlay, ever).
 *
 * The faces live in conversion_cartes/cartes_webp/cartes_finales/*.webp (plain git files)
 * and are bundled from there via import.meta.glob — NOT copied. If a face is missing or
 * fails to load, <img> errors and CardImage falls back to a typographic tile.
 *
 * Derived UI art (NOT cards): the 12 god heads cropped from the pense-bête, used as
 * avatars in the frieze / pense-bête header / declaration picker.
 */
import type { ActionSubtype, Axe, AxeValeur, GodId, QuestionCard } from '@pantheons/engine';

const faces = import.meta.glob('../../conversion_cartes/cartes_webp/cartes_finales/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const portraits = import.meta.glob('./ui-art/gods/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const penseBete = import.meta.glob('../../conversion_cartes/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** The printed pense-bête sheet — shown in the in-game help. */
export function penseBeteSrc(): string {
  return Object.values(penseBete)[0] ?? '';
}

function face(name: string): string {
  return faces[`../../conversion_cartes/cartes_webp/cartes_finales/${name}.webp`] ?? '';
}

/** Personnage card face (the full, final card image). */
export function godCardSrc(id: GodId): string {
  return face(`card_personnages_${id}`);
}

/** Derived pense-bête head crop — UI avatar, not a card. */
export function godPortraitSrc(id: GodId): string {
  return portraits[`./ui-art/gods/${id}.png`] ?? '';
}

/** The asset filename says `indou`; the canonical enum stays `hindou` (card-catalog.md §2). */
const ATTR_FILE: Record<string, string> = {
  masculin: 'card_attributs_masculin',
  feminin: 'card_attributs_feminin',
  bleus: 'card_attributs_bleus',
  verts: 'card_attributs_verts',
  rouges: 'card_attributs_rouges',
  hindou: 'card_attributs_indou',
  grec: 'card_attributs_grec',
  egyptien: 'card_attributs_egyptien',
  nordique: 'card_attributs_nordique',
};

export function attributCardSrc(valeur: AxeValeur): string {
  return face(ATTR_FILE[valeur] ?? '');
}

/** Action faces are keyed on the effectKey (action_non_3 → card_actions_non_3.webp). */
export function actionCardSrc(effectKey: string): string {
  return face(`card_${effectKey.replace(/^action_/, 'actions_')}`);
}

export function pouvoirCardSrc(effectKey: string): string {
  return face(`card_pouvoirs_${effectKey}`);
}

export function questionCardSrc(card: QuestionCard): string {
  return card.type === 'attribut' ? attributCardSrc(card.valeur) : actionCardSrc(card.effectKey);
}

export function cardBackSrc(type: 'personnages' | 'attributs' | 'actions' | 'pouvoirs'): string {
  return face(`card_${type}_verso`);
}

/** FR display labels for the fallback tile when a face fails to load (chrome, not card copy). */
export const AXE_LABEL: Record<Axe, string> = {
  genre: 'Genre',
  couleurYeux: 'Yeux',
  pantheon: 'Panthéon',
};

export const VALEUR_LABEL: Record<string, string> = {
  masculin: 'Masculin',
  feminin: 'Féminin',
  bleus: 'Yeux bleus',
  verts: 'Yeux verts',
  rouges: 'Yeux rouges',
  hindou: 'Hindou',
  grec: 'Grec',
  egyptien: 'Égyptien',
  nordique: 'Nordique',
};

export const SUBTYPE_LABEL: Record<ActionSubtype, string> = {
  non: 'Action · Non',
  multiple: 'Action · Multiple',
  speciale: 'Action · Spéciale',
};
