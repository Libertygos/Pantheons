# Panthéons — Règles (rules.md)

> **Authority:** derived from `pantheons-design-decisions.md` (ratified 2026-07-01) and
> the uploaded rulebook / pense-bête assets. This is the canonical ruleset in Pantheons'
> own terms. Vocabulary (god / attribute / pantheon / card names) is **fixed by the image
> assets, in French** — never invented or translated here. The card catalog and god table
> are transcribed in `docs/card-catalog.md`; values only readable on card faces not yet
> transcribed are marked **`⟨À_TRANSCRIRE⟩`**.

## 1. But du jeu

Panthéons est un jeu de **déduction à identité cachée** pour **4 à 7 joueurs**. Chaque
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
  défaussée.

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

1. **Régulariser les pouvoirs** : garantir d'avoir **exactement un** pouvoir.
   - 0 pouvoir → en **piocher 1**.
   - 2 pouvoirs → en **défausser 1** pour redescendre à 1.
2. **Piocher 2 cartes Attribut**.

### Phase 2 — Question

- Jouer **jusqu'à 2 questions**.
- **Jamais deux questions au même joueur** dans le même tour.
- Une question est une **carte Attribut** ou une **carte Action** (sauf **Spéciale**, qui
  n'est pas une question).
- Une carte jouée comme question est posée dans l'emplacement numéroté correspondant au
  joueur ciblé sur le plateau du questionneur.

### Phase 3 — Réponse

- En commençant par le **meneur** puis dans l'ordre, chaque joueur **répond oui/non** en
  comparant **chaque carte jouée contre lui** aux attributs de **son** dieu.
- **Toute réponse « oui » fait piocher au joueur interrogé une carte Action.**
- Les effets **Non** se déclenchent sur les réponses « non ». Les cartes **Spéciale**
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

### Déclarants multiples

- Si plusieurs joueurs déclarent lors de la même fenêtre, on résout **dans le sens horaire à
  partir du meneur**.
- Si **aucun** déclarant ne réussit, **le jeu reprend**.

## 8. Contraintes de comptage (invariants)

- Joueurs : **min 4 pour démarrer, max 7** (plafond physique du plateau).
- Un joueur en régime établi détient **exactement 1 pouvoir** au sortir de la Pioche.
- Au plus **2 questions par joueur et par tour**, **≤ 1 par cible**.
- L'**emplacement spécial** contient au plus **1 carte Spéciale** à la fois.

## 9. Déconnexion / barrière (défère à WoG)

Le comportement quand un joueur vivant cale ou se déconnecte pendant une phase **défère au
modèle barrière de WoG** (à coller par Jules). Voir `game-state-model.md` §Barrière et le
`⟨INPUT: WoG room model⟩`.
