# Pantheons — Deep Polish STATE (single source of truth)

> Handoff document for the multi-session deep polish driven by `CONTINUE-POLISH.md`
> (repo root). A fresh session must be able to resume from this file with zero other
> context: read `CONTINUE-POLISH.md`, then this file, find the first session whose tasks
> are not all done, resume at its first unchecked task.
>
> **Mode: full runtime mode.** The project runs end to end in this environment (S1 ran the
> real stack and drove real games). No paper-audit pivot was needed.
>
> Session 1 executed 2026-07-23. Sessions 2 and 3 executed 2026-07-24.
> Status: **S1–S3 complete** — S4..S6 not started. Resume at S4's first unchecked task.

---

## 1. How to run the app and capture screenshots

Viewports: **390×844 and 1280×800 only** (protocol).

### Build & stack (from `.claude/skills/verify` — works verbatim)

```bash
pnpm install --frozen-lockfile
pnpm build                    # engine → server → client (engine MUST build first)

pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER pantheons PASSWORD 'pantheons';" \
                   -c "CREATE DATABASE pantheons OWNER pantheons;"

cd server && DATABASE_URL="postgres://pantheons:pantheons@localhost:5432/pantheons" \
  HANDOFF_JWT_SECRET=devsecret SESSION_JWT_SECRET=devsecret2 INTERNAL_SERVICE_TOKEN=devtok \
  ADMIN_USER_IDS="user-jules" PORT=2567 node dist/index.js &
```

Server serves the built SPA at `http://localhost:2567`. `ADMIN_USER_IDS` lets the host
`user-jules` start a 2-player test game (remove 2 seats in the lobby).

### Capture harness (committed)

`polish/tools/journey.mjs` (2-player full journey: 25 states → screenshots 01..25) and
`polish/tools/journey4p.mjs` (4-player real table shape: states 26..30). ESM resolves
packages from the SCRIPT's directory — **copy the scripts into a scratch dir** that has
the two symlinks in a local `node_modules` (running them in place fails):

```bash
mkdir -p work/node_modules && cd work
ln -s /opt/node22/lib/node_modules/playwright node_modules/playwright
ln -s <repo>/client/node_modules/colyseus.js node_modules/colyseus.js
cp <repo>/polish/tools/journey*.mjs .
OUT=<repo>/polish/screenshots/sN node journey.mjs   # default OUT: …/screenshots/before
```

Notes baked into the scripts (learned the hard way):

- Each snap is taken at 1280×800 then 390×844 (`fullPage: true`).
- Since S2 the night-table background lives on a `position: fixed` `body::before` layer;
  the scripts pin it to `absolute` **capture-only** (Playwright full-page shots don't
  paint fixed layers past the first screenful). Rendering is otherwise identical.
- The card-inspect loupe captures the first Escape when the cursor rests on a card —
  move the mouse to a neutral point before sending Escape.
- Since S2, Escape closes the topmost layer (loupe → modal → drawer) — the drawer no
  longer auto-opens, so the old « Escape before clicking the declaration modal » dance is
  gone from the scripts; journey4p opens the drawer by its handle for state 30.
- In a 2-player game the LAST barrier submitter never sees its own « ✓ Validé » chip
  (phase advances instantly) — have the browser submit first to photograph it.
- Bot question intents are engine `QuestionPlay` objects:
  `{ cardId, card: <resolved card from self.handCards>, targetSeat: seatOrder.indexOf(target) }`.
- Playwright strict center-clicks fail on covered fan cards (the neighbour intercepts) —
  click/tap with `position: { x: 16, y: 80 }` to hit the exposed strip like a finger.

### Screenshot inventory (`polish/screenshots/before/`, 60 files)

