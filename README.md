# Panthéons — Le jeu des Dieux

Hidden-identity social-deduction game for 4–7 players, built as a **gosgames** tenant.
Deduce which of the 12 gods hides behind each opponent while keeping your own hidden, to a
single climactic **« Panthéons »** reveal.

> Design authority: [`pantheons-design-decisions.md`](./pantheons-design-decisions.md)
> (ratified 2026-07-01). Specs in [`docs/`](./docs). This repo implements **Phase 1** of the
> roadmap. French only, by design (Decision 7).

## Layout

```
packages/engine   Pure rules/state — no I/O (Decision 2). Gods, cards, phase rules,
                  per-player never-send projection, "Panthéons" resolution. Fully tested.
server            Colyseus rooms + Express. Handoff verify (aud=pantheons), session S-JWT,
                  deletion endpoint, simultaneous-phase barrier, lobby (min4/max7). Drizzle/PG.
client            Vite/React. Static-PNG display (cards, board, pense-bête), FR chrome.
docs              rules.md · glossary.md · game-state-model.md · roadmap.md · phase-1-tickets.md
```

## Develop

```bash
pnpm install
pnpm --filter @pantheons/engine build   # engine must build first (project references)
pnpm test                               # engine + server tests
pnpm dev:server                         # needs .env (see .env.example)
pnpm dev:client
```

## Status & missing inputs

Phase 1 structure is complete and tested. Some values are placeholders pending assets Jules
must supply (see [`docs/phase-1-tickets.md`](./docs/phase-1-tickets.md) and
[`code-handoff.md`](./code-handoff.md)):

- **Pense-bête image** → per-god `genre` + `couleurYeux` (marked `⟨TRANSCRIBE⟩` in
  `packages/engine/src/data/gods.ts`; placeholder values so the engine runs/tests).
- **Card PNGs** → power / action effect text (`data/powers.ts`, `data/actions.ts`).
- **WoG room model** → exact barrier-timeout / reconnect policy (`⟨INPUT WoG⟩` hooks).
- **PNG assets + manifest** → real card art (client renders filenames, art via Git LFS).
