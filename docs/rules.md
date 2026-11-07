# Panthéons — Règles (rules.md)

> **Authority:** derived from `pantheons-design-decisions.md` (ratified 2026-07-01) and
> the uploaded rulebook / pense-bête assets. This is the canonical ruleset in Pantheons'
> own terms. Vocabulary (god / attribute / pantheon / card names) is **fixed by the image
> assets, in French** — never invented or translated here. The card catalog and god table
> are transcribed in `docs/card-catalog.md`; values only readable on card faces not yet
> transcribed are marked **`⟨À_TRANSCRIRE⟩`**.

## 1. But du jeu

Panthéons est un jeu de **déduction à identité cachée** pour **4 à 7 joueurs**, **10 ans et plus**, **45 à 60 minutes**. Chaque
joueur reçoit secrètement l'un des **12 dieux**. Le but : **déduire quel dieu se cache
derrière chaque adversaire** tout en gardant le sien secret. La partie se joue jusqu'à une
unique révélation climactique — la déclaration **« Panthéons »**.

## 2. Les 12 dieux et les axes de déduction

Les 12 dieux sont répartis en **4 panthéons de 3 dieux** :

| Panthéon | Dieux |
|---|---|
| Hindou | Brahma, Ganesh, Sarasvati |
| Grec | Zeus, Athena, Artemis |
| Égyptien | Rê, Bastet, Isis |
| Nordique | Loki, Odin, Frigg |

Chaque dieu est défini par exactement **3 attributs**, qui forment **tout** l'espace de
déduction — toute question se résout contre eux :

1. **Genre** (`genre`) — `feminin | masculin`.
2. **Couleur des yeux** (`couleurYeux`) — `bleus | verts | rouges` (légende du pense-bête).
3. **Panthéon** (`pantheon`) — Hindou | Grec | Égyptien | Nordique.

> La table dieu → {genre, couleurYeux, pantheon} est **transcrite de l'image du
> pense-bête**, jamais inférée. Fichier canonique : `packages/engine/src/data/gods.ts`.

## 3. Mise en place

- On mélange les **12 cartes Personnage**, chaque joueur en reçoit **1 face cachée** :
  c'est son dieu secret. Les cartes non distribuées restent hors jeu, face cachée.
- Chaque joueur reçoit un **plateau** : 6 emplacements de question numérotés (adversaires
  1–7) + un **emplacement spécial**. Ce plateau physique est l'origine du plafond à
  **7 joueurs**.
- Chaque joueur reçoit un **pense-bête** (grille de déduction). Le pense-bête est un outil
  **strictement personnel et client-only** — il n'est jamais envoyé au serveur ni dans la
  projection (voir `game-state-model.md`).
- On désigne le premier **meneur**. Le meneur tourne dans le sens horaire à chaque tour.

## 4. Types de cartes

| Type | Nb | Rôle |
|---|---|---|
| **Personnage** | 12 | Le dieu secret d'un joueur (1 par joueur en jeu). |
| **Pouvoir** | 12 | Effet persistant/activable. Un joueur en détient **exactement 1** en régime établi. Identités dans `card-catalog.md` §4 ; effets `⟨À_TRANSCRIRE⟩`. |
| **Attribut** | 36 | Carte-question portant une valeur d'attribut (genre, couleur d'yeux, ou panthéon) — 9 faces distinctes × 4 exemplaires. |
| **Action** | 27 | Cartes jouées comme questions, sauf **Spéciale**. 9 par sous-type, 1 exemplaire chacune. |

### Sous-types Action

