# Panthéons — Catalogue des cartes (card-catalog.md)

> **Authority:** source de vérité du catalogue de cartes (versions.md 1.0.0). Dérivé des
> assets de `conversion_cartes/` — le pense-bête (`Pense_Bête.webp`) et les 64 faces de
> cartes (`cartes_webp/cartes_finales/*.webp`). Tout nom, valeur d'attribut et texte
> d'effet est **verbatim des assets, en français** — jamais inventé. Transcription
> **complète** depuis le 2026-07-07 (plus aucun `⟨À_TRANSCRIRE⟩` ; erratas d'assets en §7).
>
> Downstream : `packages/engine/src/data/*` implémente ce catalogue ; `docs/glossary.md`
> reprend les enums ; `docs/rules.md` décrit les catégories.

## Transcription (complète au 2026-07-07)

Les 64 faces (`cartes_webp/cartes_finales/*.webp`) sont des fichiers git normaux dans le
repo (restaurées le 2026-07-07) et **intégralement transcrites ci-dessous** : textes
d'effet des 12 Pouvoirs et des 27 Actions, sets de 4 dieux des Multiple, phases de
déclenchement des Spéciales, questions verbatim des Attributs. Les textes sont **verbatim**
(orthographe des faces conservée, `[sic]` sur les écarts). Erratas d'assets relevés en §7.

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

¹ Ganesh : **conflit d'assets tranché → `bleus` canonique.** Le pense-bête (outil de
déduction partagé, source ratifiée des attributs) porte une bande turquoise nette aux deux
bords de sa cellule (mesuré `rgb(104,203,193)` = `--turquoise`), et la symétrie 4/4/4 des
yeux (avec 6/6 genres et 3×4 panthéons) est manifestement l'intention du designer. La
**carte** `card_personnages_ganesh.webp` porte pourtant une bande diagonale **rouge**
(`rgb(224,65,57)`) — lecture retenue : choix de contraste de l'illustrateur (une bande
turquoise derrière l'éléphant turquoise serait invisible) ou erratum, cf. §7. L'iris
dessiné (amande dorée à centre rouge) reste illisible comme couleur.
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

| id | Axe | Valeur | Copies | Question (verbatim face) | Fichier |
|---|---|---|---|---|---|
| `attr_masculin` | genre | masculin | 4 | « Êtes vous un personnage masculin? » [sic] | `card_attributs_masculin.webp` |
| `attr_feminin` | genre | feminin | 4 | « Êtes vous un personnage féminin? » [sic] | `card_attributs_feminin.webp` |
| `attr_bleus` | couleurYeux | bleus | 4 | « Avez vous les yeux **bleus**? » [sic] | `card_attributs_bleus.webp` |
| `attr_verts` | couleurYeux | verts | 4 | « Avez vous les yeux **verts**? » [sic] | `card_attributs_verts.webp` |
| `attr_rouges` | couleurYeux | rouges | 4 | « Avez vous les yeux **rouges**? » [sic] | `card_attributs_rouges.webp` |
| `attr_hindou` | pantheon | hindou | 4 | « Faites vous partie du panthéon Hindou? » [sic] | `card_attributs_indou.webp` ³ |
| `attr_grec` | pantheon | grec | 4 | « Faites vous partie du panthéon Grec? » [sic] | `card_attributs_grec.webp` |
| `attr_egyptien` | pantheon | egyptien | 4 | « Faites vous partie du panthéon Egyptien? » [sic] | `card_attributs_egyptien.webp` |
| `attr_nordique` | pantheon | nordique | 4 | « Faites vous partie du panthéon Nordique? » [sic] | `card_attributs_nordique.webp` |

³ Le nom de fichier est `indou` (sans h) ; **la face écrit « Hindou »** (comme le
pense-bête). L'enum canonique reste `hindou` ; le mapping fichier↔id absorbe l'écart.
[sic] global : les faces écrivent « Êtes vous » / « Avez vous » / « Faites vous » sans
trait d'union — verbatim conservé, jamais « corrigé ». Sur les cartes couleur d'yeux, le
mot-valeur est composé dans la couleur d'yeux correspondante (turquoise/vert/vermillon) —
la sémantique de légende du pense-bête, confirmée.

