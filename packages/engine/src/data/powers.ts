/**
 * Pouvoirs catalogue (T-07) — TRANSCRIBED from the card faces on 2026-07-07
 * (docs/card-catalog.md §4, verbatim texts; erratas §7 : le fichier `optimisse` titre
 * « OPTIMISME » ; « Quand on vous répond oui » d'Exécution lu « quand vous répondez oui »).
 *
 * The registry is metadata + the passive/active split; the game-flow integration lives in
 * rules.ts (draw modifiers in applyPioche, question caps in applyQuestions, Exécution in
 * resolveReponsePhase, activations in activatePower, Âmes sœurs in declaration.ts).
 */

export type PowerKind =
  /** Silently modifies pioche/question/réponse/déclaration rules while held. */
  | 'passif'
  /** Requires an explicit activation intent (choices) — see rules.ts activatePower. */
  | 'active';

export interface PowerDef {
  effectKey: string;
  /** FR display label (face spelling authoritative). */
  label: string;
  /** Verbatim effect text from the face (documentation + fallback tile). */
  texte: string;
  kind: PowerKind;
  /** Activation needs the « aucun oui au tour précédent » condition. */
  needsNoOuiLastTurn?: boolean;
}

export const POWERS: Record<string, PowerDef> = {
  sabotage: {
    effectKey: 'sabotage', label: 'Sabotage', kind: 'active',
    texte: '« Si un joueur a reçu trois questions ou plus ce tour-ci, choisissez une carte attribut posée et défaussez la (une fois par tour). »',
  },
  clonage: {
    effectKey: 'clonage', label: 'Clonage', kind: 'active',
    texte: '« Choisissez le pouvoir d’un autre joueur. Clonage devient une copie de ce pouvoir. Si le pouvoir copié est déffaussé, choisissez-en un autre. »',
  },
  etude: {
    effectKey: 'etude', label: 'Étude', kind: 'passif',
    texte: '« Pendant la phase de pioche, piochez une carte attribut et une carte action. »',
  },
  concentration: {
    effectKey: 'concentration', label: 'Concentration', kind: 'passif',
    texte: '« Vous pouvez poser deux questions au même joueur. »',
  },
  refus_royal: {
    effectKey: 'refus_royal', label: 'Refus royal', kind: 'active', needsNoOuiLastTurn: true,
    texte: '« Si vous n’avez eu aucun oui au tour précédent, choisissez un joueur qui vous a répondu non. Il ne posera pas de questions à ce tour. »',
  },
  connaissance: {
    effectKey: 'connaissance', label: 'Connaissance', kind: 'passif',
    texte: '« Vous pouvez poser trois questions par tour. »',
  },
  execution: {
    effectKey: 'execution', label: 'Exécution', kind: 'active',
    texte: '« Quand on vous répond oui, vous pouvez choisir de ne pas piocher de carte action. A la place, vous pouvez défausser le pouvoir d’un joueur. »',
  },
  ames_soeurs_1: {
    effectKey: 'ames_soeurs_1', label: 'Âmes soeurs', kind: 'passif',
    texte: '« Quand vous réalisez votre Panthéon, si un autre joueur possède le pouvoir de l’âme soeur, vous n’avez pas à deviner sa carte personnage. »',
  },
  ames_soeurs_2: {
    effectKey: 'ames_soeurs_2', label: 'Âmes soeurs', kind: 'passif',
    texte: '« Quand vous réalisez votre Panthéon, si un autre joueur possède le pouvoir de l’âme soeur, vous n’avez pas à deviner sa carte personnage. »',
  },
  deduction: {
    effectKey: 'deduction', label: 'Déduction', kind: 'active', needsNoOuiLastTurn: true,
    texte: '« Si vous n’avez eu aucun oui au tour précédent, regardez une carte personnage qui n’a pas été piochée. »',
  },
  optimisse: {
    // Fichier `optimisse`, face « OPTIMISME » — libellé face, clé technique figée (E4).
    effectKey: 'optimisse', label: 'Optimisme', kind: 'passif', needsNoOuiLastTurn: true,
    texte: '« Si vous n’avez eu aucun oui au tour précédent, piochez trois cartes attributs au lieu de deux pendant votre phase de pioche. »',
  },
  espionnage: {
    effectKey: 'espionnage', label: 'Espionnage', kind: 'active', needsNoOuiLastTurn: true,
    texte: '« Si vous n’avez eu aucun oui au tour précédent, vous pouvez regarder une question posée par un autre joueur. »',
  },
};

export const POWER_KEYS = Object.keys(POWERS);
export const AMES_SOEURS_KEYS = ['ames_soeurs_1', 'ames_soeurs_2'];

export function getPower(effectKey: string): PowerDef | undefined {
  return POWERS[effectKey];
}
