# Version 1.1.1

## Retours de mise en prod : pseudo, barre de navigation, partie de test admin

Session 3 (2026-07-07), premiers retours après la mise en ligne.

1. **Pseudo dans le lobby** — la plateforme émet le nom d'affichage dans la claim
   `username` du handoff token (gosgames `handoffMint.ts`) ; Panthéons lisait
   `displayName`, toujours absente, et retombait sur l'user_id brut (UUID). Le
   vérificateur lit désormais `username` (fallback `displayName`), la session S-JWT et
   la réponse `/auth/exchange` transportent le nom jusqu'au client (landing + lobby).
2. **Barre de navigation** — port du TopBar WoG dans la DA du pense-bête
   (`.barre-nav`, sticky) : logo GG → portail gosgames, « Panthéons » → accueil,
   pseudo → gosgames.com/account, Déconnexion (efface session + resume locaux puis
   renvoie au portail). Affichée sur l'accueil et le lobby ; la partie garde son
   propre chrome, comme WoG.
3. **Partie de test à 2 joueurs (admin)** — `ADMIN_USER_IDS` (env serveur, user_id
   plateforme séparés par des virgules) : quand l'hôte du salon est admin, le minimum
   effectif de sièges tombe à 2 (retrait de sièges, `canStart`, libellés) ; le moteur
   accepte 2..7 (`ABSOLUTE_MIN_PLAYERS`), la règle des 4 reste la politique de lobby
   pour tout hôte normal.

# Version 1.1.0

## Vraies faces : transcription intégrale + logique des effets + DA re-vérifiée

Session 2 (2026-07-07). Les 64 faces de cartes, indisponibles en 1.0.0 (pointeurs LFS),
sont des fichiers git normaux depuis la fin de session 1 — cette version accomplit le
mandat original de 1.0.0 (« read every .webp and define the logic of every card »).

### Claude code done

1. **Vérification des assets** ✓ — 64/64 faces réelles (en-têtes RIFF, aucun pointeur).
2. **DA re-analysée sur les vraies faces** ✓ — écart modéré, extension sans contradiction
   (PANTHEONS_PROGRESS.md §1bis) : couleurs d'identité par catégorie (Attribut sarcelle
   `#338381`, Action vermillon-saumon, **Pouvoir violet `#614BA9`** — absent du
   pense-bête), fonds Personnage = couleur de panthéon, bande diagonale = couleur d'yeux,
   ratio réel 520×804 (le 5/7 supposé rognait les faces). Tokens + tuiles fallback +
   versos par catégorie + `object-fit: contain` appliqués ; landing/lobby inchangés.
3. **Catalogue transcrit à 100 %** ✓ — `docs/card-catalog.md` : 12 pouvoirs, 9 Non
   (chacune porte SA question — les 9 valeurs d'attribut — + malus par axe), 9 Multiple
   (sets de 4 dieux verbatim, sans effet additionnel), 9 Spéciales (texte + phase
   imprimée), questions Attribut verbatim. Plus aucun `⟨À_TRANSCRIRE⟩`. **Erratas
   d'assets** consignés (§7) : bande Ganesh rouge vs pense-bête turquoise (→ `bleus`
   canonique), icônes interverties (Multiple 1/5), fichier `optimisse` titré
   **OPTIMISME**, formulation d'Exécution.
4. **Logique câblée de bout en bout** ✓ — engine : effets Non/Spéciales/pouvoirs réels
   (modificateurs de pioche et de questions, suivi « aucun oui au tour précédent »,
   activations validées une fois par tour, âmes sœurs à la déclaration, deck 27 cartes) ;
   serveur : message `power`, payloads de pose des Spéciales, canal privé `reveal`
   (never-send) ; client : limites dynamiques, Spéciales à cible, dock pouvoir
   activable, plateaux à piles. **Découverte de modèle** : les faces (Espionnage,
   Spéciales 1/4) prouvent que les questions posées sont **face cachée** → redaction
   par viewer dans `projection.ts` ([OPUS 🔒] — relecture Jules), versos affichés.
5. **Vérification** ✓ — engine 39 tests (dont 19 effets + 3 redaction), serveur 15,
   typecheck et build verts. Arbitrages détaillés : PANTHEONS_PROGRESS.md §8.1.

# Version 1.0.0

## Bootstrap: define the Pantheons card catalog from the source art

Pantheons is a **different game from War of Guilds** (WoG), but it reuses WoG's proven
landing-page, game-room, and refresh/resume architecture. The room/lobby/refresh port is
already written up in `wog-room.md` at the root of this project — read that first for the
networking, lobby, and reconnection model. Pantheons has **12 characters (gods)** instead of
WoG's 10, which is what makes a 4–7-player table keep the "no deduction by elimination" hidden-
information property intact (12 − 7 = 5 characters always set aside, comfortably ≥ 4).

This first version has **no gameplay code yet** — its whole job is to establish the
**authoritative card catalog and card logic** from the source card art.

### Claude code tasks

First tasks, in order:

1. **Read the current files from the WoG repo** (`../war-of-guilds`) as the reference
   implementation — the pnpm monorepo layout (`packages/engine`, `apps/server`,
   `apps/client`), the engine purity rules, the thin authoritative server, the per-seat
   projection / hidden-information model, and the landing/room/refresh behaviour summarized in
   `wog-room.md`. Pantheons follows the same architecture; only the game content differs.

