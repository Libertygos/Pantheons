# Progress — Remontée des parties vers la plateforme gosgames (session du 2026-07-15)

## État : TERMINÉ et poussé sur main

Volet Pantheons du contrat gosgames TICKET-102 : à la fin de chaque partie, le serveur
remonte le résultat brut à la plateforme (`POST /api/internal/matches`) pour alimenter
les stats admin et la table `matches`.

## Ce qui a été fait

### Nouveau module `server/src/http/matchReport.ts`
- `reportMatch({ playerAccountIds, startedAt, endedAt })` → POST
  `{GOSGAMES_INTERNAL_URL}/api/internal/matches`, header `X-Internal-Token` =
  `INTERNAL_SERVICE_TOKEN` (le MÊME jeton partagé que l'endpoint de suppression entrant —
  un seul jeton de service plateforme↔jeu).
- Le corps suit le contrat TICKET-102 : `{ gameSlug: 'pantheons', playerAccountIds,
  startedAt, endedAt }` (ISO). La plateforme calcule elle-même `playerCount` et
  `isTestMatch` (2 joueurs + un admin) — on n'envoie que des faits bruts.
- **Best-effort par construction** : sans `GOSGAMES_INTERNAL_URL`/jeton (dev local) c'est
  un no-op silencieux ; un POST refusé ou un réseau en panne se contente de logger.
  La remontée de stats ne doit jamais casser le flux de jeu.

### Câblage `server/src/rooms/PantheonsRoom.ts`
- `startMatch()` fige les faits : `matchStartedAt = new Date()` et `matchPlayerIds`
  (les sièges sont verrouillés par `lock()`, la composition ne bouge plus).
- `onPhaseEvent` : sur `gameOver`, remontée unique (garde `matchReported`).
- **Arbitrage** : seules les parties TERMINÉES (`gameOver`) sont remontées. Une room
  abandonnée (dispose sans gameOver) n'est pas « une partie jouée » pour les stats.

### Tests (`matchReport.test.ts`, node:test, fetch mocké)
- Contrat exact (URL, header, corps ISO), no-op sans config, aucune exception sur
  400/panne réseau. 20/20 tests serveur verts, typecheck OK.

## Déploiement (repo homelab, même session)
- `infra/pantheons/deployment.yaml` : env `INTERNAL_SERVICE_TOKEN` (secret existant
  `gosgames-internal-token`, namespace gosgames) + `GOSGAMES_INTERNAL_URL` pointant sur
  le Service gosgames interne au cluster.

## Suivis hérités de la session précédente (2026-07-10, toujours ouverts)

1. **Garde de resoumission côté barrière** (pré-existant) : un second message `pioche`
   du même joueur pendant la même phase ré-exécute `applyPioche` et re-pioche 2
   attributs. L'UI verrouille le bouton, mais un client modifié peut gonfler sa main.
   Fix simple : dans `barrier.ts`, ignorer une soumission si
   `state.barrier.submitted.includes(userId)`.
2. Bump `versions.md` (1.2.1) si une release est taguée.
3. Non observés en direct : spinner à 200ms, battement de la poignée (testés par code).
4. Mineur (présentation) : à 1440px tiroir ouvert, la poignée « PENSE-BÊTE » chevauche
   le chip « ✓ Passé ».
