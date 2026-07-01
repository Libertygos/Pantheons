# Pantheons — Design Decision Record

> **Status:** Ratified by Jules (architect + final authority), 2026-07-01.
> **Purpose:** frozen, upfront design decisions for the Pantheons game — a gosgames
> platform tenant. This record is the input to a later build chat that will author the
> full spec docs, the phased roadmap, and the Phase-1 ticket set.
> **Method:** guided one-item decision review over the seed list; every decision below
> carries Jules's ratification. Downstream chats treat this record as authoritative and
> do not re-open ratified items.

---

## Project summary — what Pantheons is

Pantheons (*Panthéons — Le jeu des Dieux*) is a **hidden-identity social-deduction
game** for **4–7 players**. Each player is secretly dealt one of **12 gods**; the goal
is to deduce which god hides behind every opponent while keeping your own god hidden.
Structurally it is "Guess Who" crossed with a hidden-role game, played to a single
climactic reveal.

**The 12 gods** are organised into **4 pantheons of 3 gods each** — Hindou, Grec,
Égyptien, Nordique. Every god is defined by exactly **3 attributes**: **gender**,
**eye colour**, and **pantheon**. These three attributes are the entire deduction
space: every question a player asks resolves against them. The roster read from the
pense-bête is: **Brahma, Ganesh, Sarasvati** (Hindou); **Zeus, Athena, Artemis**
(Grec); **Rê, Bastet, Isis** (Égyptien); **Loki, Odin, Frigg** (Nordique). *(The exact
gender + eye-colour value per god must be transcribed from the pense-bête image, not
inferred — see Inputs.)*

**Turn structure.** A rotating *meneur* (clockwise each turn) orders the answer phase
but does **not** serialise play. Each turn runs **three phases simultaneously** for all
players:

1. **Pioche (draw)** — ensure exactly one power (draw one if you have none; discard
   down to one if you have two), then draw **2 attribute cards**.
2. **Question** — play **up to 2 questions**, never two to the same player. A question
   is an attribute card or an action card (except Spéciales).
3. **Réponse (answer)** — starting with the meneur, each player answers oui/non by
   comparing each played card against their god's attributes. **Any "oui" earns the
   asked player an action-card draw.**

**Card types.** Personnages (12), Pouvoirs (12), Attributs (question cards), and
Actions — the last subtyped **Non** (effect fires when the answer is "non"),
**Multiple** (a 4-god question), and **Spéciale** (the only non-question card; occupies
a dedicated board slot, triggers at the start of its declared phase, then discards).

**Board (plateau).** Per player: 6 numbered opponent question-slots (players 1–7) plus
a special slot — the physical origin of the 7-player ceiling.

**Winning — "Panthéons".** After a réponse phase a player may declare "Panthéons",
pausing the game. They place a miniature character card face-down before each opponent;
every opponent reveals whether it matches. **All correct = win.** First mismatch =
that declarer is eliminated (card stays hidden) and the others no longer need to guess
them. Multiple declarers resolve clockwise from the meneur; if none succeed, play
resumes.

**Asset reality (Pantheons-specific).** Every card face is an **already-finished PNG**
— there is **no render/compositing function** and none is planned; images will not be
regenerated for a long time. The game *displays* pre-made images; it never assembles a
card. The entire game vocabulary (god names, attribute values, pantheon names, all card
copy) is **baked into the image assets**, in **French**, and is the source of truth for
all naming.

**Platform posture.** Pantheons is a **gosgames tenant**: the platform is the identity
authority (Pantheons does not authenticate), all player data is keyed by the platform
`user_id`, and Pantheons honours the platform's handoff-verify and deletion-cascade
contracts. It reuses War of Guilds' proven real-time, server-authoritative architecture
with strict hidden-information enforcement.

---

## Decisions