01 accueil · 02 code rempli · 03 erreur code · 04 salon introuvable · 05 salon hôte seul ·
06 salon 2 sièges · 07 bot prêt · 08 tous prêts · 09 pioche · 10 pioche validée ·
11 question · 12 carte choisie · 13 question posée · 14 aide sièges · 15 pense-bête ·
16 dieu révélé · 17 question validée (attente) · 18 réponse · 19 modale déclaration ·
20 tour 2 pioche · 21 déclaration choisie · 22 fin victoire · 23 adversaire déconnecté ·
24 déclaration ratée · 25 après élimination · 26 salon complet 4j · 27 pioche 4j ·
28 question 4j · 29 réponse 4j · 30 pense-bête 4j — each at `--1280` and `--390`.

Not yet captured (do during the relevant session): two-power discard modal, power
activation targeting, Spéciale placement, private `reveal` banner, duplicate-tab view,
non-host lobby view, 7-player table (6 opponents).

---

## 2. Design interrogation — verdicts (ratified for S2..S6)

Benchmark: a commercial board-game adaptation good enough to sell the physical game.
Guiding question everywhere: *does this help the players enjoy the table?* Social
deduction lives on shared attention and table talk — every screen judged by whether it
supports that moment.

### Q1. How does a new player learn the game? Can guidance live inside existing screens?

**Findings.** The landing's « Un tour, trois temps » cards + axis legend are a genuinely
good primer. In game, the per-phase consigne bar and the six « ? » aide zones are the
right mechanism (well-written, French, rule-accurate). But: the **pense-bête grid gives a
new player nothing to reason with** — 12 unlabeled portrait heads (no god names, no
genre/yeux/panthéon anywhere in the app chrome). The physical pense-bête IS the god
table; the digital one dropped the table and kept only the portraits. Power cards render
at ~148px where their effect text is unreadable; the hover loupe exists but has zero
discoverability (and none on touch). The pense-bête tri-state marks (· / ✕ / ★) are
never explained.

**Verdict.** Contextual guidance woven into existing screens is the right architecture —
no tutorial mode. Fix the content gaps: the pense-bête must carry the full god table
(names + 3 attribute axes, from `glossary.md` — client chrome, PNG untouched) (S3);
power/action cards get a chrome text caption next to the card (transcriptions from
`card-catalog.md`) (S3); first-turn one-shot hints per phase, dismissable, stored with
the pense-bête state (S5); explain ·/✕/★ in the drawer (S5).

### Q2. What must be permanently visible vs on demand? Do collapsible panels create focus?

**Findings.** The permanent set is right: seats+questions (top), phase tracker + consigne
(middle), decks (center), own dock (bottom). On demand: aide, pense-bête. But the
**réponse-phase auto-open of the pense-bête drawer is a takeover, not a cue**: at 1280 it
eats 780px (61%) and squeezes the table into a 500px column where dock zone titles
interleave and cards overlap (29--1280); at 390 it covers ~94vw — the answers, PASSER and
DÉCLARER controls are *behind* it (18--390). The drawer's 780px width holds ~200px of
content over a huge empty void (15--1280).

**Verdict.** Auto-open is the wrong default. Replace with a non-blocking cue (pulsing
handle + a "new answers" badge — the pulse already exists) and never reflow the table for
the drawer (drop the `padding-right` squeeze; overlay instead). Cap drawer width at
~420–460px desktop; fill it with the god table (Q1). Manual open stays modal with veil.
All S2.

### Q3. Do votes/answers and identity reveals get dramatic weight?

**Findings.** Réponse answers: ✓ OUI / ✗ NON stamps in legend colors — good language,
but they land silently inside a drawer-covered layout. The « Panthéons » declaration —
the single climactic moment of the whole game — is a **plain modal visually identical to
the aide modal**, with 12 unlabeled portrait buttons and a 1px selected border (21--1280).
A failed declaration (elimination!) is a **dismissible info banner** (24--1280). Victory
is a clean but static modal (22). Nothing marks the meneur for yourself (B17), and a
disconnected opponent is a 2px red dot while the whole table silently stalls on the
barrier (23--1280).

