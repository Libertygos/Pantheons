# Panthéons — Glossaire (glossary.md)

> **Authority:** vocabulaire canonique. Tout est **verbatim des assets** (pense-bête +
> cartes), en **français**, immuable. Transcrit du pense-bête + noms de fichiers des
> cartes le 2026-07-07 — voir `docs/card-catalog.md` (source de vérité du catalogue). Ce
> fichier est la source de vérité pour les clés d'enum consommées par l'engine — même
> discipline que la règle « les assets font foi » de War of Guilds.

## Dieux (12) — noms verbatim

Hindou : **Brahma**, **Ganesh**, **Sarasvati**
Grec : **Zeus**, **Athena**, **Artemis**
Égyptien : **Rê**, **Bastet**, **Isis**
Nordique : **Loki**, **Odin**, **Frigg**

Clés d'enum internes (`GodId`) : ASCII-fold des noms, minuscules —
`brahma, ganesh, sarasvati, zeus, athena, artemis, re, bastet, isis, loki, odin, frigg`.
Le **libellé d'affichage** reste le nom verbatim ci-dessus (accents inclus : « Rê »).

## Axes d'attribut (l'espace de déduction)

### 1. Genre (`genre`)
Enum fermé : **`feminin | masculin`** — les deux faces Attribut genre
(`card_attributs_feminin.webp`, `card_attributs_masculin.webp`).

### 2. Couleur des yeux (`couleurYeux`)
Enum fermé : **`bleus | verts | rouges`** — la légende de bandes du pense-bête et les
trois faces Attribut couleur (`card_attributs_bleus/verts/rouges.webp`). Clés au pluriel,
verbatim des assets. Toute question « couleur d'yeux » se résout contre ce vocabulaire
fixe.

### 3. Panthéon (`pantheon`)
Enum fermé, connu : **`hindou | grec | egyptien | nordique`**.
Libellés d'affichage : Hindou, Grec, Égyptien, Nordique. (Le pense-bête écrit « PANTHÉON
EGYPTIEN » en capitale non accentuée ; la face Attribut fichier `indou` — l'enum reste
`hindou`/`egyptien`, le mapping fichier↔id absorbe l'écart.)

## Table dieu → attributs (canonique)

| Dieu | Panthéon | Genre | Couleur des yeux |
|---|---|---|---|
| Brahma | hindou | masculin | rouges |
| Ganesh | hindou | masculin | bleus ¹ |
| Sarasvati | hindou | feminin | verts |
| Zeus | grec | masculin | bleus |
| Athena | grec | feminin | rouges |
| Artemis | grec | feminin | bleus |
| Rê | egyptien | masculin | rouges |
| Bastet | egyptien | feminin | rouges |
| Isis | egyptien | feminin | verts |
| Loki | nordique | masculin | verts |
| Odin | nordique | masculin | bleus |
| Frigg | nordique | feminin | verts |

> Source unique : `packages/engine/src/data/gods.ts`, transcrit du pense-bête (légende de
> bandes = couleur des yeux). Répartition : 6 masculin / 6 feminin ; 4 bleus / 4 verts /
> 4 rouges. ¹ Ganesh : iris stylisé illisible sur le pense-bête, `bleus` retenu par sa
> bande turquoise — à confirmer sur `card_personnages_ganesh.webp` (voir card-catalog.md).

## Types & sous-types de carte

- **Personnage** (`personnage`) — 12, le dieu secret.
- **Pouvoir** (`pouvoir`) — 12, effet ; 1 par joueur en régime.
- **Attribut** (`attribut`) — carte-question portant `{ axe, valeur }`.
- **Action** (`action`) avec sous-types :
  - **Non** (`non`) — effet sur réponse « non ».
  - **Multiple** (`multiple`) — question sur 4 dieux.
  - **Spéciale** (`speciale`) — non-question, emplacement spécial, déclenchement en début
    de phase déclarée.

## Phases (`Phase`)

- **Pioche** (`pioche`)
- **Question** (`question`)
- **Réponse** (`reponse`)

## Rôles / concepts de table

- **Meneur** (`meneur`) — joueur qui ordonne la phase Réponse ; tourne horaire chaque tour.
- **Plateau** (`plateau`) — 6 emplacements question numérotés + 1 emplacement spécial.
- **Pense-bête** (`penseBete`) — grille de déduction **client-only**, jamais en état serveur.
- **Panthéons** (`declaration`) — déclaration de victoire finale.

## Chrome traduisible (FR uniquement)

Lobby, libellés de phase, boutons, flux de déclaration « Panthéons ! », messages de
déconnexion/erreur, libellés du pense-bête. **FR uniquement**, aucune source EN, aucun
toggle runtime (Décision 7). Clés i18n dans `client/src/i18n/fr.ts`.