| # | Question | Decision | Rationale / Notes |
|---|----------|----------|-------------------|
| 1 | **Game shape** — players; genre; real-time vs turn-based | **4–7 players**, hidden-identity social deduction, **real-time server-authoritative (Colyseus)** with **simultaneous phases + server barrier** — **same system as WoG**. | Min 4 (deduction floor), max 7 (board caps at 7). The three phases run at once; the server advances only when every live player has submitted their phase action. The meneur sets réponse *order* only, it does not serialise play. Slow/disconnected-player behaviour **defers to the WoG barrier model** (input pending). |
| 2 | **Engine reuse vs fresh** | **Reuse WoG patterns in a *separate, copied* engine package inside Pantheons.** | Mirror WoG's engine package (pure rules/state, no I/O), per-player projection enforcing the never-send boundary, and the server-authoritative room driver — as Pantheons' own `packages/engine`, **not** a shared cross-game library. Copy the pattern, don't share the package; revisit a shared core only once game #3–4 reveals the real common surface (premature abstraction at n=2). |
| 3 | **"Design everything upfront" scope** | **Full spec docs + a complete, ordered Phase-1 ticket set.** Phases 2+ scoped and sequenced but **not** ticketed yet. | The costly WoG mistakes were **spec gaps** (decisions found mid-build), not ticket count. Full specs close that gap. Ticketing later phases now is waste: Phase-1 execution will refine the state model and force re-ticketing. Pantheons' design is frozen (~1 yr stable), so churn risk is low — but state-model churn, not rules churn, is what re-ticketing guards against, and that only reveals itself once Phase 1 is built. |
| 4 | **Tenant compatibility** — handoff verify, user_id keying, deletion endpoint | **Reuse all three contracts as-is.** No contract surface changes. | Confirmed against project knowledge (`handoff-token.md`, `deletion-endpoint.md`). Game-side handoff verifier per §6: alg allowlist pinned to exactly `["HS256"]`, `iss==="gosgames"`, **`aud==="pantheons"`** (only per-tenant delta), `exp`/`iat` ≤5s skew, `access===true` exact; read token from URL fragment, clear immediately, exchange for the game's own session S-JWT (handoff token is never the session token). All player data keyed by platform `user_id`, local row lazily created on first entry. `DELETE /internal/users/:id` — cluster-internal only, `Bearer <INTERNAL_SERVICE_TOKEN>` constant-time compared, idempotent (unknown/already-deleted → `200 "deleted"`, never `404`). Durable per-user store is small (state is in-memory Colyseus room state), so the cascade is a single `DELETE … WHERE user_id=$1`, same shape as WoG TICKET-058. |
| 5 | **Art pipeline** — immutable PNG, overlay-only | **Confirmed — immutable PNGs, overlay-only.** | Pantheons-specific refinement: there is **no card-face compositing** — every face is a finished PNG the engine only *displays*. Immutability holds (assets are immutable; build-time format re-encoding OK, pixel edits never). The "overlay" surface is **interactive UI chrome over static images**: board slot state + rendering a placed question card (existing PNG) into a slot, the **pense-bête** (per-player deduction grid — **client-side UI state, never server state, never in the projection**), and réponse/meneur/phase indicators. Net: Pantheons has *less* rendering complexity than WoG, not more. |
| 6 | **Slug + catalog metadata** | Ratified — see catalog row below. Platform-owned; feeds the **gosgames** catalog doc, not the Pantheons repo. | `slug: pantheons`. `card_art` is the **first asset Jules pushes to the repo via Git LFS**, ahead of build. `released_at` currently **unknown → "as soon as possible"**, set at launch (drives the catalog latest-release slot). |
| 7 | **i18n** | **French only, authored directly in French. No English source, no AI-translation, no runtime toggle.** **Deliberate, reasoned exception** to the tenant i18n standard. | The platform standard (author EN → AI-translate → render FR) exists to make future locales cheap; Pantheons **cannot** benefit — the full game vocabulary is baked into immutable PNGs that won't be regenerated, and the audience is **100% French**. Translatable strings are **chrome only** (lobby, phase labels, buttons, the "Panthéons!" declaration flow, disconnect/error messages, pense-bête labels), authored in FR. God/attribute/pantheon spellings are taken **verbatim from the pense-bête image** — assets are truth, same discipline as WoG's enum-keys rule. **Build chat must not "correct" this back to EN-authored.** |
| 8 | **Lobby / matchmaking** | **Own lobby, same functioning as the WoG room.** Do **not** wait for platform matchmaking (deferred at platform level). | Platform responsibility ends at authenticated handoff (`specs.md` §4.4). Lobby enforces **min 4 / max 7 to start** — a real gameplay gate (can't begin under-filled). Must implement the **same reconnect mechanisms as WoG**; these can be **copied later from Claude Code across repos** rather than authored fresh. Start-gate UX (fill-to-start vs host-starts vs ready-check) and reconnect specifics defer to the WoG room model (input pending). |

### Catalog metadata (Item 6 detail — platform registry row)

| Field | Value |
|---|---|
| `slug` | `pantheons` |
| `name` | Panthéons |
| `tagline` (FR, rendered) | *Un jeu de déduction : découvrez quel dieu se cache derrière chaque joueur.* |
| `min_players` / `max_players` | 4 / 7 |
| `card_art` | First asset pushed to the repo via **Git LFS** (Jules, pre-build). |
| `released_at` | Unknown → **"as soon as possible"**; set at launch. |

---

## Deferred / open

These are intentionally not decided now. None blocks Phase-1 spec authoring; each is
scoped so resolving it later is non-breaking.

- **Phase-barrier / disconnect behaviour during a phase** — what happens when a live
  player stalls or drops mid-phase (block-until-timeout vs auto-resolve their phase).
  **Defers to the WoG barrier model** Jules will paste in. (Item 1)
- **Reconnect mechanism** — required, **same as WoG**; to be **copied from Claude Code
  across repos** at implementation time rather than designed here. (Item 8)
- **Lobby start-gate UX** — fill-to-start vs host-starts-manually-once-≥4 vs
  ready-check. Defers to the WoG room model. (Item 8)
- **Phases 2+ tickets** — scoped/sequenced but not written until Phase-1 execution
  settles the state model. (Item 3)
- **Shared cross-game engine package** — deliberately not extracted at n=2; reconsider
  at game #3–4. (Item 2)
- **`released_at` value** — TBD at launch. (Item 6)
- **Action-card catalogue semantics** — the exact effect text of each Non / Multiple /
  Spéciale card is defined by the PNG assets; the rules text describes the *categories*,
  not every individual card. The per-card effect set is an authoring input for the spec
  (see Inputs), not an open design choice.

---

## Inputs still needed (before / during the build chat)

1. **WoG room model** — the current WoG room implementation (barrier, disconnect
   handling, reconnect). Jules will paste it; Pantheons mirrors it exactly (Items 1, 8).
2. **Pense-bête transcription → god data table** — the pense-bête image is the
   authoritative source for the **12 gods × {gender, eye colour, pantheon}**. The
   roster names are read (see summary); the **per-god gender and eye-colour values must
   be transcribed from the image, not inferred**. This becomes the canonical god-data
   file consumed by the engine.
3. **Asset manifest (PNG ↔ identity map)** — filename-to-identity mapping for every
   asset: each god's Personnage + miniature, each Pouvoir (12) with its effect, each
   Attribut question card, each Action card (Non / Multiple / Spéciale) with its effect,
   plus board and pense-bête images. Card faces are immutable; the *mapping* must be
   authored. `card_art` (catalog thumbnail) lands first via Git LFS.
4. **Powers + action-card effect text** — the 12 powers and the individual action-card
   effects, read from the assets, transcribed into machine-usable rules for the engine.
5. **Eye-colour value set** — the closed enum of possible eye colours (the deduction
   axis), taken from the pense-bête legend, so questions and answers resolve against a
   fixed vocabulary.

---

## Handoff to build chat

The next chat consumes this record and produces the following. It must treat god,
attribute, pantheon, power, and action naming as **fixed by the image assets** (French,
immutable) — never invent or translate them — and must preserve the never-send
hidden-information discipline throughout.

**Spec docs (author in this order; each is upstream authority for the next):**

1. **`rules.md`** — the complete, unambiguous ruleset in Pantheons' own terms: player
   count (4–7), the meneur rotation, the three simultaneous phases with the server as
   barrier, the 2-question limit and its constraints, the oui→action-draw rule, all four
   card types incl. the three action subtypes, the special-slot trigger timing, and the
   full "Panthéons" declaration/resolution (multiple declarers, elimination, hidden
   card). Derived from the uploaded rulebook.
2. **`glossary.md`** — canonical vocabulary: the 12 god names, the attribute axes
   (gender, eye colour, pantheon) and their **closed value sets**, card-type names, and
   phase names — **verbatim from the pense-bête + card assets**.
3. **`game-state-model.md`** — the server-authoritative state: room lifecycle, the
   simultaneous-phase **barrier** and its transitions, per-player secret state (god +
   hand + powers), the **per-player projection** that strips every other player's
   hidden state before serialization (the never-send boundary), the board-slot model,
   and the declaration/scoring resolution. The pense-bête is explicitly **client-only**
   and excluded from state. Mirrors the WoG driver shape; incorporates the WoG
   barrier/disconnect/reconnect model once pasted.
4. **A phased roadmap** — Phase 1 fully ticketed and ordered; Phases 2+ named,
   sequenced, and dependency-noted but not ticketed (per Decision 3). Phase 1 should
   carry the tenant-contract surface (handoff verify with `aud==="pantheons"`,
   `user_id` keying + lazy row, deletion endpoint), the engine package + projection,
   the room driver + barrier, the lobby (min 4 / max 7) mirroring WoG, and static-asset
   display wiring.
5. **Phase-1 tickets** — in Jules's convention:
   - **`[CLAUDE.AI]`** — authored in the chat interface: the spec/contract/decision
     docs themselves (`rules.md`, `glossary.md`, `game-state-model.md`, projection/
     never-send rules, phase-barrier semantics).
   - **`[OPUS 🔒]`** — security/correctness-critical, **commit but do not push** (Jules
     reviews the diff): the **handoff-token verifier**, the **per-player projection /
     never-send boundary**, and the **declaration/scoring resolution** (the
     hidden-information reveal is the top security property).
   - **`[OPUS]`** — correctness-critical, auto-push: the **deletion endpoint**
     (service-to-service auth on a destructive route), the **simultaneous-phase barrier
     + rules engine** (oui→action-draw, 2-question constraints, special-slot timing).
   - **`[SONNET]`** — mechanical, spec-dictated: `user_id` keying + lazy row creation,
     lobby scaffolding (min 4 / max 7) mirroring WoG, static-asset display components
     (cards, board slots, pense-bête grid) over immutable PNGs, catalog-metadata wiring.
   - Ticket discipline (per Jules's standing rules): one concern per ticket, strict
     top-to-bottom execution order, any ticket touching DB schema ends with
     `db:generate` + committed Drizzle files, `[OPUS 🔒]` prompts end with *"Stop after
     commit. Do NOT push — I review the diff before merge."*

**Catalog side-effect (separate, gosgames repo):** the Item 6 catalog row feeds the
**gosgames catalog decision doc**, not the Pantheons repo. `card_art` becomes an LFS
dependency the catalog references once pushed.
