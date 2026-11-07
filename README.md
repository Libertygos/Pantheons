# Panthéons — Le jeu des Dieux

Hidden-identity social-deduction game for 4–7 players, ages 10 and over, 45–60 minutes, built as a **gosgames** tenant.
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
                  deletion endpoint, simultaneous-phase barrier (one validation per player
                  per phase, atomic question submission, 30 s declaration + Sabotage windows),
                  per-seat redaction of state and events, lobby (min4/max7). Drizzle/PG.
client            Vite/React. Static-PNG display (cards, board, pense-bête), FR chrome.
docs              rules.md · glossary.md · game-state-model.md · roadmap.md · card-catalog.md
```

## Develop

```bash
pnpm install
pnpm --filter @pantheons/engine build   # engine must build first (project references)
pnpm test                               # engine + server tests
pnpm dev:server                         # needs .env (see .env.example)
pnpm dev:client
```

## Rules in one paragraph

Each player holds a secret god among 12 (the undealt ones stay out of the game); powers are
public. A turn has three simultaneous phases: Pioche, Question (up to 2 questions, face down;
one Spéciale), Réponse (the server answers each question truthfully; whoever asked draws an
Action on a « oui »). After the answers a shared 30 s window lets players declare
« Panthéons » (a guess per opponent): all right wins, a first mistake eliminates, last player
in play wins. Gods are revealed to all only when the game ends. Full text:
[`docs/rules.md`](./docs/rules.md); who sees what: rules.md « Qui voit quoi ».

## Status

Phase 1 is implemented and tested, with the rules of the 2026-11-07 review in. The card
catalog is authored in [`docs/card-catalog.md`](./docs/card-catalog.md) (source of truth).
Remaining: card-face effect text still marked `⟨À_TRANSCRIRE⟩` there, and the WoG room
model port (`wog-room.md`).
