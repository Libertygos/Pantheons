# Panthéons — Tickets Phase 1 (phase-1-tickets.md)

> Convention Jules. **Ordre d'exécution strict, haut → bas.** Un souci par ticket. Tout
> ticket touchant le schéma DB se termine par `db:generate` + fichiers Drizzle commités.
> Les prompts **`[OPUS 🔒]`** finissent par *« Stop after commit. Do NOT push — I review
> the diff before merge. »*
>
> Étiquettes : **`[CLAUDE.AI]`** docs/spec · **`[OPUS 🔒]`** sécurité-critique, commit sans
> push · **`[OPUS]`** correctness-critique, auto-push · **`[SONNET]`** mécanique.
>
> Statut : ✅ fait dans cette session · 🔴 bloqué sur input · ⬜ à faire.

## Blocs de spec (autorité amont)

- **T-01 `[CLAUDE.AI]`** ✅ — `docs/rules.md` : ruleset complet.
- **T-02 `[CLAUDE.AI]`** ✅ — `docs/glossary.md` : vocabulaire + enums fermés.
- **T-03 `[CLAUDE.AI]`** ✅ — `docs/game-state-model.md` : état serveur, barrière,
  projection never-send, résolution déclaration.
- **T-04 `[CLAUDE.AI]`** ✅ — `docs/roadmap.md` + ce fichier de tickets.

## Données & engine (pur, sans I/O)

- **T-05 `[SONNET]`** ✅ — scaffold monorepo (`packages/engine`, `server`, `client`),
  tsconfig base, pnpm workspace.
- **T-06 `[SONNET]`** 🔴 — `engine/src/data/gods.ts` : table 12 dieux. **Panthéon rempli**
  (connu) ; **genre + couleur d'yeux = `⟨TRANSCRIBE⟩`** (input image pense-bête manquant).
  Structure + validation présentes ; valeurs à transcrire.
- **T-07 `[SONNET]`** 🔴 — `engine/src/data/{powers,actions}.ts` : catalogue de cartes.
  Structure présente ; **effets = `⟨TRANSCRIBE⟩`** (input PNG manquant).
- **T-08 `[OPUS]`** ✅ — `engine/src/rules.ts` : résolution des phases (pioche : régulariser
  pouvoir + piocher 2 attributs ; question : ≤2, ≤1/cible, pas de Spéciale en question ;
  réponse : `evaluateQuestion`, oui→pioche action, timing emplacement spécial).
- **T-09 `[OPUS 🔒]`** ✅ — `engine/src/projection.ts` : projection par joueur / frontière
  never-send + test de non-régression. *Commit, NO push.*
- **T-10 `[OPUS 🔒]`** ✅ — `engine/src/declaration.ts` : résolution « Panthéons »
  (déclarants multiples horaire depuis meneur, élimination, carte cachée). *Commit, NO push.*

## Contrats tenant

- **T-11 `[OPUS 🔒]`** ✅ — `server/src/auth/handoff.ts` : vérifieur handoff
  (`HS256`/`iss`/`aud==="pantheons"`/skew/`access`), lecture fragment, échange S-JWT.
  *Commit, NO push.*
- **T-12 `[SONNET]`** ✅ — `server/src/db/schema.ts` : clé `user_id`, ligne paresseuse
  (Drizzle). Se termine par `db:generate` + migration commitée.
- **T-13 `[OPUS]`** ✅ — `server/src/routes/deletion.ts` : `DELETE /internal/users/:id`,
  Bearer temps-constant, idempotent (`200 "deleted"`).

## Room / temps-réel / lobby

- **T-14 `[OPUS]`** ✅ — `server/src/rooms/barrier.ts` + `PantheonsRoom.ts` : driver
  server-authoritative + barrière de phases simultanées (cas nominal ; hook timeout WoG).
- **T-15 `[SONNET]`** ✅ — lobby min 4 / max 7 mirroir WoG (dans `PantheonsRoom`/`onJoin`).
  🔴 politique reconnexion/timeout précise = `⟨INPUT WoG⟩`.

## Client / affichage statique

- **T-16 `[SONNET]`** ✅ — scaffold client (Vite/React), i18n FR, entrée handoff (fragment).
- **T-17 `[SONNET]`** ✅ — composants d'affichage sur PNG immuables : `CardImage`,
  `BoardSlots`, `PenseBeteGrid` (état client-only), `PhaseIndicator`, `Lobby`.

## Catalogue (repo gosgames séparé — hors ce repo)

- **T-18 `[SONNET]`** ⬜ — ligne catalogue (`slug: pantheons`, min/max 4/7, tagline FR,
  `card_art` LFS). **Effet de bord côté repo gosgames**, pas ici. Documenté dans
  `docs/catalog-row.md`.

## Inputs bloquants (résumé)

| Input | Bloque | Statut |
|---|---|---|
| Image pense-bête (genre + couleur d'yeux par dieu) | T-06, résolution réponse réelle | manquant |
| PNG effets pouvoirs / actions | T-07, Phase 2 | manquant |
| Modèle room WoG (barrière/déco/reconnexion) | T-14/T-15 politique timeout, T-15 reconnexion | manquant |
| Assets PNG + manifest | affichage réel client | manquant |
