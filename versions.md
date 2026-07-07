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

_2026-07-07 — catalog authored; card-face effect text blocked on Git LFS._

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
   face). The **64 card faces are un-hydrated Git LFS pointers** and GitHub refuses the
   objects (**"This repository exceeded its LFS budget"**), so per-card effect text,
   Multiple god-sets, and Spéciale trigger phases are recorded as `⟨BLOQUÉ:LFS⟩`.
   **Action for Jules:** restore the LFS budget (or push the WebPs by another channel),
   then `git lfs pull` and fill the `⟨BLOQUÉ:LFS⟩` slots of `docs/card-catalog.md`.

3. **Card catalog & copy counts** ✓ — `docs/card-catalog.md` (source of truth): 12
   Personnages ×1, **9 distinct Attributs ×4 = 36** (the deduction space is closed at
   9 values: 2 genres + 3 couleurs d'yeux + 4 panthéons — the "36 distinct attributes →
   144" phrasing in this file's task list doesn't match the assets and is flagged there
   for ratification), 27 Actions ×1 (9 Non / 9 Multiple / 9 Spéciale), 12 Pouvoirs ×1.
   Every card id, kind, copy count and asset filename is recorded; engine data
   (`gods.ts`, `actions.ts`, `powers.ts`, `setup.ts`) and specs (`glossary.md`,
   `rules.md`) updated to match; engine + server test suites green. The landing page
   displays this file's version per the WoG convention.