2. **Read every `.webp` image in the folder `conversion_cartes/`** and use them to define:
   - the **logic of every card** (what each card does, its cost/effect/timing), and
   - the **attributes of all 12 gods** (each god's identity, its attributes and powers).

   Every card is present in `conversion_cartes/` (all cards + a **pense-bête / cheat-sheet**).
   The catalog derived here becomes the source of truth for the engine data, exactly as
   WoG's `gameplay.md` + `mandate.md` are for WoG.

3. **Card catalog & copy counts.** The deck is built from these card kinds and copy counts:
   - **Attributes** — **36 distinct attributes**, **4 copies of each** → **144 attribute
     cards** total.
   - **Actions** — **one copy of each** action card.
   - **Characters (gods)** — **one copy of each** of the **12** god cards.
   - **Pouvoirs (powers)** — **one copy of each** power card.

   Record, per card: its id, kind (attribute / action / character / pouvoir), copy count, and
   its full rule/effect logic as read from the art. Cross-check against the pense-bête so no
   card is missing and no logic contradicts it.

Deliverable of 1.0.0: a complete, authoritative Pantheons card catalog (all cards, all god
attributes, all copy counts) written as the project's source-of-truth spec — the basis every
later engine/server/client version implements against.

Convention carried over from WoG: display **version X.Y.Z** at the bottom of the landing page,
read from this file's topmost `# Version` heading. Keep this `versions.md` the running record —
newest version on top, each with `### Claude code tasks` then `### Claude code done`.

### Claude code done

_2026-07-07 — catalog authored; card faces restored as plain git files (ex-LFS); effect
text transcription pending._

1. **WoG reference read** ✓ — `wog-room.md` (the authoritative extraction) + the local
   `../war-of-guilds` checkout. The landing/room/refresh model was ported into Pantheons in
   the same pass: server room codes + registry + `GET /api/rooms/:code/exists`, host/ready
   lobby with ADD_SEAT/REMOVE_SEAT (min 4 / max 7), 60 s lobby & match reconnection grace,
   duplicate-account rejection (`ALREADY_IN_ROOM`), ≥2-concurrent-drops abort back to a
   fresh lobby; client landing (create / join-by-code / resume auto-redirect), room
   acquisition state machine (adopt / probe / reconnect / fresh-join / duplicate view),
   `localStorage` resume record with rotated-token re-persist, active-room baton, and
   `leave(false)` teardown on refresh.

2. **Art read** — partial, externally blocked. `Pense_Bête.webp` is hydrated and fully
   transcribed: the 12-god table (genre / couleur des yeux / panthéon) is complete in
   `docs/card-catalog.md` §1 and `packages/engine/src/data/gods.ts` (`TRANSCRIBED = true`;
   one caveat: Ganesh's iris is stylised — `bleus` from his band, re-confirm on his card
   face). The 64 card faces were un-hydrated Git LFS pointers behind an exhausted LFS
   budget; **restored 2026-07-07**: the real WebPs were recovered from GitHub's
   `media.githubusercontent.com` endpoint (sha256-verified against the pointers),
   recommitted as plain git files, and LFS tracking removed. Per-card effect text,
   Multiple god-sets, and Spéciale trigger phases remain recorded as `⟨À_TRANSCRIRE⟩`
   until transcribed from the faces into `docs/card-catalog.md`.

3. **Card catalog & copy counts** ✓ — `docs/card-catalog.md` (source of truth): 12
   Personnages ×1, **9 distinct Attributs ×4 = 36** (the deduction space is closed at
   9 values: 2 genres + 3 couleurs d'yeux + 4 panthéons — the "36 distinct attributes →
   144" phrasing in this file's task list doesn't match the assets and is flagged there
   for ratification), 27 Actions ×1 (9 Non / 9 Multiple / 9 Spéciale), 12 Pouvoirs ×1.
   Every card id, kind, copy count and asset filename is recorded; engine data
   (`gods.ts`, `actions.ts`, `powers.ts`, `setup.ts`) and specs (`glossary.md`,
   `rules.md`) updated to match; engine + server test suites green. The landing page
   displays this file's version per the WoG convention.

4. **Launch (2026-07-07)** ✓ — full playable UI (landing / lobby / game screens, DA from
   the pense-bête, cf. `PANTHEONS_PROGRESS.md`) plus the production layer mirroring WoG:
   server `/healthz/ready` (DB ping) + `/metrics` (Prometheus gauges) + `CLIENT_DIST` +
   idempotent drizzle migrations at boot; `Dockerfile`/`.dockerignore` (versions.md kept
   in context — vite stamps the version from it); `.github/workflows/ci.yml` (typecheck →
   tests → build → GHCR image `ghcr.io/libertygos/pantheons` → homelab newTag retarget).
   Card faces are plain git files since 2026-07-07, so a normal checkout bakes the real
   card art (no `lfs: true` needed). Deployed at **pantheons.gosgames.com** via
   `homelab/infra/pantheons` (ArgoCD app, Traefik IngressRoute, cert, CNPG `pantheons`
   DB). **Actions for Jules:** add the `HOMELAB_DEPLOY_TOKEN` secret to this repo (same
   PAT as WoG) for future auto-deploys, and seed the platform catalog so Pantheons shows
   as `live` on www.gosgames.com.
