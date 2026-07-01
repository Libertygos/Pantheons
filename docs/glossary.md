# Panthéons — Glossaire (glossary.md)

> **Authority:** vocabulaire canonique. Tout est **verbatim des assets** (pense-bête +
> cartes), en **français**, immuable. Les valeurs qui doivent être **lues sur l'image du
> pense-bête** et ne sont pas encore dans le repo sont marquées **`⟨TRANSCRIBE⟩`**. Ce
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
Enum fermé. Valeurs : **`⟨TRANSCRIBE⟩`** depuis la légende du pense-bête. Hypothèse de
structure la plus probable (à **confirmer sur l'image**) : `feminin | masculin`. Ne pas
figer avant transcription.

### 2. Couleur des yeux (`couleurYeux`)
Enum fermé, issu de la **légende du pense-bête**. Valeurs : **`⟨TRANSCRIBE⟩`**. C'est un
axe de déduction fermé : toute question « couleur d'yeux » se résout contre ce vocabulaire
fixe.

### 3. Panthéon (`pantheon`)
Enum fermé, connu : **`hindou | grec | egyptien | nordique`**.
Libellés d'affichage : Hindou, Grec, Égyptien, Nordique.

## Table dieu → attributs (canonique)

| Dieu | Panthéon | Genre | Couleur des yeux |
|---|---|---|---|
| Brahma | hindou | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Ganesh | hindou | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Sarasvati | hindou | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Zeus | grec | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Athena | grec | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Artemis | grec | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Rê | egyptien | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Bastet | egyptien | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Isis | egyptien | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Loki | nordique | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Odin | nordique | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |
| Frigg | nordique | `⟨TRANSCRIBE⟩` | `⟨TRANSCRIBE⟩` |

> Source unique : `packages/engine/src/data/gods.ts`. Le seul champ **connu sans image**
> est le panthéon (déduit du regroupement du roster). Genre + couleur d'yeux = image.

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
