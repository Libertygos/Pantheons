# Pantheons — Deep Polish STATE (single source of truth)

> Handoff document for the multi-session deep polish driven by `CONTINUE-POLISH.md`
> (repo root). A fresh session must be able to resume from this file with zero other
> context: read `CONTINUE-POLISH.md`, then this file, find the first session whose tasks
> are not all done, resume at its first unchecked task.
>
> **Mode: full runtime mode.** The project runs end to end in this environment (S1 ran the
> real stack and drove real games). No paper-audit pivot was needed.
>
> Session 1 executed 2026-07-23. Status: **S1 complete** — S2..S6 not started.

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
`polish/tools/journey4p.mjs` (4-player real table shape: states 26..30). Run them from a
scratch dir with two symlinks in a local `node_modules`:

```bash
mkdir -p work/node_modules && cd work
ln -s /opt/node22/lib/node_modules/playwright node_modules/playwright
ln -s <repo>/client/node_modules/colyseus.js node_modules/colyseus.js
node <repo>/polish/tools/journey.mjs      # writes into polish/screenshots/before/
```

For S2+ iterations, copy the scripts, change `OUT` to `polish/screenshots/sN/`, and trim
to the affected states. Notes baked into the scripts (learned the hard way):

- Each snap is taken at 1280×800 then 390×844 (`fullPage: true`).
- The scripts inject `body { background-attachment: scroll !important }` **capture-only**:
  the app uses `background-attachment: fixed`, which Playwright full-page shots do not
  paint past the first screenful (white below). Rendering is otherwise identical.
- The card-inspect loupe captures the first Escape when the cursor rests on a card —
  move the mouse to a neutral point before sending Escape.
- In a 2-player game the LAST barrier submitter never sees its own « ✓ Validé » chip
  (phase advances instantly) — have the browser submit first to photograph it.
- Bot question intents are engine `QuestionPlay` objects:
  `{ cardId, card: <resolved card from self.handCards>, targetSeat: seatOrder.indexOf(target) }`.

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

