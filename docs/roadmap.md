# Panthéons — Feuille de route par phases (roadmap.md)

> Décision 3 : **Phase 1 entièrement ticketée et ordonnée** ; Phases 2+ nommées,
> séquencées, dépendances notées, **non ticketées** tant que l'exécution de Phase 1 n'a pas
> stabilisé le modèle d'état.

## Phase 1 — Fondation jouable (livrée — tickets exécutés puis retirés du dépôt)

Objectif : une partie 4–7 joueurs complète, server-authoritative, sur assets statiques,
avec la discipline never-send et les contrats tenant en place.

Contenu :
- Contrats tenant : handoff verify (`aud==="pantheons"`), clé `user_id` + ligne paresseuse,
  endpoint de suppression.
- Package `engine` : données (dieux/cartes/pouvoirs — placeholders `⟨TRANSCRIBE⟩`), types,
  règles de phase (pioche/question/réponse, oui→pioche action, contraintes 2-questions,
  timing emplacement spécial), projection never-send, résolution de déclaration.
- Driver room + barrière (Colyseus) mirroir WoG.
- Lobby (min 4 / max 7) mirroir WoG.
- Affichage d'assets statiques (cartes, emplacements plateau, grille pense-bête) sur PNG
  immuables.
- Catalog-metadata wiring (côté plateforme, séparé).

**Sortie de Phase 1** = point où le modèle d'état est éprouvé → re-ticketing des phases
suivantes possible.

## Phase 2 — Catalogue d'effets complet (nommée, non ticketée)

Transcription et implémentation des **12 pouvoirs** et de **chaque effet Action** (Non /
Multiple / Spéciale) depuis les PNG. Dépend de : engine rules Phase 1 (hooks d'effet),
asset manifest complet. Séquencé après Phase 1 car chaque effet se branche sur des hooks de
phase qui n'existent qu'une fois la barrière/règles stabilisées.

## Phase 3 — Robustesse temps-réel (nommée, non ticketée)

Politique de timeout de barrière WoG intégrée, reconnexion complète copiée de WoG,
spectateur/rejoin, résilience aux déconnexions multiples. Dépend de : `⟨INPUT WoG⟩` collé.

## Phase 4 — Finition & lancement (nommée, non ticketée)

Polish UI/chrome FR, animations de révélation « Panthéons », `released_at` fixé,
`card_art` référencé par le catalogue, télémétrie/observabilité (mirroir homelab
ServiceMonitor `release: monitoring`).

## Réservé (Décision — deferred)

- Extraction d'un package engine cross-game partagé : **pas à n=2**, reconsidérer aux jeux
  #3–4.
