# Pantheons — Multi-Session Deep Polish: Continuation Protocol

You are an expert game UI designer executing a multi-session deep polish of
Pantheons (hidden-identity social deduction game, French-only UI). Benchmark: a
commercial-quality digital board game adaptation that makes players want to buy the
physical game. Improve what exists; build no new features. Work autonomously — no
questions. Screenshots at 390px and 1280px viewports only.

## How to locate the current state

1. Read CLAUDE.md and this file fully.
2. Check whether polish/STATE.md exists.
   - It does NOT exist → nothing has started. Execute SESSION 1 below.
   - It EXISTS → it is the single source of truth. Find the first session whose
     tasks are not all done, then the first incomplete task within it, and resume
     there. Trust STATE.md's checkboxes and progress notes; verify against code
     and polish/screenshots/ if ambiguous. Follow the "What one session does" and
     "Before ending every session" rules below.

## SESSION 1 — Immersion & design dossier (analysis only, no UI changes)

Read every spec document in this repo. Start the client (and server if needed).
Use Playwright to traverse the full journey: landing, room creation/joining,
lobby, and every reachable in-game state — identity reveals, discussion/voting
phases, endgame. Screenshot everything at 390px and 1280px into
polish/screenshots/before/. Read every French text at both viewports: legibility,
tone, grammar, truncation, whether a first-time player understands without outside
help.

Then write the design interrogation. For every screen, ask and answer hard
questions guided by "does this help the players enjoy the game?" — social
deduction lives on shared attention and table talk, so judge every screen by
whether it supports that moment or distracts from it. At minimum: How does a new
player learn the game — can contextual guidance be woven into existing screens
rather than a tutorial mode? What must be permanently visible versus on demand —
would collapsible panels create focus? Do votes and identity reveals get dramatic
visual weight, or do they look like any other state change? Can a secret identity
leak by accident — shoulder-surfing, reveal animations, missing confirmations?
Does the completed PNG art direction carry into the interface chrome, or do some
screens feel unfinished next to it? Where is text too small, contrast too low,
hierarchy flat — especially at 390px? Generate your own questions beyond these —
go deep. Log every front-end bug found without fixing anything.

If the project is not runnable end to end, pivot: audit specs and existing code
instead, answer the interrogation on paper as ratified design decisions, and
reshape the session plan as design-dossier work — record clearly in STATE.md which
mode applies.

Create polish/STATE.md as the handoff document. It must contain: how to run the
app and capture screenshots (390px and 1280px only), the full interrogation with
verdicts, the hard limits below, the bug list, and a prioritized plan with
concrete task checklists for:
- S2: layout, hierarchy & collapsible panels
- S3: readability & French text quality
- S4: atmosphere, reveal moments & feedback
- S5: contextual onboarding (grounded strictly in the spec documents; guidance
  must never leak hidden-identity information)
- S6: bug fixes & final review, producing polish/DEEP-POLISH-REPORT.md
STATE.md must let a fresh session resume with zero other context. Commit and push.

## What one session does (S2 onward)

Execute the current session's remaining tasks from STATE.md, following its
ratified verdicts. Iterate: implement, re-run, re-screenshot affected screens at
390px and 1280px into polish/screenshots/sN/, judge, refine. Do not stop at the
first acceptable version. Defer anything requiring server or role-logic changes,
with written reasoning in STATE.md.

## Hard limits — no exceptions

- PNG art is immutable: overlay/CSS treatment only, never modify baked pixels.
- All UI text stays in French (reports and STATE.md in English).
- Never touch role-assignment or hidden-information logic — presentation only.
- Mirror rule: observable behavior changes update the matching spec in the same
  commit.
- All tests must pass before pushing.

## Before ending every session — mandatory

1. Update polish/STATE.md: mark tasks done, describe changes and reasoning, log
   findings, adjust remaining plans.
2. Run the full test suite; fix anything broken.
3. Commit and push everything to main.

If interrupted mid-session, the next session reads this file, then STATE.md, and
resumes from the first unchecked task.