| # | Sev | What / evidence | Where | Fix in |
|---|-----|-----------------|-------|--------|
| B1 | 🟥 | Réponse auto-open drawer covers ~94vw at 390 — answers, PASSER / DÉCLARER and the whole declaration modal are hidden behind it (18--390, 19--390). | `GameView.tsx` auto-open effect; `.tiroir` CSS | S2 |
| B2 | 🟥 | `.voile` modals (déclaration/aide/fin) have **no z-index**; `.tiroir` (57) and `.tiroir-poignee` (58) stack above them — modal buttons unclickable under the drawer at 1280 (19--1280; automation click-interception logs). | `index.css` | S2 |
| B3 | 🟧 | `.jeu--tiroir-flottant { padding-right: var(--tiroir-larg) }` with `--tiroir-larg: min(780px, 94vw)` squeezes the table to ~500px at 1280: dock titles interleave (« MA MAIN » / « CONTRE VOUS »), cards overlap zones (29--1280). | `index.css` | S2 |
| B4 | 🟧 | After « Valider N questions », the placed card renders **doubled** in the target zone (public placed card + leftover local staged ghost), garbling the face (17--1280). | `GameView.tsx` staged ghosts vs `questionsAgainst` | S2 |
| B5 | 🟧 | Hand-fan overlap: a card's center is covered by its right neighbor; hover raises on desktop but **touch has no hover** — covered cards are nearly untappable at 390 (11--390; Playwright center-click interception). | `.main-ev` CSS / `GameCard` | S2 |
| B6 | 🟨 | Seat plaque jeton row clips at 3+ opponents — « 12 possibles » cut mid-chip (28--1280, Chloé). | `SeatPlaque` / `.place__jetons` CSS | S2 |
| B7 | 🟨 | « en attente de Ophélie… » — missing elision (« d'Ophélie »). Generic name interpolation issue. | `fr.ts` `fait.enAttenteDe` | S3 |
| B8 | 🟨 | Lobby: name and HÔTE/VOUS badges have no gap (« Jules[HÔTE] »), crowding at both viewports (05, 07). | `RoomLobby` CSS | S2 |
| B9 | 🟨 | Lobby status stays « En attente de joueurs (2/2 minimum) » when the table is full and everyone is ready (08). Should flip to a "ready to start" line. | `RoomLobby.tsx` | S2 |
| B10 | 🟨 | `body { background-attachment: fixed }` — poor/broken on iOS Safari, repaint cost on mobile; also defeats naive full-page captures. | `index.css` | S2 |
| B11 | ⬜ | ENGINE (deferred, do not fix in polish): after a failed declaration in a 2-player game the match continues with a single alive player — no auto-end (24, 25). Needs a design ruling. | `engine` declaration/win | log only |
| B12 | 🟨 | Eliminated **self** state: one dismissible banner, then nothing — no persistent « Éliminé » marker in the dock/topbar; UI still looks playable (24, 25). | `GameView.tsx` | S4 |
| B13 | 🟨 | In-match disconnect = 2px red dot on the plaque only; the barrier silently stalls with no message (23--1280). | `GameView` / `SeatPlaque` | S4 |
| B14 | 🟨 | Landing tagline: gray spans on navy fail AA contrast (01). | `index.css` | S3 |
| B15 | 🟨 | Join-code inputs have no visible label — `fr.landing.joinTitle` exists but is never rendered (01). | `LandingScreen.tsx` | S2 |
| B16 | ⬜ | Escape layering: loupe (capture, stops propagation) → drawer → nothing. Modals have **no** Escape close at all. | `GameView` modals | S2 |
| B17 | 🟨 | Self-meneur invisible: MENEUR badge exists only on opponent plaques — when *you* are meneur nothing shows it (09 vs 20). | `GameView` / `GameTopBar` | S4 |
| B18 | 🟨 | Pense-bête grid at 390 needs horizontal scroll to reach 8 of 12 gods, with no scroll affordance (15--390). | `PenseBeteGrid` CSS | S2 |

---

## 5. Prioritized plan — S2..S6

Rules for every session: iterate (implement → re-run → re-screenshot affected states at
390 & 1280 into `polish/screenshots/sN/` → judge → refine); don't stop at the first
acceptable version; update this file (checkboxes + reasoning + new findings); run
`pnpm test`; commit and push to main. Re-use `polish/tools/journey*.mjs` (adjust `OUT`
and trim states).

### S2 — Layout, hierarchy & collapsible panels

- [ ] **Drawer model rework (B1/B2/B3):** kill the auto-open takeover — réponse start
      pulses the handle and shows an unread-answers badge instead; drawer always
      overlays (never `padding-right` reflow); width ≤ 460px at 1280, ≤ 94vw at 390
      as today; `.voile` gets `z-index` above drawer+handle (e.g. 70) with loupe (950)
      and grain (2000) still above; Escape closes topmost layer: loupe → modal → drawer
      (B16).
- [ ] **Staged-ghost double render (B4):** after the placed card becomes public in the
      zone, drop the local ghost (dedupe by cardId or clear staged on `youSubmitted`).
- [ ] **Hand fan touch targets (B5):** widen exposed strip per card; on touch, first tap
      raises/previews, second tap selects; ensure all cards reachable at 390 with 8+
      cards in hand.
- [ ] **Plaque jetons (B6):** allow wrap or auto-shrink; verify 3 and 6 opponents.
- [ ] **Dock structure:** fixed zone grid so titles never collide; empty-hand state gets
      a one-line explanation instead of a void (390 pioche); Contre-vous cards must not
      spill over neighbors at narrow widths.
- [ ] **Pense-bête drawer content layout (with B18):** grid fits 390 without hidden
      overflow (sticky name column, scroll cue) — content additions themselves are S3.
- [ ] **Lobby:** badge spacing (B8); status line flips when `canStart` (B9); « Copier le
      lien d'invitation » becomes a real button with visible « Copié ! » feedback.
- [ ] **Landing:** render `joinTitle` label over the code boxes (B15); drop
      `background-attachment: fixed` in favor of a fixed-position background layer
      (identical look, mobile-safe) (B10).
- [ ] Re-run journey + journey4p; screenshot affected states to `polish/screenshots/s2/`;
      update versions.md entry (mirror rule).

### S3 — Readability & French text quality

- [ ] Elision helper for interpolated names (« d'Ophélie ») (B7); sweep `fr.ts` for other
      interpolation grammar traps.
- [ ] Full `fr.ts` proofread: tone consistency (vouvoiement everywhere), punctuation
      (espaces insécables before : ; ! ? »), quote style « », no anglicisms. Asset
      verbatim strings stay [sic].
- [ ] Contrast pass: tagline (B14), gray `libelle` text on navy ≥ AA at both viewports;
      minimum text size audit (nothing informative below ~11px rendered).
- [ ] **God table in the pense-bête** (from `glossary.md` table): names + genre + yeux +
      panthéon visible in the drawer (fills the void, enables actual deduction); keep
      portraits; eye-color shown as color + icon, never color alone.
- [ ] **Card captions in chrome:** power dock and inspected cards get name + effect text
      (verbatim from `card-catalog.md`, [sic] preserved) next to the PNG so effects are
      readable without the loupe; loupe hint affordance (small ⌕ on hover-capable only).
- [ ] Landing rules-cards: keep the posed look but remove text tilt if the 390 blur
      persists; retint pense-bête ★ away from chartreuse (Q5 verdict).
- [ ] Re-screenshot affected states to `polish/screenshots/s3/`; versions.md entry.

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
