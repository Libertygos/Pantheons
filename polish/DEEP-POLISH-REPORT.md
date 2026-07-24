# Pantheons — Deep Polish Report (S1–S6)

> Final report of the multi-session deep polish driven by `CONTINUE-POLISH.md`.
> Benchmark: a commercial-quality digital board-game adaptation that makes players want
> to buy the physical game. Scope: presentation only — **zero engine/server/protocol
> diff across the whole effort** (audited: `git diff 6c29f68..HEAD -- packages/engine
> server` is empty), PNG card art untouched, UI French-only throughout.
>
> Working documents: `polish/STATE.md` (interrogation, verdicts, bug list, session
> logs), `versions.md` 1.2.1 → 1.2.6 (one entry per session, mirror rule).

## Executive summary

Six sessions (2026-07-23 → 2026-07-24) took the game from "playable and pretty in
places" to a coherent table: the drawer no longer hijacks the layout, every French
string reads and measures AA, the pense-bête became a real deduction sheet (god table +
full-view rule + legend), the three climactic moments (declaration / elimination /
victory) have distinct ceremony, first-time players get spec-grounded guidance woven
into the existing screens, and the whole thing is re-judged at 2, 4 and 7 players with
runtime assertions where a rule can be asserted. 17 of 18 logged bugs fixed; 1
deliberately deferred (engine-side, out of polish scope).

## What changed, per session

### S1 — Immersion & design dossier (no UI changes)
Ran the real stack; drove full 2-player and 4-player games with Playwright + a
colyseus.js bot; 60 before-screenshots at 390/1280; wrote the design interrogation
(8 questions, ratified verdicts), an 18-item bug list, and the S2–S6 plan. Key systemic
findings: the réponse-phase drawer takeover (B1/B2/B3), the pense-bête's missing god
table, and ceremony-free climactic moments.

### S2 — Layout, hierarchy & panels (1.2.1)
- Drawer model rework: auto-open removed (pulse + unread-answers badge instead); always
  an overlay — the table never reflows; Escape closes topmost layer (loupe → modal →
  drawer).
- Staged-ghost double render fixed; fan touch targets widened (first tap raises, second
  acts); plaque jetons ellipsize; dock empty states got explanatory lines; lobby badge
  crowding fixed, ready-state line, real copy-invite button; landing join label +
  fixed-background repaint fix.

### S3 — Readability & French text quality (1.2.2)
- Elision helper (`de + voyelle → d’`); NBSP typography before `: ; ! ?` and inside
  `« »` across all chrome strings; hardcoded strings moved to fr.ts.
- Measurement-driven contrast pass (the S1 "gray fails AA" hypothesis was wrong — the
  real failures were tagline-over-fan and white-on-legend-color stamps); minimum text
  size floor (≥10px badges, ≥11px sentences).
- The god table in the drawer (12 identities × 3 axes, grouped by panthéon, from
  `glossary.md`); verbatim [sic] card captions in chrome (dock power, discard modal,
  selected/raised hand card); ⌕ inspect affordance on fine pointers; landing rules-card
  tilt removed at ≤980px; ★ retinted turquoise.

### S4 — Atmosphere, reveal moments & feedback (1.2.3)
- Declaration ceremony: tri-bande, chartreuse title, named portraits, pense-bête marks
  projected in (✕/★ + « N possibles » per row — local notes only, never sent).
- Elimination: full-screen vermillon beat + persistent « Éliminé » state.
- Victory: staged sequence; the loser's view shows the winner's VERSO + « restera
  secret » — the never-reveal projection rule became a moment.
- « Meneur : vous » chip; disconnect in words (« la partie continue sans l'attendre »,
  matching actual server barrier behavior); hold-to-reveal dim; reduced-motion hardening
  (delays collapse with durations).

### S4b — Pense-bête full view (user directive, 1.2.4)
- Ratified rule: **opening the pense-bête always shows all 12 god possibilities for
  every player** — no horizontal scrolling, both viewports; covering the table is the
  accepted trade-off. Wide drawer `min(840px, 96vw)`; below 840px each row folds to two
  lines.
- Public answers zoom like god portraits (shared inspect loupe: hover/focus/click,
  tap-toggle on touch; verdict as name plate). Face-down answers stay inert.

### S5 — Contextual onboarding (1.2.5)
- First-turn hints per phase (copy strictly from `rules.md` §5), dismissable, persisted
  like the pense-bête; nothing shows from tour 2.
- Pense-bête legend (tri-state marks + « N possibles » definition, sample cells in the
  grid's colors); declaration aide zone (the last « ? »-less moment; Escape closes the
  aide only — asserted in automation); drawer empty state in words at AA; lobby
  start-gate line for all players (server min/max).

