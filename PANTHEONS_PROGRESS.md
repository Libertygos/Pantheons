# PANTHEONS_PROGRESS.md — journal de construction de l'interface

> Fichier de continuité. Objectif : « lis ce fichier et reprends tes travaux » doit suffire
> pour reprendre sans perte. Mis à jour après chaque étape significative.
> Session 1 démarrée le 2026-07-07. Session 2 (faces réelles) le 2026-07-07 — cf. §1bis et §8.

## 1. Ligne artistique extraite (définitive — ne pas re-débattre)

Source : `conversion_cartes/Pense_Bête.webp` (2481×1749 — au moment de l'extraction, seul
asset lisible ; les 64 faces de cartes ont depuis été restaurées, cf. §6). Le pense-bête est un
document designer complet : titre, frise des 12 dieux, grille, légende — il suffit à fixer
la DA.

### Palette (mesurée au pixel sur l'asset)

| Token | Hex | Origine / usage |
|---|---|---|
| `--nuit` | `#222C5D` | fond marine du pense-bête (léger dégradé diagonal ~`#1C2550`→`#2A3468`) |
| `--nuit-2` | `#1A2248` | marine plus sombre (panneaux, cellules foncées) |
| `--givre` | `#EDF8F9` | blanc glacé des cellules de la grille (teinte cyan) |
| `--blanc` | `#FFFFFF` | filets, titres |
| `--turquoise` | `#68CBC0` | bande légende « yeux bleus » |
| `--vert` | `#81B93F` | bande légende « yeux verts » |
| `--vermillon` | `#FB4537` | bande légende « yeux rouges » |
| `--chartreuse` | `#E5EB2E` | or acide des couronnes/casques des portraits — accent rare (meneur, CTA fort) |

Sémantique retenue : turquoise/vert/vermillon = les 3 couleurs d'yeux (légende), et par
extension : vert = oui/prêt/positif, vermillon = non/erreur, turquoise = info/sélection.
Chartreuse = « divin » : réservé au meneur, au CTA principal et à la déclaration Panthéons.

### Typographie

