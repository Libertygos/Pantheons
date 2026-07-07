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

  landing: {
    welcome: (name: string) => `Bienvenue, ${name}.`,
    create: 'Créer un salon',
    joinTitle: 'Rejoindre avec un code',
    codePlaceholder: 'CODE',
    join: 'Rejoindre',
    version: (v: string) => `version ${v}`,
  },

  room: {
    notFound: 'Salon introuvable.',
    inProgress: 'Partie en cours — impossible de rejoindre.',
    sessionExpired: 'Session expirée — votre siège a été libéré.',
    aborted: 'Partie interrompue : plusieurs joueurs déconnectés.',
    duplicateTitle: 'Déjà ouvert ailleurs',
    duplicateBody: 'Ce salon est déjà ouvert dans un autre onglet ou appareil.',
    errors: {
      BAD_CODE: 'Code invalide.',
      ROOM_FULL: 'Salon complet.',
      ROOM_IN_PROGRESS: 'Partie en cours — impossible de rejoindre.',
      ALREADY_IN_ROOM: 'Déjà présent dans ce salon (autre onglet ?).',
      UNAUTHORIZED: 'Authentification refusée. Revenez au portail gosgames.',
      TIMEOUT: 'Le serveur ne répond pas.',
    } as Record<string, string>,
  },

  lobby: {
    title: 'Salon',
    players: 'Joueurs',
    waiting: (n: number, min: number) => `En attente de joueurs (${n}/${min} minimum)`,
    start: 'Démarrer la partie',
    needMore: (min: number) => `Il faut au moins ${min} joueurs.`,
    full: (max: number) => `Salon complet (${max}).`,
    code: 'Code du salon',
    copyInvite: 'Copier le lien d’invitation',
    copied: 'Copié !',
    seatEmpty: 'Siège libre',
    ready: 'Prêt',
    notReady: 'Pas prêt',
    imReady: 'Je suis prêt',
    cancelReady: 'Annuler',
    addSeat: 'Ajouter un siège',
    removeSeat: 'Retirer un siège',
    host: 'Hôte',
    leave: 'Quitter le salon',
    disconnectedSeat: 'Déconnecté…',
    startHint: 'Tous les sièges doivent être occupés, prêts et connectés.',
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