**Verdict.** S4 owns the drama pass: declaration modal gets ceremony (tri-bande, title
treatment, names under portraits, strong selected state, per-opponent « N possibles »
from the local pense-bête — client-only, no leak); elimination becomes a full-screen beat
plus a persistent self « Éliminé » state; victory gets a staged reveal of the winner's
card (only public info — others' gods stay hidden, per projection rule); waiting/
disconnect states get explicit text (« La table attend Ophélie… »).

### Q4. Can a secret identity leak by accident?

**Findings.** Strong. Hold-to-reveal (pointer or Space/Enter) for your own god is a
deliberate act — good anti-shoulder-surf default; the card back carries no identity in
the DOM (checked in Visual V2 design and confirmed by the never-send tests). Eliminated
players' gods stay hidden everywhere (rule honored in UI). The pense-bête is
sessionStorage-only. The declaration confirm is a two-step (pick all → « Je déclare »).
Two soft risks: (1) the hold-reveal shows a huge card with no surrounding dim — a glance
from behind reads it instantly; (2) declaration picks are visible on screen while the
modal is open (inherent; acceptable).

**Verdict.** Keep the model. S4 may add a slight dim + tighter reveal placement around
the held card. No confirmation dialog needed beyond the existing two-step declaration.
Nothing here touches role logic.

### Q5. Does the PNG art direction carry into the chrome, or do screens feel unfinished?

**Findings.** Landing hero fan, card backs by category, deck piles, plaques: the DA
carries well. Weak spots: the drawer's empty void (15), the generic modals (aide ≈
declaration ≈ fin), the réponse layout collapse, and empty states (« MA MAIN — 0 » is a
bare label over a large empty band at 390 during pioche). The chartreuse « retenu » ★
in the pense-bête dilutes the ratified « chartreuse = divin/meneur/CTA » rule (it's the
only non-divine chartreuse in the app).

**Verdict.** S2 fixes the structural ones (drawer, dock reserve, empty-state copy);
S4 differentiates the declaration/fin modals from utility modals; S3 re-tints the ★
(givre/turquoise family) to protect the chartreuse accent.

### Q6. Where is text too small, contrast too low, hierarchy flat — especially at 390?

**Findings.** Landing tagline is mixed gray-on-navy (fails AA in its gray spans, 01);
join-code boxes have no visible label (the string `fr.landing.joinTitle` exists, unused);
the rules cards' tilt makes body text slightly blurry at 390; power-card face text
unreadable at dock size (Q1); jeton chips clip on plaques with 3+ opponents (« 12
possibles » cut, 28--1280); « en attente de Ophélie… » misses the elision; the fan hides
covered cards' faces almost fully at 390 with only a sliver tappable (no hover on touch).

**Verdict.** All S3 (text/contrast) or S2 (layout: clipping, fan exposure). Grammar rule
for names: `de + vowel → d'` helper applied wherever a display name is interpolated.

### Q7 (self-generated). Does the 2-player admin table misrepresent the product?

**Verdict.** Yes — always re-judge layout work at 4 players (journey4p) and once at 7
before S6 sign-off (6-opponent arc + 6-row pense-bête are untested). Added to S6.

### Q8 (self-generated). Is the barrier state legible — who is the table waiting for?

**Findings.** Submitted state = small名 chips with a dot/✓ (traqueur, right). Your own
confirmation chip (« ✓ Validé — en attente de X ») is good. But an un-submitted,
*disconnected* player looks identical to a thinking player (B13).

**Verdict.** S4: waiting list gets explicit treatment; disconnected member shown with
reconnect wording. (Barrier *timeout* stays deferred — server `deadline` is null pending
the WoG input; UI shows no countdown until then. Do not invent one.)

---

## 3. Hard limits (verbatim from CONTINUE-POLISH.md — apply to every session)

- PNG art is immutable: overlay/CSS treatment only, never modify baked pixels.
- All UI text stays in French (reports and STATE.md in English).
- Never touch role-assignment or hidden-information logic — presentation only.
- Mirror rule: observable behavior changes update the matching spec in the same commit.
  (Convention here: presentation-behavior changes are recorded as a new entry in
  `versions.md`; anything touching rules/state text would touch `docs/` — S2..S5 must
  not need that. Card-text captions must quote `docs/card-catalog.md` verbatim, [sic]
  included.)