### S6 — Final review (1.2.6)
- **Chartreuse ruling:** seat-3 tint and the Spéciale accents moved to a new `--ambre`
  (#d9a441, ≥4.5:1 on navy) — chartreuse is now exclusively meneur / primary CTA /
  declaration (plus the S1-ratified focus ring and caret interaction accents). Decision:
  replace, not ratify-as-exception.
- **7-player pass:** `journey4p.mjs` parameterized (`BOTS=6`); arc of 6, 6-row
  pense-bête and 6-row ceremony judged at both viewports; **full-view rule
  runtime-asserted at 7 players** (72/72 cells, zero overflow, 1280 AND 390); B6 plaque
  jetons hold at 6 opponents. No layout fixes needed.
- **Loser-perspective fin captured** (was code-verified only): new
  `polish/tools/rig-loser-fin.mjs` — in a 2p admin room, a bot holding Déduction sees
  all 10 undealt personnage cards over 11 all-pass tours (the « aucun oui au tour
  précédent » gate forbids tour 1), deduces the host's god, declares and legitimately
  wins; the browser photographs the losing fin (winner's verso + « Le dieu d'Ophélie
  restera secret. », state 42).
- Final screenshot set + hard-limit audit + this report.

## Before / after pairs (same state number, both viewports)

`polish/screenshots/before/` vs `polish/screenshots/final/`:

| State | Before | After |
|---|---|---|
| 01 accueil | tagline mixed-alpha over the fan, join code unlabeled | opaque AA tagline, labeled join form, 1.2.6 stamp |
| 09 pioche | bare « MA MAIN — 0 » void | explanatory empty-hand line + first-turn hint strip |
| 15/30/40 pense-bête | 12 unlabeled heads, drawer void, scrolling god axis | god table + panthéon headers + legend + full-view rule at 2/4/7 players |
| 18 réponse | drawer auto-open covered ~94vw at 390, controls behind it | non-blocking pulse + badge; overlay-only drawer |
| 19/21/31/41 déclaration | plain modal, 12 mute portraits, 1px selection | ceremony: tri-bande, named gods, marks, « N possibles », strong selection, aide zone |
| 22 fin victoire | static modal | staged reveal sequence |
| 24/25 élimination | dismissible info banner | full-screen beat + persistent eliminated state |
| 23 déconnexion | 2px red dot | etiquette + explicit tracker line (truthful: barrier auto-passes) |
| 42 fin défaite | *(unreachable for a bot — never photographed)* | captured: winner's verso + « restera secret » |

New evidence states along the way: 26–31 (4p), 32/33 (S4b loupe), 34/35 (S5 aide), 36–41
(7p), 42 (loser fin).

## Bug list outcome (S1's 18 items)

- **Fixed:** B1, B2, B3, B4, B5, B6 (re-verified at 6 opponents in S6), B7, B8, B9,
  B10, B12, B13, B14, B15, B16, B17, B18 (superseded by S4b's full-view rule; scroll
  machinery kept as a dormant safety net).
- **Deferred (by design, out of polish scope):** B11 — engine edge case: after a failed
  declaration in a 2-player game the match continues with a single alive player, no
  auto-end. Role/win logic; needs a design ruling.

## Remaining deferred list (needs decisions or input beyond polish scope)

1. **B11** (above) — engine win-condition ruling for degenerate ≤1-alive tables.
2. **Projection-dependent victory recap** — revealing which guesses were correct on
   victory would change the projection (currently: only the winner's own card is shown
   to themself; everyone else's god stays secret, including eliminated players'). Any
   richer recap needs a rules/projection decision first.
3. **Barrier-timeout UI** — the server `deadline` is null pending the ⟨INPUT WoG⟩ room
   model; no countdown is shown and none was invented.
4. Small watch item: the ⌕ inspect badge is currently md/lg card sizes on fine pointers
   only (xs/sm judged too noisy) — revisit if players miss the loupe on small faces.

## Hard-limit compliance (audited 2026-07-24)

- `git diff 6c29f68..HEAD -- packages/engine server` → **empty** (presentation only;
  engine data read-only for verbatim card text).
- No PNG/WebP art file modified anywhere in the range (screenshots are new files under
  `polish/`).
- `docs/` untouched — no observable *rules* behavior changed; presentation-behavior
  changes are versioned in `versions.md` 1.2.1–1.2.6 (the ratified mirror-rule
  convention for this effort).
- UI French-only: all new strings live in `fr.ts` with NBSP typography (scripted
  verification); reports/STATE in English as ratified.
- No hidden-information path added: pense-bête marks and hints are client-local;
  answer-zoom only enlarges already-public faces; the declaration modal consumes local
  marks only. The loser-fin rig plays strictly within the rules (Déduction is a real
  power; the bot wins a fair game).
- Tests green at every session boundary: engine 39/39, server 48/48.

## How to reproduce captures

See `polish/STATE.md` §1 (stack + scratch-dir setup). Tools, all committed under
`polish/tools/`:

```bash
OUT=…/polish/screenshots/final node journey.mjs        # 2p states 01..25 + 34/35
OUT=…/polish/screenshots/final node journey4p.mjs      # 4p states 26..31
BOTS=6 OUT=… node journey4p.mjs                        # 7p states 36..41 (+ runtime asserts)
OUT=… node rig-loser-fin.mjs                           # state 42 (retries rooms until Déduction)
```