**Logique** (rules.md §6) : jouée comme question sur un adversaire ; réponse « oui » ssi la
valeur de la carte égale la valeur du même axe du dieu de la cible. Verso commun :
`card_attributs_verso.webp`.

## 3. Actions — 27 cartes distinctes, 1 exemplaire chacune

Trois sous-types (rules.md §4), 9 cartes par sous-type. Un exemplaire de chaque
(versions.md). Verso commun : `card_actions_verso.webp`.

### 3.1 Non (9) — question ; l'effet se déclenche sur réponse « non »

Chaque carte Non **porte sa propre question** (panneau vermillon haut, picto + texte —
mêmes questions que les Attributs, une par valeur : les 9 valeurs sont couvertes) et un
**effet de malus** (texte vermillon sur blanc, bas) qui frappe **le répondeur** quand il
répond « non ». Trois effets, un par axe :

| id | Question portée (axe = valeur) | Effet (verbatim face) | Fichier |
|---|---|---|---|
| `action_non_1` | genre = feminin | « Si vous répondez non, donnez deux de vos cartes au joueur qui vous a posé la question. » | `card_actions_non_1.webp` |
| `action_non_2` | genre = masculin | idem `action_non_1` | `card_actions_non_2.webp` |
| `action_non_3` | pantheon = egyptien | « Si vous répondez non, échangez votre pouvoir avec le joueur qui vous a posé la question. » | `card_actions_non_3.webp` |
| `action_non_4` | pantheon = grec | idem `action_non_3` | `card_actions_non_4.webp` |
| `action_non_5` | pantheon = hindou | idem `action_non_3` | `card_actions_non_5.webp` |
| `action_non_6` | pantheon = nordique | idem `action_non_3` | `card_actions_non_6.webp` |
| `action_non_7` | couleurYeux = rouges | « Si vous répondez non, défaussez votre pouvoir. » | `card_actions_non_7.webp` |
| `action_non_8` | couleurYeux = verts | idem `action_non_7` | `card_actions_non_8.webp` |
| `action_non_9` | couleurYeux = bleus | idem `action_non_7` | `card_actions_non_9.webp` |

Graphie : sur les cartes Non, la question panthéon s'écrit « **P**anthéon Egyptien? »
(majuscule) là où la carte Attribut écrit « panthéon Hindou? » — verbatim par carte.

### 3.2 Multiple (9) — question sur un ensemble de 4 dieux

Question commune à toutes : « **Êtes vous l'un de ces personnages?** » [sic], suivie des
4 noms avec picto de panthéon. **Aucun effet additionnel** — la Multiple est une pure
question d'appartenance.

| id | Les 4 dieux (verbatim, ordre de la face) | Fichier |
|---|---|---|
| `action_multiple_1` | Brahma, Rê, Zeus, Loki ⁵ | `card_actions_multiple_1.webp` |
| `action_multiple_2` | Ganesh, Bastet, Athena, Odin | `card_actions_multiple_2.webp` |
| `action_multiple_3` | Sarasvati, Isis, Artemis, Frigg | `card_actions_multiple_3.webp` |
| `action_multiple_4` | Brahma, Odin, Ganesh, Frigg | `card_actions_multiple_4.webp` |
| `action_multiple_5` | Sarasvati, Zeus, Isis, Loki ⁵ | `card_actions_multiple_5.webp` |
| `action_multiple_6` | Athena, Rê, Artemis, Bastet | `card_actions_multiple_6.webp` |
| `action_multiple_7` | Brahma, Isis, Athena, Loki | `card_actions_multiple_7.webp` |
| `action_multiple_8` | Ganesh, Rê, Artemis, Odin | `card_actions_multiple_8.webp` |
| `action_multiple_9` | Sarasvati, Zeus, Bastet, Frigg | `card_actions_multiple_9.webp` |