- All tests must pass before pushing (`pnpm test` = engine + server).

Additional S1 rulings, same force:

- The card-face **verbatim [sic] rule** extends to chrome captions: never "correct" the
  faces' spelling when quoting them.
- Chartreuse stays reserved: meneur, primary CTA, declaration. Nothing else.
- Deferred (do NOT attempt in S2..S5): engine edge case B11 (one-alive-player game
  continues after a failed 2p declaration — role logic); any projection change (e.g.
  revealing correct guesses on victory); barrier timeout UI (needs ⟨INPUT WoG⟩).

---

## 4. Bug list (found in S1 — nothing fixed yet)

Severity: 🟥 blocker · 🟧 major · 🟨 minor · ⬜ info. "Fix in" = planned session.
Status: ✅ fixed (session) · open otherwise.

| # | Sev | What / evidence | Where | Fix in |
|---|-----|-----------------|-------|--------|
| B1 | 🟥 | ✅ S2 — Réponse auto-open drawer covered ~94vw at 390. Auto-open removed: handle pulses + unread-answers badge; drawer opens only by handle, always overlays (s2/18--390). | `GameView.tsx`; `.tiroir` CSS | S2 |
| B2 | 🟥 | ✅ S2 — `.voile` now z 70, above `.tiroir` (57) and `.tiroir-poignee` (58); loupe (950) and grain (2000) above. Declaration flow clicks clean in automation (s2/19). | `index.css` | S2 |
| B3 | 🟧 | ✅ S2 — the `padding-right` reflow is gone (class + CSS removed); drawer capped at min(460px, 94vw); table keeps full width in réponse (s2/29--1280). | `index.css` | S2 |
| B4 | 🟧 | ✅ S2 — staged ghosts (plays + spéciales) clear the instant `youSubmitted` confirms; the public placed card renders once (s2/17--1280). | `GameView.tsx` | S2 |
| B5 | 🟧 | ✅ S2 — fan spacing 46→54px (34→38 at ≤600px); coarse-pointer: first tap raises (`--levee`, same lift as hover), second tap acts. Verified under Playwright touch emulation. Strict center-clicks still intercept by design (fan overlap) — aim taps at the exposed strip. | `.main-ev` CSS / `GameView` | S2 |
| B6 | 🟨 | ✅ S2 — jetons get `max-width: 100%` + ellipsis: an oversized chip abridges instead of spilling past the plaque frame (s2/28--1280). Re-verify at 6 opponents in S6. | `.place__jetons` CSS | S2 |
| B7 | 🟨 | ✅ S3 — elision helper `de + voyelle/h → d'` in `fr.ts`, applied to `fait.enAttenteDe` and `jeu.reveleQuestion` (s3/17--1280 shows « en attente d'Ophélie… »). | `fr.ts` `fait.enAttenteDe` | S3 |
| B8 | 🟨 | ✅ S2 — the lobby name/badge rules targeted `.place__nom` while the markup says `.siege__nom`; renamed, gap restored (s2/07). | `index.css` | S2 |
| B9 | 🟨 | ✅ S2 — `canStart` flips the status line to « Tout le monde est prêt — l'hôte peut lancer la partie. » in vert (s2/08). | `RoomLobby.tsx` | S2 |
| B10 | 🟨 | ✅ S2 — background moved to a `position: fixed` `body::before` layer; `background-attachment: fixed` removed. Journey scripts pin it absolute for captures. | `index.css` | S2 |
| B11 | ⬜ | ENGINE (deferred, do not fix in polish): after a failed declaration in a 2-player game the match continues with a single alive player — no auto-end (24, 25). Needs a design ruling. | `engine` declaration/win | log only |
| B12 | 🟨 | Eliminated **self** state: one dismissible banner, then nothing — no persistent « Éliminé » marker in the dock/topbar; UI still looks playable (24, 25). | `GameView.tsx` | S4 |
| B13 | 🟨 | In-match disconnect = 2px red dot on the plaque only; the barrier silently stalls with no message (23--1280). | `GameView` / `SeatPlaque` | S4 |
| B14 | 🟨 | ✅ S3 — root cause was the 62%-alpha text OVERLAPPING the bright card fan (contrast collapsed over the white card bottoms). Tagline now opaque (0.92), z-stacked above the fan, text-shadowed (s3/01). | `index.css` | S3 |
| B15 | 🟨 | ✅ S2 — `joinTitle` rendered as a visible label above the code boxes; form `aria-labelledby` (s2/01). | `LandingScreen.tsx` | S2 |
| B16 | ⬜ | ✅ S2 — Escape layering: loupe (capture+stop, unchanged) → modal (déclaration/aide via GameView handler; AideZone closes itself capture+stop) → drawer. The pouvoir-discard modal deliberately has NO Escape (required phase action). Verified in automation. | `GameView` / `AideZone` | S2 |
| B17 | 🟨 | Self-meneur invisible: MENEUR badge exists only on opponent plaques — when *you* are meneur nothing shows it (09 vs 20). | `GameView` / `GameTopBar` | S4 |
| B18 | 🟨 | ✅ S2 — grid scrolls inside the drawer with a sticky name column (reordered first), fixed 48px god tracks, and edge-fade cues driven by scroll position (s2/15--390, sticky verified scrolled). | `PenseBeteGrid` | S2 |

---

## 5. Prioritized plan — S2..S6

Rules for every session: iterate (implement → re-run → re-screenshot affected states at
390 & 1280 into `polish/screenshots/sN/` → judge → refine); don't stop at the first
acceptable version; update this file (checkboxes + reasoning + new findings); run
`pnpm test`; commit and push to main. Re-use `polish/tools/journey*.mjs` (adjust `OUT`
and trim states).

### S2 — Layout, hierarchy & collapsible panels ✅ (2026-07-24)

- [x] **Drawer model rework (B1/B2/B3):** auto-open removed — réponse start pulses the
      handle once per tour and a turquoise badge counts unread opponent answers (reset
      per tour, cleared while open); drawer always overlays, width min(460px, 94vw);
      `.voile` z 70 above drawer (57) + handle (58); Escape closes topmost layer:
      loupe → modal → drawer (B16; AideZone modals close themselves capture+stop; the
      pouvoir-discard modal keeps NO Escape — required action).
- [x] **Staged-ghost double render (B4):** staged plays/spéciales (and selection/raise)
      clear on `youSubmitted` — the public card renders once.
- [x] **Hand fan touch targets (B5):** spacing 54px (38px ≤600px; 8 cards = 362px ≤ 390);
      coarse pointer: first tap raises (`--levee`), second tap selects/unstages; raise
      state resets on phase change and submit. Verified with hasTouch emulation.
- [x] **Plaque jetons (B6):** chips ellipsize at `max-width: 100%` instead of spilling
      past the plaque frame; 3-opponent check clean — 6-opponent check stays in S6.
- [x] **Dock structure:** `.dock__zone { min-width: 0 }` + « Contre vous » fan wraps
      (row-gap, max-width 300px); empty hand renders a one-line explanation per state
      (validate / waiting for table / no cards) instead of the 212px void.
- [x] **Pense-bête drawer content layout (B18):** row order now name → réponses → god
      cells; name column sticky under horizontal scroll (box-shadow keeps the hairline);
      fixed 48px tracks (a `1fr` under `width: max-content` ballooned to portrait
      intrinsic width — first iteration caught by screenshot); JS-driven edge-fade cues
      appear only where content remains. Content additions (god table) stay S3.
- [x] **Lobby:** `.siege__nom` rename fixes badge crowding (B8); status flips green on
      `canStart` (B9); copy-invite is a real `.btn` with « ✓ Copié ! » confirmation and a
      clipboard try/catch.
- [x] **Landing:** `joinTitle` label rendered above the code boxes, form labelled (B15);
      background moved to fixed `body::before` layer, `background-attachment` gone (B10).
- [x] Journeys re-run (twice: iteration + final); full s2 set in `polish/screenshots/s2/`
      (01..30, both viewports); versions.md 1.2.1 entry (mirror rule). Tests green
      (engine 39, server 48).

### S3 — Readability & French text quality ✅ (2026-07-24)

- [x] **Elision (B7):** helper `d()` in `fr.ts` (`de + voyelle/h → d'`, typographic ’),
      applied to `fait.enAttenteDe` (works on the joined name list — elision only depends
      on the first char) and `jeu.reveleQuestion`. Sweep found no other `de + name` traps
      (par/pour/avec interpolations don't elide).
- [x] **`fr.ts` proofread:** espaces insécables (U+00A0, literal chars) before : ; ! ?
      and inside « » across ALL chrome strings (verified by a string-literal-aware
      scanner — code ternaries untouched; engine verbatim texts untouched, [sic]);
      vouvoiement already consistent; « dans un autre onglet ou sur un autre appareil » ;
      hardcoded strings moved to fr.ts (« Défausser celui-ci », pense-bête alt); lobby
      « vous » badge now uses `fr.jeu.vous`.
- [x] **Contrast pass:** measured, not guessed — `--texte-faible` (0.62 alpha) already
      ≥ 5.2:1 on every navy surface, so left alone. Real failures fixed: tagline (B14,
      overlap with the fan — now opaque + z-stacked + shadowed); ✓ OUI / ✗ NON stamps
      were WHITE on vert (2.35:1) / vermillon (3.50:1) → now `--nuit-3` ink (7.2 / 4.8);
      pense-bête ✕ was vermillon on givre-2 at 0.72 opacity (≈2.8:1) → new
      `--vermillon-sombre` #b02318 on explicit #cfd9da (4.7:1). Regression caught in
      iteration 1: a substring-match script recolored the « Tour » numeral instead of the
      pastille — reverted, re-shot.
- [x] **Minimum size audit:** every informative text ≥ 10px rendered (badges/chips) or
      ≥ 11px (sentences, names): 21 selectors bumped (8→10, 9→10, 10→11). Kept at 9px:
      `traqueur__num` (decorative, aria-hidden) and the rare `carte-tuile__type`
      fallback header (8→9).
- [x] **God table in the pense-bête:** « La table des dieux » under the grid — 12 rows
      grouped by panthéon (icon + label headers), each row = portrait, name, genre
      (♂/♀ glyph + label), eyes (colored-iris eye icon + label — never color alone),
      hover/focus loupe to the real Personnage card. Grid itself gains a panthéon
      super-header row (4 bandeaus spanning 3 columns). Fills the drawer void at 460px
      width as planned (s3/15, s3/30).
- [x] **Card captions in chrome:** verbatim face text ([sic] — `ATTRIBUT_QUESTION` map +
      engine `data.ACTIONS/POWERS.texte`) via `questionCardTexte()`: power dock slot,
      discard-modal choices, and the selected/touch-raised hand card (caption under the
      fan — the touch path, which has no loupe, finally reads effects). Multiple sets
      recomposed with god LABELS (engine texte carries raw ids); Spéciales append their
      trigger phase (chrome). ⌕ badge on inspectable md/lg faces, `(hover)+(pointer:fine)`
      only, suppressed on the landing hero fan (it has its own zoom).
- [x] **Landing rules-cards tilt:** `--pente: 0` once stacked (≤980px) — the 390 blur was
      the rotation; desktop keeps the posed look. **★ retint:** chartreuse → turquoise
      (chartreuse back to divine-only).
- [x] Journeys re-run (twice: iteration + final); full s3 set in `polish/screenshots/s3/`
      (01..30, both viewports); versions.md **1.2.2** (mirror rule). Tests green
      (engine 39, server 48). Note: s3 screenshots show the 1.2.1 footer stamp — taken
      before the bump, cosmetic (same as S2).

### S4 — Atmosphere, reveal moments & feedback

- [ ] **Declaration ceremony:** distinct modal DA (tri-bande header, chartreuse title —
      its reserved use), god names under portraits, strong selected state, per-opponent
      « N possibles » badge sourced from the local pense-bête (client-only), staging
      order = seat order.
- [ ] **Elimination beat:** full-screen overlay (shake exists) replacing the info banner;
      persistent « Éliminé » chip in dock + topbar for self (B12); opponents' view
      already has the plaque badge.
- [ ] **Victory:** staged sequence — winner named, winner's own card flip (already
      public), tri-bande sweep; loser perspective mirrors it. No projection changes:
      others' gods stay hidden.
- [ ] **Meneur for self (B17):** topbar/tracker chip « Meneur : vous ».
- [ ] **Waiting & disconnect states (B13):** explicit « La table attend X… » line under
      the tracker; disconnected player gets « X s'est déconnecté — reconnexion en
      attente » wording (from CONN_STATUS); no invented countdown (timeout is deferred).
- [ ] Hold-to-reveal: slight backdrop dim while held (Q4).
- [ ] Reduced-motion audit of every new effect (existing convention).
- [ ] Re-screenshot: 19/21/22/24/25 states + new beats → `polish/screenshots/s4/`;
      versions.md entry.

### S5 — Contextual onboarding (spec-grounded, no hidden-info leaks)

- [ ] First-turn one-shot hints per phase (pioche/question/réponse), copy drawn strictly
      from `docs/rules.md` §5; dismiss-forever persisted alongside pense-bête state;
      never conditioned on or mentioning any hidden identity.
- [ ] Pense-bête legend: explain · / ✕ / ★ and the « N possibles » badge in the drawer.
- [ ] Aide zones: add declaration-window zone (the one moment with no « ? » today);
      verify the aide modal's pense-bête image fits at 390.
- [ ] Empty states: « Ma main » during pioche, empty question zones, « Aucune réponse ce
      tour » — one short informative line each (already partly present).
- [ ] First-visit lobby: one-line explanation of the start gate (min 4 / max 7 — admin
      2p test rooms excepted server-side).
- [ ] Re-screenshot first-game flow → `polish/screenshots/s5/`; versions.md entry.

### S6 — Bug fixes & final review

- [ ] Remaining 🟨 not covered above; verify every B# row and mark fixed/deferred.
- [ ] 7-player pass: extend journey4p to 6 bots; judge arc, pense-bête 6 rows, plaque
      density at both viewports; fix what breaks (layout only).
- [ ] Full journey + journey4p re-run against final build; complete before/after set in
      `polish/screenshots/final/`.
- [ ] Cross-check hard limits: no PNG touched, no EN leaked into UI, no role-logic diff
      (git diff audit of `packages/engine` must be empty except approved items).
- [ ] `pnpm test` green; write `polish/DEEP-POLISH-REPORT.md` (what changed per session,
      before/after pairs, remaining deferred list: B11, projection-dependent victory
      recap, barrier-timeout UI).

---

## 6. Session log

### S1 — 2026-07-23 — Immersion & design dossier (analysis only) ✅

- Read all specs (`pantheons-design-decisions.md`, `docs/*`, `wog-room.md`,
  `PANTHEONS_PROGRESS.md`, `versions.md`) and the client/server/engine source.
- Built and ran the full stack (Postgres + server + built SPA) in-session; drove a
  2-player game (browser host + colyseus.js bot) through: landing, errors, lobby, full
  turn (pioche→question→réponse), aide, pense-bête, god reveal, declaration (cancel,
  win, and failed/elimination), end screens, opponent disconnect/reconnect; plus a
  4-player game for the real table shape. 60 screenshots (30 states × 2 viewports) in
  `polish/screenshots/before/`; harness committed to `polish/tools/`.
- Wrote the interrogation (§2), bug list (§4, 18 items — 2 blockers), and the S2..S6
  plan (§5). No UI changes made (protocol: analysis only).
- Notable systemic findings: the réponse-phase drawer model (B1/B2/B3) is the dominant
  defect cluster; the pense-bête lacks the god table (biggest gameplay-support gap);
  climactic moments (declaration/elimination/victory) carry no ceremony.

### S2 — 2026-07-24 — Layout, hierarchy & collapsible panels ✅

- Fixed B1/B2/B3/B4/B5/B6/B8/B9/B10/B15/B16/B18 — details in §4 and the S2 checklist.
  Presentation-only: no engine/server/protocol diff; PNG untouched; UI stays French.
- Iteration loop: implement → build → full journey + journey4p into
  `polish/screenshots/s2/` → judge → refine. One real defect caught by screenshots and
  re-shot: the reworked pense-bête grid used `minmax(44px, 1fr)` tracks under
  `width: max-content`, which ballooned columns to the portraits' intrinsic width —
  replaced with fixed 48px tracks.
- Behavior verified beyond screenshots (Playwright, touch emulation): tap 1 raises a
  covered fan card, tap 2 selects; Escape closes aide modal then drawer, in that order;
  the aide veil correctly blocks the drawer handle (z-order proof). Sticky name column +
  edge cues verified at scrollLeft 280 at 390px.
- Harness updates (committed): journey scripts take `OUT` env override; the
  auto-open-era Escape workarounds are gone; capture-only style pins the new
  `body::before` background layer to absolute; journey4p opens the drawer by its handle
  for state 30. Scripts must be COPIED to the scratch dir (ESM resolves from the
  script's own path).
- Carry-forwards noted in place: drawer void below the grid awaits the S3 god table
  (the 460px drawer means the grid always scrolls — S3 should design content for that
  width, or transpose); B6 needs a 6-opponent re-check in S6; declaration/victory
  ceremony untouched (S4). New strings added to `fr.ts` (empty-hand ×3, unread answers,
  lobby ready line) follow the existing tone — S3's proofread covers them too.
- `pnpm test` green (engine 39/39, server 48/48); versions.md → **1.2.1** (mirror rule;
  the s2 screenshots still show the 1.2.0 stamp — taken before the bump, cosmetic).

### S3 — 2026-07-24 — Readability & French text quality ✅

- Fixed B7 (elision) and B14 (tagline) — details in §4 and the S3 checklist. All
  presentation-only: no engine/server/protocol diff (engine's verbatim card texts used
  read-only via `data.ACTIONS/POWERS`); PNG untouched; UI stays French.
- Shipped the two S1-identified gameplay-support gaps: the **god table in the drawer**
  (names + 3 axes, grouped by panthéon, from `glossary.md` — the drawer void is now the
  deduction reference) and **verbatim card captions in chrome** (dock power, discard
  modal, selected/raised hand card) so effects read without the loupe — including on
  touch, where the loupe doesn't exist. New ⌕ affordance marks inspectable faces on
  fine-pointer devices.
- Contrast work was measurement-driven (WCAG script in-session): the S1 "gray libelle
  fails AA" hypothesis was wrong (0.62-alpha givre ≥ 5.2:1 on all navy) — the REAL
  failures were the tagline-over-fan overlap and white text on legend-color chips
  (2.35:1 on vert). Fixed those; ✕ mark got `--vermillon-sombre` (#b02318). Palette var
  added to `:root`.
- Iteration loop caught two real defects via screenshots: (1) a substring-matching CSS
  script recolored `.table-centre__tour strong` (the big Tour numeral) instead of
  `.reponse-pastille` — white restored, pastille fixed properly; (2) the new ⌕ badge
  cluttered all 12 hero-fan cards on the landing — suppressed there (`.eventail`), kept
  everywhere else.
- New fr.ts strings (tableTitre/tableNote, defausserCeluiCi, penseBeteAlt,
  declenchement) follow the existing tone and carry NBSP typography. NBSP are literal
  U+00A0 chars in fr.ts/PenseBeteGrid — invisible in diffs; a scanner verified coverage.
- Carry-forwards: declaration modal still has unlabeled portraits — S4's ceremony adds
  names (the god table now gives S4 a pattern to reuse). The `carte-legende--main`
  caption slightly grows the dock when a card is selected (accepted: no reflow above,
  judged calm at both viewports). B6 6-opponent re-check and the ⌕-on-xs/sm decision
  (currently md/lg only) stay in S6. Power-caption width (190px) OK at 4p — re-judge at
  7 players in S6.
