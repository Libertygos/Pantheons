# Panthéons — Catalogue des cartes (card-catalog.md)

> **Authority:** source de vérité du catalogue de cartes (versions.md 1.0.0). Dérivé des
> assets de `conversion_cartes/` — le pense-bête (`Pense_Bête.webp`, hydraté dans le repo)
> et les 64 faces de cartes (`cartes_webp/cartes_finales/*.webp`, **Git LFS**). Tout nom,
> valeur d'attribut et texte d'effet est **verbatim des assets, en français** — jamais
> inventé. Les champs qui ne peuvent être lus que sur une face de carte actuellement
> indisponible (voir §Blocage LFS) sont marqués **`⟨BLOQUÉ:LFS⟩`**.
>
> Downstream : `packages/engine/src/data/*` implémente ce catalogue ; `docs/glossary.md`
> reprend les enums ; `docs/rules.md` décrit les catégories.

## Blocage LFS (état au 2026-07-07)

Les 64 faces (`cartes_webp/cartes_finales/*.webp`) sont des pointeurs Git LFS et le budget
LFS du compte GitHub est épuisé (`This repository exceeded its LFS budget`) — les objets ne
peuvent pas être téléchargés. **Transcrit malgré tout** : la table des dieux complète (le
pense-bête, source ratifiée pour les attributs des dieux, est hydraté), l'identité et le
compte de chaque carte (noms de fichiers + versions.md). **Bloqué** : le texte d'effet
exact de chaque Action et Pouvoir, les 4 dieux de chaque carte Multiple, la phase de
déclenchement de chaque Spéciale, et la confirmation visuelle des faces Attribut /
Personnage. Une fois le budget LFS restauré : `git lfs pull` puis remplacer chaque
`⟨BLOQUÉ:LFS⟩` ci-dessous.

## 1. Les 12 dieux (Personnages) — table canonique

Transcrit du **pense-bête** (source ratifiée — `pantheons-design-decisions.md`, Inputs §2).
La bande de couleur derrière chaque portrait est la légende de la couleur des yeux ;
elle concorde avec l'iris dessiné sur 11 portraits lisibles sur 12.

| Dieu (verbatim) | id | Panthéon | Genre | Couleur des yeux | Fichier carte |
|---|---|---|---|---|---|
| Brahma | `brahma` | hindou | masculin | rouges | `card_personnages_brahma.webp` |
| Ganesh | `ganesh` | hindou | masculin | bleus ¹ | `card_personnages_ganesh.webp` |
| Sarasvati | `sarasvati` | hindou | feminin | verts | `card_personnages_sarasvati.webp` |
| Zeus | `zeus` | grec | masculin | bleus | `card_personnages_zeus.webp` |
| Athena | `athena` | grec | feminin | rouges | `card_personnages_athena.webp` |
| Artemis | `artemis` | grec | feminin | bleus | `card_personnages_artemis.webp` |
| Rê | `re` | egyptien | masculin | rouges | `card_personnages_re.webp` |
| Bastet | `bastet` | egyptien | feminin | rouges | `card_personnages_bastet.webp` |
| Isis | `isis` | egyptien | feminin | verts | `card_personnages_isis.webp` |
| Loki | `loki` | nordique | masculin | verts | `card_personnages_loki.webp` |
| Odin | `odin` | nordique | masculin | bleus ² | `card_personnages_odin.webp` |
| Frigg | `frigg` | nordique | feminin | verts | `card_personnages_frigg.webp` |

¹ Ganesh : bande bleue (turquoise) nette ; l'iris dessiné est maquillé (amande dorée à
centre rouge) et illisible à la résolution du pense-bête. `bleus` retenu par la légende de
bande — **à confirmer sur `card_personnages_ganesh.webp`** une fois le LFS restauré.
² Odin : cicatrice rouge sur l'œil (mythologie) ; l'iris est bien bleu/turquoise.

**Invariants vérifiés** : 4 panthéons × 3 dieux ; genre 6 masculin / 6 feminin ; yeux
4 bleus / 4 verts / 4 rouges. Verso commun : `card_personnages_verso.webp`.

Graphie : le pense-bête écrit **PANTHÉON EGYPTIEN** (capitale non accentuée) ; l'enum reste
`egyptien`, libellé d'affichage « Égyptien ».

## 2. Attributs — 9 cartes distinctes × 4 exemplaires = 36 cartes

L'espace de déduction complet est **9 valeurs** (2 genres + 3 couleurs d'yeux +
4 panthéons) ; il y a exactement 9 faces Attribut dans les assets. **4 exemplaires de
chaque** (versions.md), soit **36 cartes Attribut** au total.

> ⚠️ versions.md 1.0.0 écrit « 36 distinct attributes, 4 copies of each → 144 ». Les assets
> ne contiennent que 9 faces Attribut et l'espace de déduction est clos à 9 valeurs ; la
> lecture retenue est **9 distinctes × 4 = 36 cartes** (le « 36 » de versions.md est le
> total, pas le nombre de faces distinctes). À faire ratifier par Jules ; le moteur utilise
> 9 × 4 = 36.

