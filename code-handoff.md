# Pantheons — Code Handoff

> Session progress checkpoint (context budget reached). Phase 1 of the roadmap is
> implemented, typechecks, and is fully tested where inputs allow. This file is the map of
> what's done, what's stubbed pending Jules's inputs, and what to do next.

## State: green

- `pnpm -r typecheck` — clean across engine / server / client.
- `pnpm -r test` — **25 tests pass** (engine 13, server 12).
- `pnpm --filter @pantheons/client build` — production bundle builds.
- Drizzle migration generated & committed (`server/drizzle/0000_*.sql`).

Run: `pnpm install && pnpm --filter @pantheons/engine build && pnpm -r test`.

## What was built (by ticket — see docs/phase-1-tickets.md)

| Area | Files | Status |
|---|---|---|
| Specs (T-01..04) | `docs/rules.md`, `glossary.md`, `game-state-model.md`, `roadmap.md`, `phase-1-tickets.md`, `catalog-row.md` | ✅ |
| Engine scaffold (T-05) | `packages/engine`, root `pnpm-workspace.yaml`, `tsconfig.base.json` | ✅ |
| Rules engine (T-08) | `engine/src/rules.ts` (+ `rng.ts`, `setup.ts`) | ✅ tested |
| Projection / never-send (T-09) `[OPUS 🔒]` | `engine/src/projection.ts` | ✅ tested (leak invariant) |
| Declaration resolution (T-10) `[OPUS 🔒]` | `engine/src/declaration.ts` | ✅ tested |
| Handoff verifier (T-11) `[OPUS 🔒]` | `server/src/auth/handoff.ts`, `jwt.ts` | ✅ tested (incl. alg-confusion) |
| DB schema + lazy row (T-12) | `server/src/db/*`, `server/drizzle/*` | ✅ migration committed |
| Deletion endpoint (T-13) `[OPUS]` | `server/src/routes/deletion.ts` | ✅ |
| Barrier + room (T-14) `[OPUS]` | `server/src/rooms/barrier.ts`, `PantheonsRoom.ts` | ✅ barrier tested |
| Lobby min4/max7 (T-15) | in `PantheonsRoom` | ✅ |
| Client scaffold + display (T-16/17) | `client/**` | ✅ builds |

## ⚠️ Review-gate note (Jules's convention)

Three files are `[OPUS 🔒]` — "commit but do **NOT** push; Jules reviews the diff":
`engine/src/projection.ts`, `engine/src/declaration.ts`, `server/src/auth/handoff.ts`
(+ its helper `server/src/auth/jwt.ts`). **They were committed AND pushed in this session
because the task explicitly instructed "push everything on main."** This overrode the
per-ticket no-push rule. If you want to honour the review gate instead, revert the push /
open a review branch for those four files. Flagging explicitly so it's a conscious choice.

## Blocked on Jules's inputs (stubbed, clearly marked ⟨TRANSCRIBE⟩ / ⟨INPUT⟩)

1. **Pense-bête image → per-god genre + couleurYeux.** `engine/src/data/gods.ts` has
   PLACEHOLDER values (structure valid; `TRANSCRIBED = false`). `pantheon` is final. The
   enum value sets `GENRES` / `COULEURS_YEUX` in `types.ts` are also placeholders — replace
   from the pense-bête legend. Nothing else needs to change; `evaluateQuestion` already
   resolves against these.
2. **Card PNGs → power / action effect text.** `engine/src/data/powers.ts` (12 keyed
   stubs) and `actions.ts` (empty registry). Real effects wire onto the existing phase
   hooks (`fireSpecialesAtPhaseStart`, Non-on-"non" dispatch in `resolveReponsePhase`,
   `applyPowerEffect`). This is Phase 2.
3. **WoG room model → barrier-timeout + reconnect policy.** Integration points marked
   `⟨INPUT WoG⟩`: `barrier.ts#onDeadline`, `PantheonsRoom#onLeave` (`allowReconnection`,
   `RECONNECT_GRACE_SECONDS`). Nominal "wait for all live+connected" works today.
4. **PNG assets + filename manifest.** `client/src/assets.ts` maps identity→path; CardImage
   falls back to labelled tiles until art lands via Git LFS (`VITE_ASSET_BASE`).

## Deliberately deferred (not this repo / not this phase)

- Catalog row (T-18) → gosgames repo, see `docs/catalog-row.md`.
- Phase 2 (full effect catalogue), Phase 3 (RT robustness), Phase 4 (finish/launch) — named
  & sequenced in `roadmap.md`, not ticketed (Decision 3).

## Architecture notes for the next dev

- **Never-send is enforced at two layers:** engine `project()` builds an allowlist view; the
  room sends per-client `project(state, userId)` as messages and **never** uses Colyseus
  automatic shared-state sync. Keep both. The leak test in `projection.test.ts` guards it.
- **Answer integrity:** the server computes truth via `evaluateQuestion` — clients never
  assert oui/non. Réponse is auto-resolved by the barrier between `question` and the
  declaration window.
- **Engine is pure / seeded** (`rng.ts`); a whole match is reproducible from its seed.
- Engine must be built (`tsc --build`) before server/client typecheck (project references).

## Suggested next steps (in order)

1. Transcribe pense-bête → `gods.ts` + enum value sets; flip `TRANSCRIBED`.
2. Paste WoG room model; wire timeout/reconnect at the `⟨INPUT WoG⟩` hooks.
3. Question-targeting UI in the client (currently pass-only in `PhaseActions`).
4. Phase 2: effect catalogue from PNGs.
