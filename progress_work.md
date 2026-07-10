# Progress — Fix serveur broadcast pioche/déclaration (session du 2026-07-10)

## État : TERMINÉ et poussé sur main

Suivi n°1 du patch Visual V2 QoL (`d00063b`) : le fix serveur recommandé est appliqué et le
contournement client (sondage) retiré.

## Ce qui a été fait

### Fix serveur (`server/src/rooms/PantheonsRoom.ts`)
- Les handlers `pioche` et `declaration` appellent désormais `this.broadcastProjections()`
  après la soumission, à l'image des handlers `question` et `power`. Les projections
  par-siège sont donc poussées en COURS de phase pour toutes les soumissions — plus
  seulement aux changements de phase.
- L'appel reste DANS le callback de `guard` : une soumission rejetée (throw) n'émet rien,
  l'expéditeur reçoit l'unicast `error` comme avant.

### Nettoyage client (devenu inutile)
- `GameView.tsx` : suppression du sondage (`setInterval` REQUEST_STATE 2,5s pendant
  pioche/réponse) et de `askRefresh()` + ses trois appels (submitPioche, passReponse,
  submitDeclaration). Les coches et chips sont désormais pilotés uniquement par les
  projections diffusées.
- `RoomScreen.tsx` : le handler `RECONNECT_OK` persistant RESTE (il sert la reconnexion
  mi-partie) ; seul son commentaire a été actualisé.

## Vérification (partie réelle, 2 joueurs — recette consignée dans `.claude/skills/verify/SKILL.md`)

Stack réelle (Postgres local + serveur + SPA buildée), hôte navigateur (Playwright) +
second joueur colyseus.js headless. Observé en jeu :
- Chip « ✓ Validé » de l'hôte 67ms après Valider la pioche (l'hôte soumet en premier —
  la confirmation vient bien du nouveau broadcast, plus d'askRefresh).
- Coche adverse mi-phase : ~6–8ms après la soumission bot (déclaration tour 1, pioche
  tour 2) — contre ~2,5s avec l'ancien sondage.
- Chip « ✓ Passé » + consigne « Vous avez passé — en attente de BotB… » 77ms après le
  Passer de l'hôte en réponse (bot en attente).
- 2 tours complets, 0 trame REQUEST_STATE émise par la page, 0 erreur console.
- Sonde : double envoi `pioche` par le bot → accepté silencieusement (pas d'erreur), pas
  de crash, la partie continue. PRÉ-EXISTANT (voir suivis).
- Typecheck + build + tests (39 engine + 17 server) verts.

## Reste à faire (suivis optionnels)

1. **Garde de resoumission côté barrière** (pré-existant, non introduit ici) : un second
   message `pioche` du même joueur pendant la même phase ré-exécute `applyPioche` et
   re-pioche 2 attributs (observé : bot à 6 attributs au tour 2). L'UI verrouille le
   bouton donc injouable au clavier/souris, mais un client modifié peut gonfler sa main.
   Fix simple : dans `barrier.ts`, ignorer (ou rejeter) une soumission si
   `state.barrier.submitted.includes(userId)`.
2. Bump `versions.md` (1.2.1) si une release est taguée — comme pour `d00063b`, ce commit
   part sans bump.
3. Toujours non observés en direct : le spinner à 200ms et le battement de la poignée
   (fenêtres trop courtes en partie à 2 ; mécanisme testé par code).
4. Mineur (présentation, patch QoL précédent) : à 1440px avec le tiroir ouvert, la
   poignée « PENSE-BÊTE » chevauche légèrement le chip « ✓ Passé » et les coches du
   traqueur (voir capture t2-reponse-host-chip de la session).
