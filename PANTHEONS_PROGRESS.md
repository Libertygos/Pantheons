# PANTHEONS_PROGRESS.md — journal de construction de l'interface

> Fichier de continuité. Objectif : « lis ce fichier et reprends tes travaux » doit suffire
> pour reprendre sans perte. Mis à jour après chaque étape significative.
> Session 1 démarrée le 2026-07-07.

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
4. Lobby → 5. Écran de jeu → 6. Typecheck + tests + build. Reste ouvert : §7.

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

## 7. Reste ouvert pour les sessions suivantes

- Faces restaurées (2026-07-07) : vérifier le rendu réel des cartes (ratio supposé 5:7),
  transcrire les effets dans `docs/card-catalog.md` (hors scope UI).
- Phase Question : l'UI pose des Attributs et Actions-questions ; les Spéciales sont
  posables (slot dédié) mais leurs effets sont des stubs engine (⟨À_TRANSCRIRE⟩).
- Timeout de barrière (⟨INPUT WoG⟩) : l'UI affiche la progression de barrière, pas de
  compte à rebours tant que `deadline` reste null côté serveur.
- Le déclarant multiple est résolu serveur ; l'UI montre le résultat via la projection
  (éliminations détectées par diff, bannière) — un écran de cérémonie de révélation plus
  riche est possible en v2.
- v2 possible : pré-visualiser la carte mise en jeu directement dans le slot du plateau
  pendant le staging de la phase Question (aujourd'hui : note « → cible · Retirer » sous la
  carte en main + tuile adversaire marquée « Ciblé »).
- Vérification visuelle réelle (navigateur) non faite en sandbox : à la première ouverture
  locale, contrôler l'échelle de la frise sur mobile et la densité de la grille pense-bête
  à 6 adversaires.