Structure : 1–3 et 7–9 = un dieu par panthéon ; 4 = 2 hindous + 2 nordiques ;
5 = mixte ; 6 = 2 grecs + 2 égyptiens.
⁵ Erratas d'icônes (les **noms** font foi, cf. §7) : sur la face 1, les pictos de Rê
(colonne grecque) et Zeus (œil d'Horus) sont intervertis ; sur la face 5, Isis porte le
picto hindou (ॐ).

**Logique** : « oui » ssi le dieu de la cible appartient à l'ensemble des 4.

### 3.3 Spéciale (9) — non-question ; emplacement spécial ; déclenche au début de sa phase déclarée puis défausse

La phase de déclenchement est imprimée en **bande blanche au pied de la face** (« Phase de
réponse » / « Phase de question » / « Phase de pioche »).

| id | Phase | Effet (verbatim face) | Fichier |
|---|---|---|---|
| `action_special_1` | réponse | « Choisissez un joueur. S'il vous répond oui ce tour ci [sic], regardez sa carte personnage. » | `card_actions_special_1.webp` |
| `action_special_2` | réponse | « Choisissez deux cartes questions posées et défaussez les [sic]. » | `card_actions_special_2.webp` |
| `action_special_3` | question | « Vous pouvez poser autant de questions qu'il y'a [sic] de joueurs pendant la prochaine phase de question. » | `card_actions_special_3.webp` |
| `action_special_4` | réponse | « Prenez une question posée et mettez la [sic] dans votre case question (vous pouvez la regarder). » | `card_actions_special_4.webp` |
| `action_special_5` | pioche | « Le joueur de votre choix se défausse de son pouvoir. » | `card_actions_special_5.webp` |
| `action_special_6` | pioche | « Echangez [sic] votre pouvoir contre celui d'un autre joueur. » | `card_actions_special_6.webp` |
| `action_special_7` | pioche | « Prenez le pouvoir de votre choix dans la pile pouvoir. » | `card_actions_special_7.webp` |
| `action_special_8` | pioche | « Prenez deux cartes attributs de votre choix dans la pile attribut. » | `card_actions_special_8.webp` |
| `action_special_9` | pioche | « Jusqu'au prochain tour vous pouvez poser deux questions au même joueur. » | `card_actions_special_9.webp` |

> Les faces 1, 4 et l'Espionnage (§4) prouvent que **les questions posées sont face
> cachée** pour les autres joueurs (« vous pouvez la regarder » n'aurait aucun sens
> sinon) : seuls le poseur — et la cible au moment de répondre — voient le contenu ;
> le public ne voit que l'emplacement occupé et la réponse oui/non. Modèle appliqué à
> `projection.ts` (redaction) le 2026-07-07.

## 4. Pouvoirs — 12 cartes distinctes, 1 exemplaire chacune

Un joueur détient exactement 1 pouvoir en régime établi (rules.md §5 Pioche). Verso
commun : `card_pouvoirs_verso.webp`. Titres et effets **verbatim des faces** (titres
imprimés en capitales).

| id (effectKey) | Titre (face) | Effet (verbatim face) | Fichier |
|---|---|---|---|
| `sabotage` | SABOTAGE | « Si un joueur a reçu trois questions ou plus ce tour-ci, choisissez une carte attribut posée et défaussez la [sic] (une fois par tour). » | `card_pouvoirs_sabotage.webp` |
| `clonage` | CLONAGE | « Choisissez le pouvoir d'un autre joueur. Clonage devient une copie de ce pouvoir. Si le pouvoir copié est déffaussé [sic], choisissez-en un autre. » | `card_pouvoirs_clonage.webp` |
| `etude` | ETUDE ⁶ | « Pendant la phase de pioche, piochez une carte attribut et une carte action. » | `card_pouvoirs_etude.webp` |
| `concentration` | CONCENTRATION | « Vous pouvez poser deux questions au même joueur. » | `card_pouvoirs_concentration.webp` |
| `refus_royal` | REFUS ROYAL | « Si vous n'avez eu aucun oui au tour précédent, choisissez un joueur qui vous a répondu non. Il ne posera pas de questions à ce tour. » | `card_pouvoirs_refus_royal.webp` |
| `connaissance` | CONNAISSANCE | « Vous pouvez poser trois questions par tour. » | `card_pouvoirs_connaissance.webp` |
| `execution` | EXÉCUTION | « Quand on vous répond oui ⁷, vous pouvez choisir de ne pas piocher de carte action. A la place [sic], vous pouvez défausser le pouvoir d'un joueur. » | `card_pouvoirs_execution.webp` |
| `ames_soeurs_1` | ÂMES SOEURS | « Quand vous réalisez votre Panthéon, si un autre joueur possède le pouvoir de l'âme soeur, vous n'avez pas à deviner sa carte personnage. » | `card_pouvoirs_ames_soeurs_1.webp` |
| `ames_soeurs_2` | ÂMES SOEURS | idem — les deux faces sont identiques | `card_pouvoirs_ames_soeurs_2.webp` |
| `deduction` | DÉDUCTION | « Si vous n'avez eu aucun oui au tour précédent, regardez une carte personnage qui n'a pas été piochée. » | `card_pouvoirs_deduction.webp` |
| `optimisse` | **OPTIMISME** ⁴ | « Si vous n'avez eu aucun oui au tour précédent, piochez trois cartes attributs au lieu de deux pendant votre phase de pioche. » | `card_pouvoirs_optimisse.webp` |
| `espionnage` | ESPIONNAGE | « Si vous n'avez eu aucun oui au tour précédent, vous pouvez regarder une question posée par un autre joueur. » | `card_pouvoirs_espionnage.webp` |

⁴ La face imprime **OPTIMISME** ; le nom de fichier `optimisse` était une coquille. La
face fait foi pour le libellé ; l'`effectKey` reste figé sur le fichier (`optimisse`).
⁶ La face imprime « ETUDE » sans accent (capitales non accentuées) ; libellé d'affichage
retenu « Étude ».
⁷ « Quand on vous répond oui » lu comme « quand **vous répondez** oui » (le tirage d'une
carte action sur « oui » appartient au **joueur interrogé**, rules.md §5 — la formulation
de la face est imprécise, cohérente avec ses autres coquilles). Arbitrage consigné dans
PANTHEONS_PROGRESS.md.

Quatre pouvoirs partagent la condition « **aucun oui au tour précédent** » (Refus royal,
Déduction, Optimisme, Espionnage) : se lit « aucune de VOS questions n'a reçu de oui au
tour précédent » — suivi par l'engine (`lastTurn`).

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
- Faces Personnage : fond = **couleur de panthéon** (hindou doré `#C58A29`, grec
  chartreuse pâle `#D6DA7B`, égyptien or olive `#C8BF5C`, nordique gris argenté
  `#E5E6E3`), bande diagonale = **couleur d'yeux** — concorde avec la table §1 pour
  11 dieux sur 12 (exception Ganesh, cf. §1 ¹ et §7).
- Les 9 questions Non couvrent exactement les 9 valeurs d'attribut ✓ (aucune valeur en
  double, aucune absente).

