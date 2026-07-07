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

Phase 1 structure is complete and tested. The card catalog is authored in
[`docs/card-catalog.md`](./docs/card-catalog.md) (source of truth, versions.md 1.0.0):
the 12-god table is fully transcribed from the pense-bête, deck composition and every
card identity are fixed. Remaining inputs:

- **Card-face effect text** (powers, actions Non/Multiple/Spéciale) — the faces in
  `conversion_cartes/cartes_webp/` are plain git files (restored 2026-07-07); the texts
  are marked `⟨À_TRANSCRIRE⟩` in card-catalog.md until transcribed from the faces.
- **WoG room model** — landing/room/refresh port per `wog-room.md` (in progress).
