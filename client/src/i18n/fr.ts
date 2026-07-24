/**
 * FR chrome strings (Decision 7: French only, no EN source, no runtime toggle). God /
 * attribute / pantheon spellings are NOT here — they come verbatim from the assets/engine.
 * This file is chrome only: lobby, phases, buttons, the "Panthéons!" flow, errors.
 */
export const fr = {
  appTitle: 'Panthéons',
  appTagline: 'Un jeu de déduction : découvrez quel dieu se cache derrière chaque joueur.',

  nav: {
    backToPortal: 'Retour à gosgames (nouvel onglet)',
    account: 'Compte gosgames (nouvel onglet)',
    signOut: 'Déconnexion',
  },

  connecting: 'Connexion…',
  handoffFailed: 'Authentification refusée. Revenez au portail gosgames.',
  disconnected: 'Connexion perdue. Tentative de reconnexion…',

  landing: {
    welcome: (name: string) => `Bienvenue, ${name}.`,
    create: 'Créer un salon',
    joinTitle: 'Rejoindre avec un code',
    codeChar: (i: number, n: number) => `Caractère ${i} sur ${n} du code`,
    join: 'Rejoindre',
    version: (v: string) => `version ${v}`,
    fanAria: 'Les douze dieux du jeu',
    reglesAria: 'Comment on joue',
    reglesTitre: 'Un tour, trois temps — tous en même temps',
    regles: {
      pioche: 'Assurez-vous d’avoir exactement un pouvoir, puis piochez deux cartes Attribut.',
      question:
        'Posez jusqu’à deux questions — jamais deux au même joueur. Chaque carte posée interroge le dieu secret d’un adversaire.',
      reponse:
        'Chacun répond oui ou non, sans mentir. Sûr de vous ? Déclarez « Panthéons » et nommez le dieu de chacun. Tout juste : vous gagnez. Une erreur : vous êtes éliminé.',
    },
    axesAria: 'Les trois axes de déduction',
  },

  room: {
    notFound: 'Salon introuvable.',
    inProgress: 'Partie en cours — impossible de rejoindre.',
    sessionExpired: 'Session expirée — votre siège a été libéré.',
    aborted: 'Partie interrompue : plusieurs joueurs déconnectés.',
    duplicateTitle: 'Déjà ouvert ailleurs',
    duplicateBody: 'Ce salon est déjà ouvert dans un autre onglet ou appareil.',
    // Fin de session imposée : reprise du compte sur un autre appareil (409 superseded)
    // ou clôture demandée par la plateforme (login_all_games.md §D).
    sessionEndedTitle: 'Session terminée',
    sessionEndedBody:
      'Vous avez commencé à jouer sur un autre appareil. Cette session a été fermée.',
    sessionEndedAction: 'Retour à gosgames',
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
    readyToStart: 'Tout le monde est prêt — l’hôte peut lancer la partie.',
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
    pioche: 'Régularisez votre pouvoir puis piochez vos attributs.',
    question: 'Posez vos questions — votre pouvoir peut en changer les limites.',
    reponse: 'Réponses en cours — déclarez « Panthéons » ou passez.',
  },

  meneur: 'Meneur',
  tour: 'Tour',
  yourGod: 'Votre dieu',
  oui: 'Oui',
  non: 'Non',
  pass: 'Passer',
  submit: 'Valider',

  jeu: {
    emplacementSpecial: 'Spéciale',
    attributs: 'Attributs',
    actions: 'Actions',
    pouvoir: 'Pouvoir',
    maMain: 'Ma main',
    mainVidePioche: 'Votre main est vide — validez la pioche pour recevoir 2 cartes Attribut.',
    mainVideAttente: 'Vos 2 cartes Attribut arrivent dès que toute la table a validé.',
    mainVide: 'Aucune carte en main.',
    monDieuHint: 'maintenir pour révéler',
    contreVous: 'Contre vous',
    emplacementVide: 'Emplacement vide',
    poseePar: (nom: string) => `posée par ${nom}`,
    aValider: 'à valider',
    cartesRestantes: (n: number) => `${n} carte${n > 1 ? 's' : ''} restante${n > 1 ? 's' : ''}`,
    statCourt: { attributs: 'Att', actions: 'Act', pouvoirs: 'Pouv', speciale: 'Spé' },
    statLong: {
      attributs: (n: number) => `${n} carte${n > 1 ? 's' : ''} Attribut en main`,
      actions: (n: number) => `${n} carte${n > 1 ? 's' : ''} Action en main`,
      pouvoirs: (n: number) => `${n} pouvoir${n > 1 ? 's' : ''}`,
      speciale: 'Une Spéciale est posée sur son emplacement',
    },
    aide: 'Aide',
    quitter: 'Quitter',
    elimine: 'Éliminé',
    vous: 'vous',
    poserIci: 'Poser ici',
    cible: 'Ciblé',
    faceCachee: 'Face cachée',
    utiliser: 'Utiliser',
    annulerPouvoir: 'Annuler',
    choisirCiblePouvoir: (pouvoir: string) => `${pouvoir} — choisissez un adversaire.`,
    choisirCartePosee: (pouvoir: string) =>
      `${pouvoir} — cliquez une carte posée sur la table.`,
    refusRoyalBloque: 'Refus royal : vous ne posez pas de questions à ce tour.',
    specialeCible: (nom: string) => `Spéciale → ${nom}`,
    choisirCibleSpeciale: 'Cette Spéciale vise un joueur : cliquez un adversaire pour la poser.',
    pouvoirActive: (nom: string, pouvoir: string) => `${nom} a activé ${pouvoir}.`,
    revelePersonnageDe: (nom: string, dieu: string) => `Révélation : ${nom} est ${dieu}.`,
    revelePersonnagePioche: (dieu: string) => `Carte personnage non piochée vue : ${dieu}.`,
    reveleQuestion: (nom: string, q: string) => `Question de ${nom} espionnée : ${q}.`,
  },

  consignes: {
    piochePret: 'Phase de pioche — validez pour recevoir vos 2 cartes Attribut.',
    piocheDefausse: 'Vous détenez deux pouvoirs : défaussez-en un pour valider la pioche.',
    question:
      'Choisissez une carte en main, puis un adversaire — jusqu’à 2 questions, jamais deux au même joueur.',
    questionSpeciale: 'Cette Spéciale se pose sur votre emplacement dédié, pas sur un adversaire.',
    reponse: 'Les réponses sont affichées sur les plateaux. Déclarez « Panthéons » — ou passez.',
    validerPioche: 'Valider la pioche',
    validerQuestions: (n: number) =>
      n === 0 ? 'Passer sans question' : `Valider ${n} question${n > 1 ? 's' : ''}`,
    poserSpeciale: 'Poser sur l’emplacement spécial',
    retirer: 'Retirer',
  },

  /** États « action de phase envoyée / confirmée » (QoL §4). */
  fait: {
    valide: 'Validé',
    passe: 'Passé',
    pioche: 'Pioche validée',
    questions: (n?: number) =>
      n === undefined
        ? 'Questions validées'
        : n === 0
          ? 'Tour passé sans question'
          : `${n} question${n > 1 ? 's' : ''} validée${n > 1 ? 's' : ''}`,
    reponsePassee: 'Vous avez passé',
    declaration: 'Déclaration envoyée',
    enAttenteDe: (noms: string) => `en attente de ${noms}…`,
  },

  declaration: {
    button: 'Déclarer « Panthéons »',
    title: 'Déclaration « Panthéons »',
    instruction:
      'Nommez le dieu de chaque adversaire vivant. Tout juste : vous gagnez. Une seule erreur : vous êtes éliminé et votre dieu reste caché.',
    aChoisir: 'à choisir',
    confirm: 'Je déclare « Panthéons »',
    cancel: 'Annuler',
    eliminated: (nom: string) =>
      `${nom} a déclaré « Panthéons » et s’est trompé — éliminé, son dieu reste caché.`,
  },

  aide: {
    titre: 'Rappel des règles',
    fermer: 'Fermer',
    corps: [
      'Chaque joueur incarne en secret l’un des 12 dieux, défini par trois attributs : genre, couleur des yeux, panthéon.',
      'Un tour = trois phases simultanées. Pioche : exactement un pouvoir, puis 2 attributs. Question : jusqu’à 2 cartes posées sur des adversaires différents. Réponse : chacun répond oui/non, sans mentir.',
      'Tout « oui » fait piocher une carte Action au joueur interrogé. Les effets « Non » se déclenchent sur un non.',
      'Après une phase Réponse, déclarez « Panthéons » : nommez le dieu de chacun. Tout juste, vous gagnez ; une erreur, vous êtes éliminé.',
    ],
  },

  /** Aide contextuelle : un « ? » par zone de la table (même dispositif que les autres jeux). */
  aideZones: {
    bouton: 'Aide',
    zones: {
      sieges: {
        titre: 'Les sièges adverses',
        corps: [
          'Chaque plaque est un adversaire : son nom, le badge Meneur, sa coche « prêt » et le nombre de dieux encore possibles d’après votre pense-bête.',
          'Sous la plaque : les questions qu’il a reçues ce tour — de tous les joueurs — avec la réponse publique (✓ oui / ✗ non) une fois donnée.',
          'Phase Question : choisissez une carte en main puis cliquez un siège pour la lui poser — jusqu’à 2 questions, jamais deux au même joueur (certains pouvoirs changent ces limites).',
          'Chaque « oui » fait piocher une carte Action au joueur interrogé. Un éliminé garde son dieu caché jusqu’au bout.',
        ],
      },
      table: {
        titre: 'La table : pioches et phases',
        corps: [
          'La pioche Attributs fournit vos 2 cartes de chaque phase Pioche ; la pioche Actions alimente les joueurs qui répondent « oui » à une question.',
          'Le traqueur au-dessus montre la phase en cours (Pioche → Question → Réponse), la consigne du moment et qui a déjà validé.',
          'Les trois phases sont simultanées : tout le monde joue en même temps, et la table avance quand chaque joueur a validé.',
        ],
      },
      dieu: {
        titre: 'Votre dieu',
        corps: [
          'Votre identité secrète : l’un des 12 dieux, défini par trois attributs — genre, couleur des yeux, panthéon.',
          'Maintenez la carte (doigt, souris, ou Espace/Entrée) pour la révéler en grand. Personne d’autre ne la voit — même si vous êtes éliminé.',
        ],
      },
      main: {
        titre: 'Ma main',
        corps: [
          'Vos cartes Attribut et Action. En phase Question, sélectionnez-en une puis cliquez un adversaire pour la poser.',
          'Les Attributs interrogent le dieu (genre, yeux, panthéon). Les Actions déclenchent leur effet sur un « oui » ou sur un « non » ; les Spéciales se posent sur votre emplacement dédié — ou visent un joueur.',
          'Jusqu’à 2 questions par tour, jamais deux au même joueur (sauf pouvoir). Cliquez une carte posée pour la reprendre avant de valider.',
        ],
      },
      contreVous: {
        titre: 'Contre vous',
        corps: [
          'Les questions posées contre vous ce tour. Vous y répondez automatiquement, sans mentir : la réponse (oui/non) devient publique sur la table.',
          'Chaque « oui » vous fait piocher une carte Action — l’effet peut jouer pour ou contre vous.',
          'L’emplacement Spéciale accueille vos cartes Spéciales sans cible, le temps de leur effet.',
        ],
      },
      pouvoir: {
        titre: 'Votre pouvoir',
        corps: [
          'Vous détenez exactement un pouvoir après la pioche — deux en main, il faut en défausser un.',
          'Un pouvoir passif s’applique tout seul ; un pouvoir actif s’active avec « Utiliser » puis, selon le cas, une cible (adversaire ou carte posée).',
          'Chaque pouvoir tord une règle : limites de questions, espionnage, sabotage… Sa carte en détaille l’effet — la loupe l’agrandit.',
        ],
      },
    },
  },

  penseBete: {
    title: 'Pense-bête',
    note: 'Vos notes personnelles — jamais partagées, jamais envoyées.',
    ouvrir: 'Ouvrir le pense-bête',
    fermer: 'Fermer le pense-bête',
    reponses: 'Réponses',
    aucuneReponse: 'Aucune réponse ce tour',
    nouvellesReponses: (n: number) =>
      n > 1 ? `${n} nouvelles réponses` : `${n} nouvelle réponse`,
    restants: (n: number) => `${n} possibles`,
    etats: { inconnu: 'inconnu', exclu: 'exclu', suspect: 'retenu' } as Record<string, string>,
    axes: { genre: 'Genre', couleurYeux: 'Yeux', pantheon: 'Panthéon' },
  },

  fin: {
    titre: 'Panthéons',
    vainqueur: (nom: string) => `${nom} a percé tous les secrets et remporte la partie.`,
    vainqueurVous: 'Vous avez percé tous les secrets — victoire !',
    retour: 'Retour à l’accueil',
  },

  gameOver: (winner: string) => `Partie terminée — vainqueur : ${winner}.`,
} as const;
