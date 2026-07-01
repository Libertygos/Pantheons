# Panthéons — Modèle d'état serveur (game-state-model.md)

> **Authority:** l'état serveur fait autorité (server-authoritative). Ce document définit
> le cycle de vie de la room, la **barrière** de phases simultanées, l'état secret par
> joueur, la **projection par joueur** (frontière never-send), le modèle de plateau, et la
> résolution de déclaration/score. Mirroir de la forme du driver WoG ; incorpore le modèle
> barrière/déconnexion/reconnexion de WoG **une fois collé** (`⟨INPUT: WoG room model⟩`).

## Principes

1. **Server-authoritative.** Le serveur détient la vérité complète. Les clients n'envoient
   que des **intentions** ; le serveur valide et applique.
2. **Never-send / hidden-information.** Le dieu secret, la main et les pouvoirs d'un joueur
   ne sont **jamais** sérialisés vers un autre joueur. La sérialisation passe **obligatoirement**
   par la **projection par joueur** (§Projection). C'est la propriété de sécurité n°1.
3. **Pense-bête exclu de l'état.** Il est **client-only**, jamais reçu, jamais stocké,
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
  boardBySeat: Record<UserId, Board>      // emplacements posés (public : cartes posées visibles)
  pendingAnswers: AnsweredQuestion[]      // questions posées attendant réponse
  declarations: Declaration[]             // déclarations « Panthéons » de la fenêtre courante
  winner: UserId | null
  eliminated: UserId[]
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
  powers: CardId[]        // SECRET (contenu) — never-send ; le *nombre* peut être public
  alive: boolean
  hasSpecialSlotCard: CardId | null   // posé = public
}

Board {
  questionSlots: (PlacedCard | null)[]  // index 0..5 → adversaires ; carte posée = publique
  specialSlot: PlacedCard | null
}
```

## Barrière de phases simultanées

Les trois phases se déroulent simultanément. Le serveur **n'avance pas** tant que chaque
joueur **vivant et connecté** n'a pas soumis son action de la phase courante.

```ts
BarrierState {
  phase: Phase
  submitted: Set<UserId>       // joueurs ayant soumis cette phase
  deadline: number | null      // ⟨INPUT WoG⟩ : timeout de phase
}
```

Transition : `submitted ⊇ joueursVivantsConnectés` ⇒ **résoudre la phase** (appliquer tous
les effets simultanés de façon déterministe, ordre = seatOrder à partir du meneur pour la
Réponse), puis passer à la phase suivante ; après Réponse, ouvrir la **fenêtre de
déclaration**, puis avancer le meneur et incrémenter le tour.

> **`⟨INPUT: WoG room model⟩`** — le comportement de stall/déconnexion pendant une phase
> (block-until-timeout vs auto-résolution) **défère au modèle barrière WoG**. Point
> d'intégration : `deadline` + politique de résolution dans `resolvePhase()`. Les stubs
> présents (`server/src/rooms/barrier.ts`) implémentent le cas nominal « attendre tous les
> vivants connectés » ; brancher la politique de timeout WoG ici.

## Projection par joueur (frontière never-send)

Toute sérialisation vers le client `viewer` passe par `project(state, viewer)`. Règle : le
viewer voit **la totalité de son propre état secret** et **rien du secret des autres**.

Ce qui reste **public** (visible par tous) : statut/phase/tour/meneur, ordre des sièges,
noms & connexion des joueurs, **cartes posées sur les plateaux** (une question posée est
publique), tailles des piles/défausses, tailles de main des adversaires, nombre de pouvoirs,
résultats de réponse publiés (oui/non par carte posée), état de la fenêtre de déclaration.

Ce qui est **projeté secret** (seulement pour `viewer === owner`) : `god`, `hand`
(contenu), `powers` (contenu), miniatures de déclaration avant révélation.

Invariant testable : `∀ viewer, god ≠ viewer ⇒ projection ne contient AUCUN GodId/CardId
secret d'un autre joueur`. Test de non-régression obligatoire (`projection.test.ts`).

## Intégrité des réponses

Le serveur connaît le dieu secret de chaque joueur ; il **calcule** la réponse véridique
(`evaluateQuestion(god, card)`) et **rejette** toute soumission de réponse divergente. Le
joueur ne « déclare » pas oui/non librement — il confirme ; la vérité est serveur-calculée.
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

## Mirroir WoG / reconnexion

Reconnexion **requise, identique à WoG**, à **copier depuis Claude Code inter-repos** au
moment de l'implémentation (`⟨INPUT⟩`). Point d'intégration : `onLeave(consented=false)` →
marquer `connected=false`, garder le siège ; `onJoin` d'un `user_id` connu → réhydrater et
reprojeter. La barrière ignore les joueurs déconnectés selon la politique WoG.
