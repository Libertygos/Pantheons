# Panthéons — Modèle d'état serveur (game-state-model.md)

> **Authority:** l'état serveur fait autorité (server-authoritative). Ce document définit
> le cycle de vie de la room, la **barrière** de phases simultanées, l'état secret par
> joueur, la **projection par joueur** (frontière never-send), le modèle de plateau, et la
> résolution de déclaration/score. Mirroir de la forme du driver WoG ; incorpore le modèle
> barrière/déconnexion/reconnexion de WoG. Mis à jour #1839 (règles du 2026-11-07).

## Principes

1. **Server-authoritative.** Le serveur détient la vérité complète. Les clients n'envoient
   que des **intentions** ; le serveur valide et applique.
2. **Never-send / hidden-information.** Le dieu secret et la main d'un joueur ne sont
   **jamais** sérialisés vers un autre joueur (les pouvoirs sont publics, #1833). La
   sérialisation de l'état passe **obligatoirement** par la **projection par joueur**
   (§Projection) ; celle des événements par `redactEvent` (une copie par siège). C'est la
   propriété de sécurité n°1.
3. **Rien de ce que le client envoie ne fait foi** (#1839) : l'acteur vient de la connexion,
   la carte est relue côté serveur par son identifiant dans la main du joueur, une seule
   validation par joueur et par phase.
4. **Pense-bête exclu de l'état.** Il est **client-only**, jamais reçu, jamais stocké,
   jamais dans la projection.

## Cycle de vie de la room

```
lobby → (min 4, max 7, start) → enCours → terminee
                                   │
                                   └─(pause déclaration)→ resolutionDeclaration → enCours | terminee
```

- **lobby** — joueurs rejoignent via handoff vérifié ; démarrage bloqué < 4, plafonné à 7.
- **enCours** — boucle de tours ; chaque tour = 3 phases barrières.
- **resolutionDeclaration** — pause suite à ≥1 « Panthéons ».
- **terminee** — un déclarant a réussi, ou fin par élimination.

## État serveur (vérité complète — jamais sérialisé tel quel)

```ts
GameState {
  roomId: string
  status: 'lobby' | 'enCours' | 'resolutionDeclaration' | 'terminee'
  players: Record<UserId, PlayerState>   // clé = platform user_id
  seatOrder: UserId[]                     // ordre horaire fixe des sièges
  meneurIndex: number                     // index dans seatOrder ; +1 horaire/tour
  tour: number
  phase: 'pioche' | 'question' | 'reponse'
  barrier: BarrierState                   // §Barrière
  drawPiles: { attributs: CardId[]; actions: CardId[]; pouvoirs: CardId[] }
  discard: { attributs: CardId[]; actions: CardId[]; pouvoirs: CardId[] }
  boardBySeat: Record<UserId, Board>      // emplacements posés (contenu face cachée, voir Projection)
  declarations: Declaration[]             // déclarations « Panthéons » de la fenêtre courante (SECRET)
  winner: UserId | null
  eliminated: UserId[]
  undealtGods: GodId[]                    // SECRET, jamais projeté (Déduction, unicast au détenteur)
  shuffleSeed / reshuffleCount            // SECRET : graine des reformations de pioche, jamais projetée
  specialePending / specialesShown        // Spéciale en attente d'un choix (propriétaire) / montrées à tous
  sabotageWindow                          // fenêtre de Sabotage (30 s)
  reponseProgress                         // résolution de la Réponse en pause (Exécution, don du Non 1-2)
}

PlayerState {
  userId: UserId
  displayName: string
  connected: boolean
  god: GodId              // SECRET — never-send
  hand: {                 // SECRET — never-send
    attributs: CardId[]
    actions: CardId[]
  }
  powers: CardId[]        // PUBLIC (#1833) : face visible pour tous
  alive: boolean
}

Board {
  questionSlots: PlacedCard[][]         // une pile par adversaire ; carte posée FACE CACHÉE pour les tiers
  specialSlot: PlacedCard | null
}
```

## Barrière de phases simultanées

Les trois phases se déroulent simultanément. Le serveur **n'avance pas** tant que chaque
joueur **vivant et connecté** n'a pas soumis son action de la phase courante.

```ts
BarrierState {
  phase: Phase
  submitted: UserId[]          // joueurs ayant validé cette phase (une seule validation, #1839)
  deadline: number | null      // fenêtre de déclaration (30 s, #1834) ; null ailleurs
}
```

Transition : `submitted ⊇ joueursVivantsConnectés` ⇒ **résoudre la phase** (appliquer tous
les effets simultanés de façon déterministe, ordre = seatOrder à partir du meneur pour la
Réponse), puis passer à la phase suivante ; après Réponse, ouvrir la **fenêtre de
déclaration**, puis avancer le meneur et incrémenter le tour.

> **Déconnexion** : la barrière ne compte que les joueurs vivants **et connectés** ; un
> déconnecté est passé automatiquement (choix en attente pris par défaut). Seuls deux
> minuteurs existent : la fenêtre de déclaration et la fenêtre de Sabotage, 30 s chacune
> (#1834). Implémentation : `server/src/rooms/barrier.ts`.
>
> **Une seule validation par joueur et par phase** (#1839) : toute seconde soumission
> (pioche, question, déclaration, passe de Sabotage) est refusée. La phase Question est
> **atomique** : questions et Spéciale sont validées ensemble avant que rien ne soit posé ;
> un refus laisse tout en main.

## Projection par joueur (frontière never-send)

Toute sérialisation vers le client `viewer` passe par `project(state, viewer)`. Règle : le
viewer voit **la totalité de son propre état secret** et **rien du secret des autres**.

Ce qui reste **public** (visible par tous) : statut/phase/tour/meneur, ordre des sièges,
noms & connexion des joueurs, **pouvoirs** (face visible), occupation des emplacements et
**famille** (dos Attribut / Action) des cartes posées, résultat oui/non, tailles des piles,
tailles de main des adversaires, Spéciales déclenchées, qui a validé la phase, fenêtres de
déclaration et de Sabotage (échéance), vainqueur et éliminés.

Ce qui est **projeté secret** : `god` et `hand` (contenu) seulement pour `viewer === owner` ;
le **contenu d'une question posée** pour son poseur (ou le joueur qui l'a reprise par
Spéciale 4) et pour l'interrogé une fois sa réponse résolue ; le contenu de la Spéciale posée
pour son propriétaire ; les choix en attente (Exécution, don du Non, Spéciales 2/4/7/8)
pour leur seul propriétaire. **Jamais projetés** : dieux non distribués, graines de mélange,
suppositions des déclarants, `reponseProgress`. À la fin de la partie (`terminee`), tous les
dieux sont révélés (#1837).

### Événements (canal `event`) — copie filtrée par siège (#1839)

Le serveur n'émet jamais l'événement interne tel quel : `redactEvent(e, viewer)`
(`server/src/rooms/events.ts`) en construit une copie par siège.
- `reponseResolved` : pour chaque réponse, emplacement, cible, famille et oui/non ; l'id de
  carte seulement pour son poseur, son repreneur (Spéciale 4) et l'interrogé.
- `declarationResolved` : par déclarant, seulement victoire / élimination. Ni suppositions
  ni détail juste/faux, pour aucun siège, le déclarant compris.
- Révélations privées (Déduction, Espionnage, Spéciale 1) : message `reveal` en unicast.

Invariant testable : `∀ viewer, god ≠ viewer ⇒ projection ne contient AUCUN GodId/CardId
secret d'un autre joueur`. Test de non-régression obligatoire (`projection.test.ts`).

## Intégrité des réponses

Le serveur connaît le dieu secret de chaque joueur ; il **calcule** la réponse véridique
(`evaluateQuestion(god, card)`). Le joueur ne « déclare » pas oui/non : la vérité est
serveur-calculée.
Cela ferme la triche par mensonge tout en gardant le never-send (les autres n'apprennent
que le oui/non publié, pas le dieu).

## Résolution « Panthéons »

`declarations` collecte les déclarations de la fenêtre courante. Résolution **horaire à
partir du meneur** :

```
pour chaque déclarant d (ordre horaire depuis meneur) :
  guesses = { adversaireVivant → GodId supposé }
  si ∀ adversaire vivant : guesses[adv] === state.players[adv].god :
      winner = d ; status = 'terminee' ; STOP
  sinon (première erreur) :
      d.alive = false ; eliminated.push(d) ; sa carte reste cachée
si aucun gagnant : status = 'enCours' ; le jeu reprend
```

La résolution est **`[OPUS 🔒]`** (révélation d'information cachée = propriété de sécurité
sommitale). Fichier : `packages/engine/src/declaration.ts`. Ne révèle le dieu d'un éliminé
**pas** (« carte reste cachée »).

## Contrats tenant (rappel — Décision 4)

- **Handoff verify** : alg `["HS256"]`, `iss==="gosgames"`, **`aud==="pantheons"`**,
  `exp`/`iat` skew ≤ 5s, `access===true` exact. Token lu du **fragment d'URL**, effacé
  immédiatement, échangé contre la **S-JWT de session** propre au jeu. Fichier :
  `server/src/auth/handoff.ts` **`[OPUS 🔒]`**.
- **Clé `user_id`** : toutes les données joueur clées par platform `user_id` ; **ligne
  locale créée paresseusement** à la première entrée. `server/src/db/schema.ts`.
- **Deletion** : `DELETE /internal/users/:id`, cluster-internal, `Bearer
  <INTERNAL_SERVICE_TOKEN>` **comparé en temps constant**, **idempotent** (inconnu/déjà
  supprimé → `200 "deleted"`, jamais `404`). Cascade = `DELETE … WHERE user_id=$1`.
  `server/src/routes/deletion.ts` **`[OPUS]`**.

## Reconnexion

Identique à WoG (règle commune gosgames). `onLeave(consented=false)` → `connected=false`, le
siège est gardé ; au retour, le client est réamorcé par une projection fraîche de **son**
siège uniquement (`RECONNECT_OK`). La barrière ignore les joueurs déconnectés ; deux
déconnexions simultanées interrompent la partie.