Le pense-bête est composé **entièrement en monospace grotesque** (titre PANTHÉONS,
sous-titre « Le Jeu des Dieux », noms des dieux, labels PANTHÉON X). Équivalent web fidèle
retenu : **Fira Mono** (400/700, fontsource). *Arbitrage* : PT Mono était le premier choix
mais ne fournit **qu'une seule graisse** (pas de 700) — inutilisable pour la hiérarchie
titres ; Fira Mono est aussi proche des lettres de l'asset et a une vraie graisse bold.
Hiérarchie par taille + casse + letter-spacing (MAJUSCULES très espacées pour les titres,
comme l'asset), jamais par changement de famille.
**Décision : suppression de `@fontsource/cinzel`** (dépendance présente mais jamais
importée ; une serif « antique » contredirait frontalement la DA du designer).

### Style graphique

- Illustration vectorielle plate, cel-shading dur, bustes de profil.
- Iconographie : pictos **filaires blancs dans un cercle** (ॐ, colonne ionique, œil
  d'Horus, triskèle) — reproduits en SVG inline pour les 4 panthéons.
- Structure tabulaire : filets blancs 1px sur marine, cellules givre, rangées numérotées.
- Motif signature : la **frise des douze** (12 portraits sur bandes de couleur d'yeux) et
  la **tri-bande** rouge/turquoise/verte utilisée comme filet décoratif.

### Portraits dérivés

Les 12 têtes ont été découpées du pense-bête (cellules détectées aux filets blancs :
x = 169 + i·181,35, y = 410, 179×213) → `client/src/ui-art/gods/<id>.png`. Usage : avatars
UI (frise landing, en-tête du pense-bête in-game, sélecteur de déclaration). Ce ne sont PAS
des cartes — les cartes restent des images finales affichées telles quelles.

## 1bis. DA re-vérifiée sur les 64 vraies faces (session 2, 2026-07-07)

Les 64 faces restaurées ont été lues une à une et comparées à la DA extraite du seul
pense-bête. **Verdict : écart modéré — extension confirmante, aucune contradiction, pas de
refonte.** Détail :

### Confirmé par les faces (la DA §1 tient)

- **Monospace grotesque partout** (titres, questions, pavés d'effets, listes de dieux) —
  Fira Mono reste le bon choix. Cadres-titres = rectangles filaires blancs, comme la grille.
- **Pictos filaires blancs cerclés** : les 4 pictos de panthéon des cartes sont ceux du
  pense-bête ; s'y ajoute un vocabulaire d'icônes pouvoirs (bombe, cible, loupe, ampoule,
  couronne, guillotine, livre, cœur fléché, tête-engrenages, cartes) — même langage filaire.
- **Sémantique tri-couleur des yeux** : sur les faces Attribut couleur, le mot-valeur est
  composé dans sa couleur (turquoise/vert/vermillon) ; les pastilles OUI/NON vert/vermillon
  de l'UI sont donc bien dans le langage des assets.
- **Chartreuse = divin** : couronnes/casques/bijoux des personnages — l'usage rare
  (meneur, CTA, déclaration) est le bon.

### Révélé par les faces (le pense-bête ne le montrait pas)

- **Couleur d'identité par catégorie** (versos + panneaux) : Attribut **sarcelle**
  `#338381`, Action **vermillon-saumon** `#F04125`→`#FBDACA`, Pouvoir **VIOLET**
  `#614BA9`→`#8A75CD` (couleur totalement absente du pense-bête), Personnage **tri-bande**
  rouge/turquoise/vert sur crème. → tokens `--sarcelle`, `--pouvoir`, `--pouvoir-clair`,
  `--saumon` ajoutés ; tuiles fallback et versos teintés par catégorie.
- **Fonds Personnage = couleur de panthéon** : hindou doré `#C58A29`, grec chartreuse pâle
  `#D6DA7B`, égyptien or olive `#C8BF5C`, nordique gris argenté `#E5E6E3` ; **bande
  diagonale = couleur d'yeux** (concorde 11/12, cf. arbitrage Ganesh §8.1). → tokens
  `--panth-*` disponibles (usage v2 possible : pense-bête grid, frises).
- **Les cartes sont CLAIRES sur fonds diagonaux ; le pense-bête est sombre.** Lecture
  retenue : la table (l'UI, fond nuit) est le document de table ; les cartes sont des
  objets clairs posés dessus. Le fond marine de l'app reste donc juste.
- **Motif diagonal** (dégradés monochromes ~70°) = signature graphique des cartes,
  complément de la tri-bande horizontale du pense-bête.
- **Ratio réel des faces : 520×804 (≈0,647), pouvoirs 733×1040 (≈0,705)** — le 5/7 supposé
  rognait les faces (`object-fit: cover`). → `--carte-ratio: 520/804` +
  `object-fit: contain` (jamais rogner une face, Décision 5).

### Corrections UI appliquées (pas de refonte)

Tokens ci-dessus ; tuiles fallback CardImage teintées par catégorie (langage des versos) ;
versos réels affichés pour toute carte face cachée (cf. §8.2) ; ratio corrigé ; landing,
lobby et structure de l'écran de jeu inchangés — la DA §1 les couvre toujours.

## 2. État des livrables

| Livrable | État | Fichiers |
|---|---|---|
| Analyse DA (palette, typo, portraits découpés) | **terminé** | §1 ; crops dans `/tmp/gods/` (à déplacer vers `client/src/ui-art/gods/`) |
| Fondations (tokens CSS, fonts, manifest assets, portraits) | **terminé** | `client/src/index.css` (système complet), `client/src/assets.ts` (glob → .webp réels), `client/src/ui-art/gods/*.png` (12 crops), `client/src/main.tsx` (PT Mono importée), `client/package.json` (+pt-mono, −cinzel), `client/src/components/{CardImage,PantheonIcon,GodFrieze}.tsx` |
| Projection enrichie (main self détaillée) | **terminé** — tests verts (engine 14, serveur 15) | `packages/engine/src/projection.ts` (`project(state, viewer, index?)` → `self.handCards`/`self.powerCards`), `projection.test.ts` (test anti-fuite ajouté), `server/src/rooms/PantheonsRoom.ts` (3 call-sites passent `this.index`) — ⚠️ [OPUS 🔒] : relecture Jules avant push |
| Landing page | **terminé** | `client/src/screens/LandingScreen.tsx` (hero titre+frise+CTA, règles 3 temps, légende axes, pied version), `client/src/App.tsx` (Toast/Centered aux classes DA), `client/src/screens/RoomScreen.tsx` (états connexion/duplicata) |
| Lobby | **terminé** | `client/src/screens/RoomLobby.tsx` (code géant + tri-bande, sièges numérotés façon grille, badges hôte/vous, états couleur légende, contrôles hôte) |
| Écran de jeu | **terminé** | `client/src/screens/GameView.tsx` (orchestration 3 phases, ciblage, déclaration, aide, fin), `client/src/components/PhaseIndicator.tsx` (barre haute : rail de phases, meneur, points de barrière), `client/src/components/BoardSlots.tsx` (plateau public, pastilles OUI/NON), `client/src/components/PenseBeteGrid.tsx` (grille dieux×adversaires, persistée sessionStorage), `client/src/components/CardImage.tsx` (image finale + tuile fallback), `client/src/i18n/fr.ts` (chaînes jeu/consignes/déclaration/aide/fin) |
| Vérification | **terminé** | engine `tsc --build` ✓ · server `tsc --build` ✓ · tests 14+15 ✓ · client `tsc --noEmit && vite build` ✓ · smoke SSR vite-node : GameView (question/réponse/fin), GodFrieze (12), PantheonIcon (4) ✓. Pas de navigateur en sandbox → captures d'écran à faire en local (`pnpm dev:client`). |

## 3. Décisions et arbitrages tranchés (avec pourquoi)

1. **DA extraite du seul pense-bête** : les faces cartes étaient indisponibles au moment
   de l'extraction. Le pense-bête étant l'artefact designer le plus complet
   (typo+palette+illustration+grille), il fait autorité. Les faces sont désormais dans le
   repo : vérifier la cohérence — pas de refonte attendue.
2. **PT Mono partout, Cinzel supprimé** : fidélité à l'asset > cliché « jeu antique ».
3. **Cartes = `<img>` statiques** via `import.meta.glob` sur
   `conversion_cartes/cartes_webp/cartes_finales/*.webp` (pas de copie — les fichiers du
   repo font foi). Fallback : tuile typographiée (CardImage) si une face manque ou ne
   charge pas.
4. **Projection enrichie** (`self` uniquement) : la main arrive en `CardId` opaques, le
   client ne peut ni afficher les faces ni construire une QuestionIntent. Ajout
   `self.handCards`/`self.powerCards`/`self.specialesInHand` résolus via le CardIndex,
   passé en 3ᵉ argument de `project()`. Conforme never-send (« le viewer voit la totalité
   de SON état secret »). ⚠️ fichier **[OPUS 🔒]** : diff à faire relire par Jules avant push.
5. **Pense-bête in-game = grille dieux × adversaires** (comme l'artefact physique : on raye
   des dieux), avec en-tête portraits + tri-état (·, ✕ éliminé, ○ suspecté), et non la
   grille axes×valeurs du prototype. Client-only, persisté en sessionStorage par room.
6. **Écran de jeu façon adaptations réussies** (Wingspan/Root/TFM, cf. §5) : on ne mime pas
   la table — adversaires en tuiles compactes cliquables (résumé compteurs), un seul
   plateau focalisé à la fois, main du joueur en grand en bas, cibles légales surlignées
   pendant la phase Question, aide « ? » contextuelle par phase.
7. **Dieu secret affiché face cachée par défaut**, révélé au survol/appui maintenu
   (anti-regard par-dessus l'épaule, et renforce le fantasme d'identité cachée).
8. **Oui/Non publiés** : pastilles VERT/VERMILLON sur la carte posée (légende du pense-bête
   réutilisée comme langage de feedback).
9. **Chartreuse = rare** : bouton « Déclarer Panthéons », badge meneur, CTA landing. Nulle
   part ailleurs, pour préserver son poids.

## 4. Prochaines étapes (dans l'ordre)

1. Fondations (tokens/fonts/assets/portraits) → 2. Projection enrichie → 3. Landing →
4. Lobby → 5. Écran de jeu → 6. Typecheck + tests + build. Reste ouvert : §9.

## 5. Références consultées (à ne pas re-consulter)

- **Wingspan digital** : cartes re-composées pour l'écran ; « ? » qui explique tout
  l'écran ; critique récurrente = on ne sait pas ce qui est cliquable → ici, surlignage
  explicite des cibles légales + bandeau d'instruction par phase.
- **BGA** : lobby simple, tables non-joignables cachées ; bruit visuel = ennemi n°1.
- **Root digital** : surligner les zones où une décision est attendue ; calculer/afficher
  l'info dérivée (ici : compteur de dieux restants par adversaire dans le pense-bête).
- **Terraforming Mars digital** : un seul focal ; taper un adversaire bascule un panneau
  fixe vers son état ; état adversaire réduit à icônes+nombres.

## 6. Points bloquants rencontrés et résolution

- **Budget Git LFS épuisé** (`git lfs pull` → "exceeded its LFS budget") : les 64 faces
  étaient des pointeurs. **Résolu le 2026-07-07** : les vrais .webp récupérés via
  `media.githubusercontent.com` (sha256 vérifiés contre les pointeurs), recommittés en
  fichiers git normaux, suivi LFS supprimé. Entre-temps la DA avait été extraite du
  pense-bête, avec fallback typographié — inchangé, il couvre tout échec de chargement.
- **Main opaque dans la projection** : résolu par l'enrichissement §3.4.
- **Playwright impossible dans la sandbox** (pas de libs navigateur) : vérification par
  typecheck + tests + build + rendu SSR-less ; captures à faire en CI/local par Jules.

## 8. Session 2 (2026-07-07) — vraies faces : transcription intégrale + logique des effets

Étapes de la session : (1) vérification des 64 faces (fichiers réels, en-têtes RIFF, plus
aucun pointeur LFS) ; (2) relecture de ce journal ; (3) lecture des 64 faces + analyse DA
comparative (§1bis) ; (4) transcription intégrale dans `docs/card-catalog.md` (plus aucun
`⟨À_TRANSCRIRE⟩` ; erratas en §7 du catalogue) ; (5) câblage complet des effets dans
l'engine + serveur + UI ; typecheck/tests/build verts (engine 39, serveur 15).

### 8.1 Arbitrages tranchés (avec pourquoi) — s'ajoutent au §3

10. **Ganesh reste `bleus`** malgré la bande **rouge** de sa carte : le pense-bête (outil
    de déduction partagé, source ratifiée, bande turquoise mesurée `rgb(104,203,193)` aux
    deux bords de sa cellule) et la symétrie 6/6 genres · 3×4 panthéons · **4/4/4 yeux**
    l'emportent ; la bande rouge de la face = contraste illustrateur (bande turquoise sur
    éléphant turquoise illisible) ou erratum. Catalogue §7 E1.
11. **Exécution** : « Quand on vous répond oui » lu « quand **vous répondez** oui » — le
    tirage Action du « oui » appartient à l'interrogé (rules.md §5) et la face accumule les
    coquilles (« déffaussé », « y'a »…). Le pouvoir se pré-déclare (cible choisie), et au
    premier « oui » répondu du tour remplace la pioche Action par la défausse du pouvoir
    visé. Catalogue §7 E5.
12. **Questions posées FACE CACHÉE** : établi par Espionnage (« regarder une question posée
    par un autre joueur ») et Spéciales 1/4 (« vous pouvez la regarder ») — publiques,
    ces cartes n'auraient aucun sens. La projection (fichier [OPUS 🔒], **diff à relire par
    Jules**) redacte : contenu visible du poseur, de la cible après résolution ; le public
    voit occupation + catégorie (verso) + oui/non. C'est une **correction du modèle** posé
    en session 1 (« placed cards are public »), décidé alors sans les faces.
13. **« Aucun oui au tour précédent »** (Refus royal, Déduction, Optimisme, Espionnage) =
    aucune de VOS questions n'a reçu « oui » au tour précédent ; **faux au tour 1** (pas de
    tour précédent raté). Suivi engine `state.lastTurn`.
14. **Choix interactifs v1 déterministes** (consignés, révisables en v2 si frustration) :
    Non 1–2 « donnez deux de vos cartes » → sélection serveur attributs d'abord, plus
    anciennes d'abord ; Spéciale 2 « choisissez deux cartes questions » → priorité à celles
    qui ciblent le propriétaire ; Spéciale 4 « mettez la dans votre case question » → la
    première question le ciblant part dans sa MAIN (approximation) ; Spéciales 7/8 : choix
    (pouvoir / valeurs d'attribut) fait au moment de la POSE, repli sommet de pile.
15. **Cibles des Spéciales 1/5/6 choisies à la pose** (payload du slot, invisible aux
    autres) — le déclenchement à la phase déclarée reste automatique, la barrière n'attend
    jamais un sous-choix.
16. **Sabotage** s'active pendant la phase Question (sur les poses déjà visibles en
    compteur) — en physique la fenêtre est entre pose et réponse ; ici la réponse se
    résout dès la barrière franchie. Une fois par tour (comme la face).
17. **Empilement d'un slot** : « deux questions au même joueur » (Concentration /
    Spéciale 9) empile 2 cartes dans le même emplacement physique →
    `Board.questionSlots: PlacedCard[][]`.
18. **Âmes sœurs** : le déclarant détenteur d'une copie n'a pas à deviner l'AUTRE
    détenteur (match automatique) ; un Clonage copiant âmes sœurs compte (« possède le
    pouvoir », littéral).
19. **Ids de cartes auto-descriptifs** (`pow_<clé>`, `act_<clé>`, `attr_<valeur>_<n>`) :
    les effets raisonnent sans CardIndex ; aucune fuite (les ids adverses ne circulent
    pas — projection testée).

### 8.2 Ce qui a été construit (session 2)

- **Catalogue** : `docs/card-catalog.md` transcription intégrale verbatim ([sic] conservés)
  + §7 erratas (Ganesh, icônes Multiple 1/5, `optimisse`→OPTIMISME, Exécution).
- **Engine** : `data/actions.ts` (27 défs réelles : questions des Non, sets des Multiple,
  phases+effets des Spéciales), `data/powers.ts` (12 défs, passif/actif), `effects.ts`
  (helpers purs), `rules.ts` (pioche/questions modulées, résolution réponse avec suivi
  `lastTurn`, Exécution, veille Spéciale 1 → `reveals`, `activatePower`),
  `declaration.ts` (âmes sœurs), `setup.ts` (deck 27, `undealtGods`, ids parlants),
  `projection.ts` (redaction + `questionRules`), types (`TurnEffects`, `LastTurnStats`,
  `SpecialePayload`, plateau en piles).
- **Serveur** : message `power`, `specialePlays` (payloads de pose), canal privé `reveal`
  (unicast — never-send), événement public `powerActivated` (équivalence physique :
  activer un pouvoir se voit).
- **Client** : plateaux à piles + versos par catégorie pour les faces cachées ; limites de
  question dynamiques (`proj.questionRules`) ; pose des Spéciales à cible via les tuiles
  adversaires ; dock pouvoir avec libellés des faces + bouton « Utiliser » (cible =
  adversaire pour Clonage/Refus royal/Exécution, carte posée pour Sabotage/Espionnage,
  direct pour Déduction) ; bannière info pour activations publiques et révélations
  privées ; tokens/teintes DA (§1bis).
- **Vérification** : engine 39 tests ✓ (19 nouveaux sur les effets, 3 sur la redaction),
  serveur 15 ✓, typecheck ✓, build ✓. Pas de navigateur en sandbox (§6) — captures à
  faire en local.

## 9. Reste ouvert pour les sessions suivantes

- ~~Transcrire les effets~~ **fait en session 2** (§8). Restent v2 : choix interactifs
  réels pour Non 1–2 / Spéciales 2‑4‑7‑8 (cf. arbitrage §8.1‑14), et revisiter la
  Spéciale 4 (« votre case question » vs main).
- **Relecture Jules ([OPUS 🔒])** : diff de `projection.ts` (redaction face cachée) et de
  `declaration.ts` (âmes sœurs) avant mise en prod de confiance.
- UI d'activation des pouvoirs : la condition « aucun oui au tour précédent » n'est pas
  pré-vérifiée côté client (le serveur rejette avec message) — pré-griser en v2 en
  exposant le flag dans la projection.
- Timeout de barrière (⟨INPUT WoG⟩) : l'UI affiche la progression de barrière, pas de
  compte à rebours tant que `deadline` reste null côté serveur.
- Le déclarant multiple est résolu serveur ; l'UI montre le résultat via la projection
  (éliminations détectées par diff, bannière) — un écran de cérémonie de révélation plus
  riche est possible en v2.
- v2 possible : pré-visualiser la carte mise en jeu directement dans le slot du plateau
  pendant le staging ; utiliser les fonds `--panth-*` dans la grille pense-bête.
- Vérification visuelle réelle (navigateur) non faite en sandbox : contrôler en local le
  rendu des versos teintés, l'empilement d'un slot à 2 cartes, la frise mobile et la
  densité de la grille pense-bête à 6 adversaires.
