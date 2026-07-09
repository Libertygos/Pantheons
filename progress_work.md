# Progress — Visual V2 QoL Patch (session du 2026-07-09)

## État : TERMINÉ et poussé sur main

Commit `d00063b` — `feat(client): visual v2 qol — card inspect, réponse pense-bête, drawer handle, action feedback` (poussé sur `origin/main`). Présentation seule : **zéro diff moteur / serveur / protocole**. Typecheck + build + tests (39 engine + 17 server) verts, vérifié en conteneur node:22.

## Ce qui a été fait

### 1. Loupe d'inspection universelle (Change 1)
- **Nouveaux fichiers** : `client/src/components/card-inspect.ts` (magasin singleton + hook `useCardInspect` : survol ≥180ms pointeur fin, focus clavier `:focus-visible`, tabindex auto si pas d'enveloppe focusable) et `client/src/components/CardInspectLayer.tsx` (portail `document.body`, hauteur min(480px, 55vh), ratio préservé, placement droite→gauche→dessus/dessous clampé au viewport, `pointer-events: none`, z-index 950, ESC capté avant le tiroir, fermeture au scroll/resize).
- `GameCard` : prop `inspect` (défaut actif sur toute face visible) ; vols transients exclus ; face cachée jamais inspectable.
- Couverture : main (les cartes verrouillées passent de `disabled` à `aria-disabled` pour rester survolables/focusables hors phase question — sélecteurs CSS mis à jour), cartes posées (`PlacedMiniCard`), carte pouvoir, portraits d'en-tête du pense-bête, sélecteur de déclaration (`DeclDieu`), défausse de pouvoir, carte du vainqueur.
- **Dieu du dock** : plus de flip 3D ; MAINTENIR POUR RÉVÉLER affiche la face en grand via la loupe pendant l'appui (pointeur ou Espace/Entrée). L'identité (face + aria-label) n'est montée dans le DOM **que pendant l'appui** ; le survol seul ne montre rien.
- `godCardFace()` ajouté à `card-text.ts`.

### 2. Pense-bête phase réponse (Change 2)
- Auto-ouverture **non modale** au début de chaque phase réponse (edge-trigger par tour via `autoOpenedTour`) : pas de voile, pas de vol de focus ; une fermeture manuelle vaut pour tout le tour. Ouverture manuelle par la poignée = mode modal historique (voile + focus).
- En mode flottant, `jeu--tiroir-flottant` réserve la place du tiroir (padding-right ≥1200px, reflux d'état instantané) — consigne, actions Passer/Déclarer et sièges restent visibles et cliquables (vérifié à 1440px : actions à x=610, tiroir à x=644).
- **Colonne « Réponses »** en tête de grille (avant la colonne joueur) : réponses publiques du tour par adversaire, mini-carte (face si visible pour ce spectateur, sinon verso de catégorie) + pastille ✓ OUI / ✗ NON (icône + couleur), tiret si vide, vidée à chaque tour (les plateaux sont purgés par `advanceTurn` côté moteur — dérivé de `boardBySeat[].questionSlots[].answeredOui`, aucune extension de protocole).
- Grille redimensionnée : tiroir `min(780px, 94vw)` (`--tiroir-larg`), colonnes `92px 78px repeat(12, minmax(44px, 1fr))`, `width: 100%` — **aucun défilement horizontal interne à 1440px** (scrollWidth == clientWidth vérifié).

### 3. Poignée de tiroir (Change 3)
- Onglet vertical permanent au bord droit (`.tiroir-poignee`, icône + texte vertical, liseré turquoise), translateX seul, chevauche le bord gauche du tiroir ouvert (même contrôle spatial), z 58 (au-dessus du voile 56 et du tiroir 57).
- Un battement d'attention à l'ouverture de la réponse (propriété `scale`, coupé sous reduced-motion, état nettoyé par timeout JS).
- Ancien bouton de la barre de navigation supprimé (`GameTopBar` sans props notes).

### 4. Cycle des actions de phase (Change 4)
- États : actionnable → **envoyé** (`btn--envoi` : enfoncé translateY(1px) + ombre rentrée, spinner après 200ms — jamais gris) → **confirmé** (chip `✓ Validé / Passé`, `role="status"`, pop back-out 200ms) piloté par `barrier.youSubmitted` (autorité serveur ; seul l'état « envoyé » est client-local).
- Rejet serveur → retour actionnable via `rejectNonce` (compteur incrémenté sur chaque message `error` dans `RoomScreen`) + notice existante.
- Consigne au passé nommant les joueurs attendus (`fr.fait.*`) ; coches du traqueur avec états explicites `--ok` / `--attente` + micro-pop (`coche-pop`), même source que le chip.
- Boutons couverts : Valider la pioche (traqueur + modale défausse), Valider N questions / Passer sans question, Poser spéciale (verrouillé pendant l'envoi), Passer, Déclarer + confirmation de déclaration.
- **Découverte importante** : le serveur ne diffuse des projections que sur `question`/`power` et aux changements de phase — les soumissions `pioche`/`declaration` ne poussent rien en cours de phase. Contournement 100 % vue avec le protocole existant : re-demande de son état (`REQUEST_STATE` → `RECONNECT_OK`, handler persistant ajouté dans `RoomScreen`) juste après l'envoi (ack immédiat) + sondage léger toutes les 2,5s pendant pioche/réponse tant qu'il manque des coches.

### i18n / CSS
- `fr.ts` : bloc `fait.*` (Validé/Passé/formes au passé/en attente de…), `penseBete.reponses` / `aucuneReponse` ; `jeu.enAttente` supprimé (remplacé).
- `index.css` : sections QoL (loupe, poignée, tiroir flottant, colonne réponses, cycle d'action) ; transform/opacity uniquement ; repli reduced-motion effet par effet (le spinner reste animé — il porte un état ; poignée sans battement ; le reste s'effondre via les jetons de durée).

## Vérification effectuée (partie réelle, 2 joueurs)

Stack dockerisée (Postgres + serveur + SPA buildée, tokens handoff auto-signés, `ADMIN_USER_IDS` pour partie à 2) + bot second joueur en colyseus.js headless + navigateur piloté. Confirmé en jeu : loupe (main verrouillée incluse, carte posée, pouvoir, portraits — taille ~460px, dans le viewport, une seule à la fois, ESC ne ferme que la loupe puis le tiroir), dieu à l'appui (identité absente avant/après, « Athena » pendant), auto-ouverture non modale + voile en manuel, colonne Réponses en direct (« Féminin ✗ Non »), zéro scroll horizontal à 1440, chip « ✓ Passé » + « Vous avez passé — en attente de BotB… » + coche perso synchrone, coche adverse arrivée en ~2,5s en cours de phase (sondage), reconnexion mi-partie OK, aucune erreur console. Recette complète consignée dans la mémoire de session (`pantheons-e2e-verify-recipe`).

## En cours

Rien — la tâche est terminée et poussée.

## Reste à faire (suivis optionnels, hors périmètre de ce patch)

1. **Fix serveur recommandé** (chip de tâche déjà proposé, `task_81a44d2d`) : ajouter `this.broadcastProjections()` aux handlers `pioche` et `declaration` de `PantheonsRoom.ts` (2 lignes, à l'image du handler `question`), puis retirer le sondage client (`askRefresh` + effet d'intervalle dans `GameView.tsx`) devenu inutile. Le handler `RECONNECT_OK` de `RoomScreen` peut rester (sert aussi la reconnexion).
2. Éventuel bump `versions.md` (1.2.1) si convention de release — le patch est un commit `feat(client)` sans bump, comme les commits Visual V2 intermédiaires.
3. Non observé en direct (fenêtres trop courtes en partie à 2, mécanisme testé par code) : le spinner à 200ms et le battement de la poignée — à regarder à l'occasion d'une vraie partie.