| id | Axe | Valeur | Copies | Fichier |
|---|---|---|---|---|
| `attr_masculin` | genre | masculin | 4 | `card_attributs_masculin.webp` |
| `attr_feminin` | genre | feminin | 4 | `card_attributs_feminin.webp` |
| `attr_bleus` | couleurYeux | bleus | 4 | `card_attributs_bleus.webp` |
| `attr_verts` | couleurYeux | verts | 4 | `card_attributs_verts.webp` |
| `attr_rouges` | couleurYeux | rouges | 4 | `card_attributs_rouges.webp` |
| `attr_hindou` | pantheon | hindou | 4 | `card_attributs_indou.webp` ³ |
| `attr_grec` | pantheon | grec | 4 | `card_attributs_grec.webp` |
| `attr_egyptien` | pantheon | egyptien | 4 | `card_attributs_egyptien.webp` |
| `attr_nordique` | pantheon | nordique | 4 | `card_attributs_nordique.webp` |

³ Le nom de fichier est `indou` (sans h) ; le pense-bête écrit « PANTHÉON HINDOU ». L'enum
canonique reste `hindou` ; le mapping fichier↔id absorbe l'écart.

**Logique** (rules.md §6) : jouée comme question sur un adversaire ; réponse « oui » ssi la
valeur de la carte égale la valeur du même axe du dieu de la cible. Verso commun :
`card_attributs_verso.webp`.

## 3. Actions — 27 cartes distinctes, 1 exemplaire chacune

Trois sous-types (rules.md §4), 9 cartes par sous-type. Un exemplaire de chaque
(versions.md). Verso commun : `card_actions_verso.webp`.

### 3.1 Non (9) — question ; l'effet se déclenche sur réponse « non »

| id | Copies | Effet | Fichier |
|---|---|---|---|
| `action_non_1` … `action_non_9` | 1 chacune | `⟨BLOQUÉ:LFS⟩` | `card_actions_non_1.webp` … `card_actions_non_9.webp` |

### 3.2 Multiple (9) — question sur un ensemble de 4 dieux

| id | Copies | Les 4 dieux | Effet additionnel éventuel | Fichier |
|---|---|---|---|---|
| `action_multiple_1` … `action_multiple_9` | 1 chacune | `⟨BLOQUÉ:LFS⟩` | `⟨BLOQUÉ:LFS⟩` | `card_actions_multiple_1.webp` … `card_actions_multiple_9.webp` |

**Logique** : « oui » ssi le dieu de la cible appartient à l'ensemble des 4.

### 3.3 Spéciale (9) — non-question ; emplacement spécial ; déclenche au début de sa phase déclarée puis défausse

| id | Copies | Phase de déclenchement | Effet | Fichier |
|---|---|---|---|---|
| `action_special_1` … `action_special_9` | 1 chacune | `⟨BLOQUÉ:LFS⟩` | `⟨BLOQUÉ:LFS⟩` | `card_actions_special_1.webp` … `card_actions_special_9.webp` |

## 4. Pouvoirs — 12 cartes distinctes, 1 exemplaire chacune

Un joueur détient exactement 1 pouvoir en régime établi (rules.md §5 Pioche). Verso
commun : `card_pouvoirs_verso.webp`. Libellés ci-dessous reconstitués des noms de
fichiers ; **la graphie exacte de la face fait foi** (`⟨BLOQUÉ:LFS⟩` pour confirmation).

| id (effectKey) | Libellé probable | Copies | Effet | Fichier |
|---|---|---|---|---|
| `sabotage` | Sabotage | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_sabotage.webp` |
| `clonage` | Clonage | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_clonage.webp` |
| `etude` | Étude | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_etude.webp` |
| `concentration` | Concentration | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_concentration.webp` |
| `refus_royal` | Refus royal | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_refus_royal.webp` |
| `connaissance` | Connaissance | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_connaissance.webp` |
| `execution` | Exécution | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_execution.webp` |
| `ames_soeurs_1` | Âmes sœurs (1) | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_ames_soeurs_1.webp` |
| `ames_soeurs_2` | Âmes sœurs (2) | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_ames_soeurs_2.webp` |
| `deduction` | Déduction | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_deduction.webp` |
| `optimisse` | Optimisse ⁴ | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_optimisse.webp` |
| `espionnage` | Espionnage | 1 | `⟨BLOQUÉ:LFS⟩` | `card_pouvoirs_espionnage.webp` |

⁴ `optimisse` tel quel dans le nom de fichier (graphie inhabituelle — « Optimiste » ?) ; la
face fait foi, clé figée sur le fichier.

## 5. Récapitulatif du paquet

| Type | Distinctes | Copies | Total cartes |
|---|---|---|---|
| Personnage | 12 | 1 | 12 |
| Attribut | 9 | 4 | 36 |
| Action (non 9 / multiple 9 / speciale 9) | 27 | 1 | 27 |
| Pouvoir | 12 | 1 | 12 |
| **Total jeu** | **60** | — | **87** |

Assets non-cartes : `Pense_Bête.webp` (pense-bête), 4 versos (`card_*_verso.webp`).
64 fichiers cartes = 60 faces + 4 versos ✓ (aucune carte manquante vs ce catalogue).

## 6. Vérification croisée pense-bête

- Roster et regroupement en 4 panthéons : conforme au pense-bête ✓.
- Lignes 1–7 du pense-bête : une par adversaire — cohérent avec la table 4–7 joueurs et les
  emplacements numérotés du plateau ✓.
- Couleurs d'yeux {bleus, verts, rouges} : exactement les 3 faces Attribut couleur ✓,
  et les 3 couleurs de bandes du pense-bête ✓.
- Aucun fichier carte hors catalogue, aucun trou dans les numérotations 1–9 ✓.
