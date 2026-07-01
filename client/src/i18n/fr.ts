/**
 * FR chrome strings (Decision 7: French only, no EN source, no runtime toggle). God /
 * attribute / pantheon spellings are NOT here — they come verbatim from the assets/engine.
 * This file is chrome only: lobby, phases, buttons, the "Panthéons!" flow, errors.
 */
export const fr = {
  appTitle: 'Panthéons',
  appTagline: 'Un jeu de déduction : découvrez quel dieu se cache derrière chaque joueur.',

  connecting: 'Connexion…',
  handoffFailed: 'Authentification refusée. Revenez au portail gosgames.',
  disconnected: 'Connexion perdue. Tentative de reconnexion…',

  lobby: {
    title: 'Salon',
    players: 'Joueurs',
    waiting: (n: number, min: number) => `En attente de joueurs (${n}/${min} minimum)`,
    start: 'Démarrer la partie',
    needMore: (min: number) => `Il faut au moins ${min} joueurs.`,
    full: (max: number) => `Salon complet (${max}).`,
  },

  phases: {
    pioche: 'Pioche',
    question: 'Question',
    reponse: 'Réponse',
  },
  phaseHint: {
    pioche: 'Régularisez votre pouvoir puis piochez 2 attributs.',
    question: 'Posez jusqu’à 2 questions (jamais deux au même joueur).',
    reponse: 'Réponses en cours — déclarez « Panthéons » ou passez.',
  },

  meneur: 'Meneur',
  tour: 'Tour',
  yourGod: 'Votre dieu',
  oui: 'Oui',
  non: 'Non',
  pass: 'Passer',
  submit: 'Valider',

  declaration: {
    button: 'Déclarer « Panthéons » !',
    title: 'Déclaration « Panthéons »',
    instruction: 'Devinez le dieu de chaque adversaire.',
    win: 'Toutes vos suppositions sont correctes — vous gagnez !',
    lose: 'Une erreur : vous êtes éliminé (votre dieu reste caché).',
  },

  penseBete: {
    title: 'Pense-bête',
    note: 'Vos notes personnelles — jamais partagées.',
    axes: { genre: 'Genre', couleurYeux: 'Yeux', pantheon: 'Panthéon' },
  },

  gameOver: (winner: string) => `Partie terminée — vainqueur : ${winner}.`,
} as const;