## 7. Erratas d'assets (faces ≠ référence — lecture retenue)

| # | Face | Écart constaté | Lecture retenue |
|---|---|---|---|
| E1 | `card_personnages_ganesh.webp` | Bande diagonale **rouge** alors que le pense-bête (source ratifiée) code Ganesh **turquoise** (bleus) et que la symétrie 4/4/4 l'exige | **`bleus` canonique** ; bande carte = contraste illustrateur ou erratum |
| E2 | `card_actions_multiple_1.webp` | Pictos de Rê et Zeus **intervertis** (Rê→colonne, Zeus→œil d'Horus) | Les **noms** font foi ; set = {Brahma, Rê, Zeus, Loki} |
| E3 | `card_actions_multiple_5.webp` | Isis porte le picto **hindou** (ॐ) | Les **noms** font foi ; set = {Sarasvati, Zeus, Isis, Loki} |
| E4 | `card_pouvoirs_optimisse.webp` | Fichier `optimisse` vs titre imprimé **OPTIMISME** | Libellé **Optimisme** ; `effectKey` reste `optimisse` (clé technique figée) |
| E5 | `card_pouvoirs_execution.webp` | « Quand on vous répond oui » contredit rules.md §5 (le tirage action du « oui » appartient à l'interrogé) | Lu « quand vous répondez oui » — le pouvoir s'exerce en répondant |

Orthographe des faces (conservée verbatim avec [sic], jamais corrigée à l'affichage des
images) : « Êtes vous », « Avez vous », « Faites vous », « défaussez la », « mettez la »,
« déffaussé », « y'a », « Echangez », « A la place », « ce tour ci ».