- **Non** — l'effet se déclenche quand la réponse est **« non »**.
- **Multiple** — question portant sur **4 dieux** à la fois.
- **Spéciale** — **seule carte non-question**. Occupe l'**emplacement spécial** dédié du
  plateau ; se déclenche **au début de la phase déclarée** sur la carte, puis est
  défaussée. Les Spéciales simultanées se déclenchent **à partir du meneur, dans le sens
  horaire**, et chacune est **montrée à tous les joueurs** à son déclenchement (#1835).
  Les choix se font **au déclenchement** (jamais au placement, jamais au hasard) :
  **2** : le joueur choisit 2 questions posées à défausser, **jamais les siennes** ;
  **3** : autant de questions que d'adversaires encore en jeu ; **4** : le joueur choisit une
  question posée par un autre joueur à un autre joueur (ni par lui, ni à lui) — la cible ne
  change pas, la question devient la sienne : il la voit et touche tous les effets de la
  réponse (pioche d'Action au « oui » avec son éventuelle Exécution, malus du Non, « aucun
  oui », surveillance de la Spéciale 1) ; l'auteur d'origine apprend la réponse ; elle se
  résout à sa place d'origine dans l'ordre du plateau ; **7** : un pouvoir de la pile Pouvoir
  au choix ; **8** : 2 attributs de la pile au choix. Ordinateur, joueur absent ou délai
  dépassé : choix automatique déterministe (premières cartes possibles / haut de la pile).
  En ligne, la soumission de la phase de question est validée en entier (Spéciale comprise)
  avant que rien ne soit appliqué.

> Le texte d'effet exact de chaque Pouvoir / Non / Multiple / Spéciale est **défini par la
> face de la carte** ; il est transcrit dans `docs/card-catalog.md` puis dans les fichiers
> de données de l'engine, jamais inventé ici. Les textes non encore transcrits sont marqués
> `⟨À_TRANSCRIRE⟩` — voir card-catalog.md §Transcription en attente. Les règles décrivent les
> **catégories**, pas chaque carte.

## 5. Structure d'un tour — trois phases simultanées

Un tour comporte **trois phases** qui se déroulent **simultanément pour tous les joueurs**.
Le serveur est le **barrière** : il n'avance à la phase suivante que lorsque **chaque joueur
vivant** a soumis son action de phase (modèle barrière de WoG — voir `game-state-model.md`).
Le meneur fixe **l'ordre** de la phase Réponse, il **ne sérialise pas** le jeu.

### Phase 1 — Pioche

> **Pouvoirs visibles (#1833)** : le pouvoir de chaque joueur est **face visible pour tous, en
> permanence** (la copie de Clonage aussi). **Pioche vide ⇒ reformée aussitôt** depuis sa
> défausse (Attribut, Action, Pouvoir). Si pioche et défausse ne suffisent pas, les premiers
> joueurs à valider piochent en premier.

1. **Régulariser les pouvoirs** : garantir d'avoir **exactement un** pouvoir.
   - 0 pouvoir → en **piocher 1**.
   - 2 pouvoirs → en **défausser 1** pour redescendre à 1.
2. **Piocher 2 cartes Attribut** (pouvoirs modulants : Étude → 1 Attribut + 1 Action à la
   place ; Optimisme → 3 Attributs si aucun « oui » au tour précédent).

### Phase 2 — Question

- Jouer **jusqu'à 2 questions** (pouvoirs/Spéciales modulent : Connaissance → 3,
  Spéciale 3 → autant que d'adversaires encore en jeu, Refus royal → 0 pour sa cible).
- **Jamais deux questions au même joueur** dans le même tour (exception : Concentration et
  Spéciale 9 autorisent **2** au même joueur — l'emplacement s'empile).
- Une question est une **carte Attribut** ou une **carte Action** (sauf **Spéciale**, qui
  n'est pas une question). Les cartes **Non portent leur propre question** (une par valeur
  d'attribut — card-catalog.md §3.1).
- Une carte jouée comme question est posée **FACE CACHÉE** dans l'emplacement numéroté
  correspondant au joueur ciblé sur le plateau du questionneur : le contenu n'est visible
  que du poseur (et de la cible une fois sa réponse résolue) ; le public voit l'occupation,
  la catégorie (verso) et le résultat oui/non. Établi par les faces Espionnage et
  Spéciales 1/4 (« vous pouvez la regarder ») — card-catalog.md §3.3.

### Phase 3 — Réponse

- En commençant par le **meneur** puis dans l'ordre, chaque joueur **répond oui/non** en
  comparant **chaque carte jouée contre lui** aux attributs de **son** dieu.
- **Toute réponse « oui » fait piocher au joueur qui a posé la question (l'interrogateur) une
  carte Action** — l'interrogé ne pioche rien. Exécution : quand un adversaire répond « oui » à
  VOTRE question, vous pouvez renoncer à piocher et défausser à la place le(s) pouvoir(s) d'un
  joueur de votre choix, choisi à ce moment (pas d'armement préalable ; une fois par tour).
- Les effets **Non** se déclenchent sur les réponses « non ». **Non 1-2 (#1836)** : le joueur
  interrogé **choisit lui-même les 2 cartes** qu'il donne à l'interrogateur (la résolution
  attend son choix ; ordinateur, absent ou délai dépassé : les 2 premières cartes de sa main ;
  main de 2 cartes ou moins : tout est donné).
- **Clonage (#1836)** : on ne copie que le pouvoir d'un joueur en jeu (pas d'un éliminé) ; la
  copie, visible de tous, est annulée dès que le pouvoir copié est défaussé (le détenteur en
  choisit un autre) ; un Clonage qui change de mains perd sa copie, son nouveau détenteur en
  choisit une. Changer la copie et utiliser la copie sont deux usages, permis le même tour.
  Un pouvoir reste utilisable une fois par tour et par joueur ; s'il change de mains, il
  resert à son nouveau détenteur le même tour.
- **Déduction (#1836)** : montre une carte personnage non piochée **tirée au hasard**
  (secret, jamais envoyé aux autres sièges).
- **Refus royal (#1836)** : inutilisable une fois que sa cible a validé ses questions.
- **« Aucun oui au tour précédent »** lit toujours le tour **précédent**, aussi pendant la
  fenêtre de déclaration ; faux tout le tour 1 ; vrai si aucune question n'a été posée. Les cartes **Spéciale**
  posées se déclenchent **au début de leur phase déclarée**.

## 6. Résolution des questions (véracité)

- **Attribut** : « oui » si la valeur de la carte **égale** la valeur correspondante du dieu
  de la cible (même axe : genre / couleur d'yeux / panthéon).
- **Multiple** : question sur un ensemble de **4 dieux** ; « oui » si le dieu de la cible
  **appartient** à cet ensemble.
- **Action Non** : résolue comme une question ; son effet additionnel se déclenche
  seulement sur « non ».
- Les réponses sont **véridiques** et **contraignantes** — le serveur ne connaît pas le
  pense-bête mais connaît le dieu secret de chaque joueur et **valide** chaque réponse
  contre la vérité (une réponse mensongère est rejetée). Voir la propriété d'intégrité dans
  `game-state-model.md`.

## 7. Fin de partie — la déclaration « Panthéons »

À l'**issue d'une phase Réponse**, un joueur peut déclarer **« Panthéons »**, ce qui met la
partie **en pause**.

1. Le déclarant place une **carte-miniature Personnage face cachée devant chaque adversaire**
   — sa supposition du dieu de chacun.
2. Chaque adversaire **révèle** si la miniature posée devant lui **correspond** à son dieu.
3. **Toutes correctes ⇒ le déclarant gagne.** La partie se termine.
4. **Première erreur ⇒ le déclarant est éliminé** ; sa carte reste **cachée** et les autres
   joueurs **n'ont plus besoin de le deviner**.
5. **Dernier joueur en jeu ⇒ il gagne automatiquement** (#1833), y compris quand les autres
   déclarants de la même fenêtre sont tous éliminés dans cette résolution.

### Joueur éliminé (#1833)

Sa main et son pouvoir restent devant lui, **bloqués** : visibles, inutilisables, non copiables
par Clonage, et **jamais ciblables** (pouvoirs, Non à échange, Spéciales, Exécution). Une Spéciale
dont le propriétaire ou la cible est éliminé n'a aucun effet.

### Déclarants multiples

- Si plusieurs joueurs déclarent lors de la même fenêtre, on résout **dans le sens horaire à
  partir du meneur**.
- Si **aucun** déclarant ne réussit, **le jeu reprend**.

## 8. Contraintes de comptage (invariants)

- Joueurs : **min 4 pour démarrer, max 7** (plafond physique du plateau).
- Un joueur en régime établi détient **exactement 1 pouvoir** au sortir de la Pioche.
- Au plus **2 questions par joueur et par tour**, **≤ 1 par cible** — sauf modulation par
  pouvoir/Spéciale (§5 Phase 2) ; jamais plus de **2 par cible** dans tous les cas.
- L'**emplacement spécial** contient au plus **1 carte Spéciale** à la fois.

## 9. Déconnexion / barrière (défère à WoG)

Le comportement quand un joueur vivant cale ou se déconnecte pendant une phase **défère au
modèle barrière de WoG** (à coller par Jules). Voir `game-state-model.md` §Barrière et le
`⟨INPUT: WoG room model⟩`.
