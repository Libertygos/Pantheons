# wog-room.md — War of Guilds: landing, room, and refresh behaviour (and how to build the same for 4–7 players)

This document is a **reference extraction** from the `war-of-guilds` codebase. It describes,
exactly as implemented, three things:

1. **The landing page** — how a player lands, authenticates, and creates/joins a room.
2. **The game room** — the full room lifecycle: lobby, seats, host controls, start, in-match.
3. **Refresh behaviour** — what happens on a page reload, a tab close, a disconnect, or a
   second tab, and how the seat survives it.

Then it gives a **file-by-file recipe** for reproducing the whole thing in the Pantheons
project with a **4-to-7-player** table instead of the current **2-to-6**.

Everything below is what the code does today. Where a change to player count has a
non-mechanical consequence (hidden information, board layout), it is called out explicitly —
those are the only two places where "bump the constants" is not the whole story.

---

## 0. Architecture in one screen

War of Guilds is a **pnpm monorepo** that builds **one container image**:

| Package            | Role                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `packages/engine`  | Pure game logic. No network, no I/O, no clock, no `Math.random` — all injected. Seat-count-generic. |
| `apps/server`      | Thin, authoritative Colyseus server. Validates, calls the engine, broadcasts per-seat projections. |
| `apps/client`      | React + Vite SPA. Untrusted. Renders only what the server sends it.                       |

Key principles that shape the room/refresh design:

- **The server is authoritative; the client is untrusted.** The acting seat is always derived
  from the *connection*, never from a field in a client message.
- **Per-seat projection.** The server emits a *different* payload to each seat containing only
  what that seat is entitled to see. Hidden information (opponents' secret characters, set-aside
  characters, pre-reveal vote values) is filtered *at the source* — never sent then hidden.
- **Colyseus rooms are in-process and ephemeral.** A room lives only as long as its Node
  process. Reconnection grace windows live in that process; a server restart wipes them.
- **The SPA is served same-origin by the game server**, so the WebSocket and all `/api/*` calls
  share the page host and TLS, and the session cookie rides along automatically.

Transport: **Colyseus** (`colyseus.js` on the client, `@colyseus/core` on the server) over a
single WebSocket per room. Auth: an httpOnly `wog_session` cookie set by a platform handoff.

---

## 1. Entry & session (what happens before the landing page renders)

Source: `apps/client/src/net/entry.ts`, `session.ts`, `handoff.ts`; server `/api/auth/*`.

On **every app load** the client resolves exactly one of two outcomes — `authenticated` or
`bounce` — by trying three paths in order (`resolveEntry`):

1. **Handoff token in the URL fragment** (`<base>#token=<jwt>`). The platform mints a signed
   token and navigates the browser here with it in the fragment (fragments are never sent to
   the server, so the token stays out of logs and `Referer`). The client:
   - reads the token and **immediately clears the fragment** (`history.replaceState`) so a
     refresh can't replay it;
   - POSTs it to `/api/auth/handoff`. On success the **server sets the `wog_session` httpOnly
     cookie** and returns **identity only** (no token in the body — JS never holds session
     material). → `authenticated`.
   - On failure (401) → **fall through to bounce**, *not* to the session probe. A present
     handoff token is a fresh identity assertion that must win over any existing cookie.
2. **No fragment → session probe.** `GET /api/auth/session` with the cookie. If it verifies,
   render the landing page. **This is the refresh-survival path** — a plain reload re-probes the
   cookie with no platform round-trip. → `authenticated`.
3. **No fragment, no valid session → bounce** to the platform launch deep-link
   (`https://www.gosgames.com/api/launch/war-of-guilds`).

Sign-out (`logout`) asks the server to clear the cookie, then top-level-redirects to the
platform home. Best-effort: the client leaves regardless of the request's result.

**Takeaway for Pantheons:** the entire landing/room stack assumes an already-authenticated
identity carried in a same-origin httpOnly cookie. None of the seat/room logic ever inspects a
token — it just asks "am I signed in?" and lets the server verify on every socket handshake.

---

## 2. The landing page

Source: `apps/client/src/screens/LandingScreen.tsx`.

The landing page shows a banner, a welcome line, a **Create a room** primary CTA, and a
**Join by code** form. It does three jobs:

### 2.1 Resume auto-redirect (the "you're already in a room" case)

On mount it reads `loadResume()` from `localStorage` (`wog_resume`). **If a resume record
exists, it immediately `navigate('/room/<code>', { replace: true })`** and renders nothing.
This is what makes a refresh land you back in your room instead of on the home screen.

### 2.2 Create

`handleCreate()`:
- clears any stale active-room baton, then `createGameRoom()` = `client.create('game', {})`.
  Auth rides the cookie on the matchmake handshake (server verifies in `onAuth`).
- registers a one-shot `ROOM_CREATED` handler carrying `{ roomCode, seatId, hostSeat }`.
- on that message → `bindAndNavigate` (below).

### 2.3 Join

`handleJoin()`:
- uppercases/trims the entered code, `joinGameRoom(code)` = `client.join('game', { roomCode })`.
- registers a one-shot `JOIN_OK` handler with the same `{ roomCode, seatId, hostSeat }` shape.
- on that message → `bindAndNavigate`.

Join errors surface inline (the promise rejects with the server's `ServerError` message —
`BAD_CODE`, `ROOM_FULL`, `ROOM_IN_PROGRESS`, `ALREADY_IN_ROOM`).

### 2.4 `bindAndNavigate` — the handoff to the room screen

This is the crux of "a live socket survives a client-side route change":

```
saveResume({ roomCode, reconnectionToken: room.reconnectionToken, seatId, phase: 'LOBBY' });
setActiveRoom({ room, roomCode, seatId, hostSeat });   // module-level baton
navigate('/room/' + roomCode);
```

- **`saveResume`** persists to `localStorage` so a *later* refresh can reconnect.
- **`setActiveRoom`** stashes the *live* `Room` object in a module-level holder
  (`net/active-room.ts`). React Router can't carry a live object through a route change, so this
  baton hands the already-bound connection from `LandingScreen` to `RoomScreen`. It is
  deliberately **not** used across a full reload (a reload reloads the module → the holder is
  empty → the room screen takes the reconnect path instead).

---

## 3. The room screen — the acquisition state machine

Source: `apps/client/src/screens/RoomScreen.tsx` (the `/room/:code` route).

`RoomScreen` owns **acquiring a Colyseus room** and then driving the
**lobby → board → end** lifecycle. Views: `connecting | lobby | game | end | duplicate`.

### 3.1 Acquire (runs once on mount, `connect(code)`)

Three paths, in order:

1. **Adopt** (the fresh same-tab path). `peekActiveRoom(code)` — if the baton holds a room for
   this code, adopt it directly and `enterLobby`. No new socket.
2. **Probe.** `GET /api/rooms/:code/exists` → `{ exists, phase }`. If `!exists` → toast
   "room not found", clear resume, go home. This avoids opening a socket to a dead room.
3. **Reconnect or fresh-join**, based on whether a stored reconnection token matches this room:
   - **Stored token for this room** → `client.reconnect(token)`:
     - `phase === 'LOBBY'` → re-persist the rotated token, `enterLobby` (host unknown until the
       first `LOBBY_STATE`).
     - otherwise → `enterGameViaReconnect` (see §5.3).
     - **on failure** (grace window expired): in LOBBY fall back to a fresh join (seats are
       re-bindable before start); mid-match the seat is gone → toast "session expired", go home.
   - **No stored token** (fresh invite link, or a different device/tab):
     - `phase === 'LOBBY'` → `freshJoin(code)`.
     - otherwise → toast "match in progress", go home (you can't join a running match).

`freshJoin` = `joinGameRoom(code)`, then on `JOIN_OK` persist resume and `enterLobby`. A
special case: if the join is rejected with `ALREADY_IN_ROOM`, the client shows the **`duplicate`**
view ("already open in another tab") instead of looping the home redirect — because the seat is
genuinely live in the other tab and the resume must stay.

### 3.2 View lifecycle

- `enterLobby(room, seat, host)` → renders `RoomLobby`.
- `handleGameStart(room, initialState)` → sets `phase: 'IN_PROGRESS'` in resume, plays a
  match-start doorway animation, renders `GameBoardScreen`.
- `handleMatchEnd(result)` → renders `EndScreen`.
- `handleAbort(message)` → back to the **same room's** fresh lobby with a notice (see §5.5).

### 3.3 Teardown (the refresh/close half)

The unmount cleanup is StrictMode-safe (deferred a tick so a dev double-mount doesn't tear down
the adopted room). On a **genuine** unmount that was **not** an intentional leave, it calls:

```
room.leave(false)
```

`leave(false)` tells the server this is **not a consented leave** — open the reconnection grace
window instead of freeing the seat. This is exactly what makes a refresh recoverable: the tab
tears down, the socket drops, but the seat is held for the grace window while the reloaded page
reconnects.

---

## 4. The lobby

Source: `apps/client/src/screens/RoomLobby.tsx`; server handlers in `game-room.ts`.

`RoomLobby` is driven entirely by a pre-bound `room`. It renders the room code (+ copy-invite
link), a list of **configured seat slots**, host-only seat controls, and the ready/start/leave
buttons.

### 4.1 State stream

On mount it binds `LOBBY_STATE`, `LOBBY_ERROR`, and `STATE_UPDATE` handlers, then sends
`REQUEST_LOBBY_STATE` (the join-time broadcast races handler registration — Colyseus drops
messages with no registered handler — so the lobby re-asks and gets a unicast reply).

`LOBBY_STATE` payload:

```
{ roomCode, hostSeat, seats: SeatInfo[], canStart }
SeatInfo = { seatId, occupied, displayName, ready, conn: 'CONNECTED'|'DISCONNECTED' }
```

The seat list is **variable length** = the room's configured slot count. It is seeded at mount
with `DEFAULT_SEATS` placeholder slots so the right count paints before the first broadcast, then
replaced wholesale by every `LOBBY_STATE`.

### 4.2 Actions (all are just `room.send(...)`)

- `SET_READY { ready }` — toggle own ready.
- `ADD_SEAT` / `REMOVE_SEAT` — host-only; append an empty slot up to `MAX_CONFIGURED`, or remove
  the trailing **empty** slot down to `MIN_CONFIGURED`. The client disables the buttons at the
  bounds (`MAX_CONFIGURED = 6`, `MIN_CONFIGURED = 2` today) but the **server is authoritative**.
- `START_MATCH` — host-only; enabled only when `canStart`.
- `LEAVE_ROOM` — frees the seat server-side, then `room.leave()`, then the parent clears resume
  and navigates home. **This is a consented leave** (contrast §3.3).

### 4.3 The start gate

`STATE_UPDATE` is the start signal: the server emits exactly one at the first input-waiting
point after `START_MATCH`, and its payload is the board's initial projection. `RoomLobby`
forwards it once (guarded) via `onGameStart`.

---

## 5. Refresh & resume behaviour (the whole model)

This is the part most worth copying carefully. Four moving pieces cooperate:

| Piece | Where | Purpose |
| --- | --- | --- |
| **Active-room baton** | `net/active-room.ts` (module-level var) | Carries a *live* socket across a *client-side* navigate. Empty after a reload. |
| **Resume record** | `state/resume.ts` (`localStorage['wog_resume']`) | `{ roomCode, reconnectionToken, seatId, phase }`. Survives a reload; drives the landing auto-redirect and the reconnect path. |
| **Colyseus reconnection token** | issued per room object by the server | The credential `client.reconnect(token)` needs. **Rotates on every new room object** — must be re-persisted after each reconnect. |
| **Server grace window** | `game-room.ts` `allowReconnection(...)` | Holds the seat for N seconds after an unconsented drop. |

### 5.1 Refresh in the lobby

Reload → module reloads (baton empty), socket drops → server `onLeave(consented=false)` in
LOBBY: mark the seat `DISCONNECTED`, open a **60 s** grace window (`LOBBY_RECONNECT_GRACE_S`).
The reloaded page: entry probe re-auths the cookie → landing sees the resume record → redirects
to `/room/:code` → `RoomScreen` probes existence, finds the stored token, `client.reconnect`s
within the grace → seat restored, `LOBBY_STATE` resumes. If the grace expires first, the seat is
freed; the reconnect fails and falls back to a fresh join (lobby seats are re-bindable).

### 5.2 Refresh / drop in a match — single player

Server `handleInMatchDisconnect`: mark seat `DISCONNECTED`, broadcast `CONN_STATUS`. Since only
one seat is down, **the match continues**: if it was that seat's window it is **auto-passed** now
so play never blocks, and a **60 s** in-match grace window (`MATCH_RECONNECT_GRACE_S`) opens.
On reconnect within grace the server **unicasts `RECONNECT_OK`** with a **fresh, fully-filtered
projection for that seat**, and the client seeds the board from that payload's `state` **alone**.

### 5.3 The never-send guarantee on resume (security-critical)

`RECONNECT_OK` (and every `STATE_UPDATE`) carries a freshly computed per-seat projection. On the
client, `enterGameViaReconnect` seeds board state from `msg.state` **only** — it never merges
with, or falls back to, any previously cached state. This is the anchor of the hidden-information
contract across a refresh: a resuming player must never see a field they'd lost entitlement to.
The server produces the filtered projection; the client must not reconstruct anything.

Also re-persist the **rotated** reconnection token on every reconnect — Colyseus issues a new
token per room object, so a *second* refresh must use the newest token, not the stale one.

### 5.4 Second tab / duplicate account

The server keeps `accountToSeat` (JWT `sub` → seat). A join from an account already seated in
this room is rejected in `onAuth` with `ALREADY_IN_ROOM` (re-checked in `onJoin`
defense-in-depth). The client renders the `duplicate` view and keeps the resume (the seat is
alive in the other tab).

### 5.5 Two or more concurrent drops → abort

If `≥2` seats are `DISCONNECTED` at once mid-match, the server **aborts the match**
(`abortMatch`): cancel all open grace windows, broadcast `MATCH_ABORTED`, and **rebuild a fresh
lobby from the surviving connected seats** — preserving the configured seat count and the
survivors' seat indices, freeing the dropped seats, reassigning host to the lowest surviving
seat. No character/score reveal on abort. Everyone lands back in the **same room's** lobby with a
notice. Clients handle this via `MATCH_ABORTED` → `handleAbort`.

---

## 6. The server room in detail

Source: `apps/server/src/rooms/game-room.ts` (+ `room-code.ts`, `room-registry.ts`,
`room-exists.ts`, `message-schemas.ts`).

### 6.1 Lifecycle

- `onCreate(options)` — sets `maxClients = MAX_SEATS` (the hard ceiling), generates a room code,
  builds a `LOBBY` `MatchState` with `DEFAULT_SEATS` slots via the engine's `createLobbyState`,
  registers the room in the code→roomId registry, and binds every message handler.
- `onAuth(client, options, context)` — verifies the JWT from the cookie, then validates room
  preconditions: duplicate-account guard (`ALREADY_IN_ROOM`), code match (`BAD_CODE`), phase is
  `LOBBY` for joiners (`ROOM_IN_PROGRESS`), and capacity — rejected `ROOM_FULL` only when **every
  configured slot is bound**, *not* at `MAX_SEATS`.
- `onJoin(client, _, auth)` — assign the next free seat; the **first** connection becomes host
  and gets `ROOM_CREATED`, others get `JOIN_OK`; broadcast `LOBBY_STATE`.
- `onLeave(client, consented)` — LOBBY vs in-match branch (see §5).
- `onDispose()` — clear timers, unregister the room.

### 6.2 Seat model

- `sessionToSeat: Map<sessionId, SeatId>` and `accountToSeat: Map<sub, SeatId>`.
- The engine `MatchState.players` is a variable-length array of seats; a seat is "bound" when
  `playerId !== null`. Host is a seat index; on host leave it reassigns to the lowest bound seat.
- `ADD_SEAT`/`REMOVE_SEAT` reshape the `players` array via the engine factory while preserving
  each surviving seat's binding (`setSeatCount`). Removal is trailing-empty-only, so indices stay
  stable.

### 6.3 Start & the turn-loop driver

`START_MATCH` re-checks host + `canStartGame` (authoritative gate), then `runSetup(state, rng)`
(deal characters, shuffle decks, pick president, fixed random play order), then `advance()`.
`advance()` is the driver: it runs the engine through every automatic phase transition until it
reaches a state waiting on input or `END`, auto-passing any disconnected seat that owes an action.
Per-seat clocks (`CLOCK_START`/`CLOCK_EXPIRY`), a resolution-reveal hold, and the Herald
event-narration slot are all server-owned. Every outbound `STATE_UPDATE` goes through `project(seat)`
= `projectFor(matchState, seat)` + that seat's actor-filtered Herald sublist.

### 6.4 Move handlers

`PLACE_VOTE`, `ACTIVATE_TEMPORARY_MANDATE`, `PRESIDENT_DECISION`, `MID_TURN_DECISION`,
`END_SUB_TURN`. Each is schema-validated (well-formedness), then checked against universal
authority predicates (right phase, sender owns the active sub-turn, sender is connected), then
handed to the engine. **The acting seat is derived from `sessionToSeat`, never from the message.**
A rejection (`MOVE_REJECTED`) reaches the offending sender **only**, changes nothing, and is
invisible to other seats.

---

## 7. The seat-count model — where "2 to 6" actually lives

The whole table-size policy is **concentrated in a handful of constants and one setup
function**, because the resolution math, batching, president rotation, and clockwise ordering
already walk the `players` array and are seat-count-generic. (Ratified in
`docs/v2/table-size.md`.)

| Concern | File | Current value / rule |
| --- | --- | --- |
| Seat bounds | `packages/engine/src/rules/seats.ts` | `MIN_SEATS = 2`, `MAX_SEATS = 6`, `DEFAULT_SEATS = 4` |
| Lobby factory bound check | `packages/engine/src/state/constructors.ts` | `createLobbyState(..., seatCount)` throws unless `seatCount ∈ [MIN_SEATS, MAX_SEATS]`; **defaults to `5`** if omitted |
| Deal / set-aside | `packages/engine/src/rules/setup.ts` | deal `N` of **10** characters, set aside `10 − N` unseen |
| First president | `setup.ts` | `Math.floor(rng() * N)` |
| Start gate | `setup.ts` `canStartGame` | `N ∈ [MIN_SEATS, MAX_SEATS]` **and** every configured seat bound+ready+connected |
| Win threshold | `packages/engine/src/rules/win-condition.ts` | `winThresholdFor(n) = n <= 3 ? 40 : 30` |
| Propositions per turn | resolution rules | **5**, seat-count-independent |
| Room hard cap | `apps/server/src/rooms/game-room.ts` | `maxClients = MAX_SEATS` |
| Capacity check | `game-room.ts` `verifyAndValidate` | `ROOM_FULL` when all *configured* slots bound |
| Client seat seed | `apps/client/src/screens/RoomLobby.tsx` | seeds `DEFAULT_SEATS` placeholder slots (imported from engine) |
| Client add/remove bounds | `RoomLobby.tsx` | `MAX_CONFIGURED = 6`, `MIN_CONFIGURED = 2` (hardcoded literals) |
| Opponent rail | `apps/client/src/screens/GameBoardScreen.tsx` + `App.css` `.board__rail` | renders `players.filter(p => p.seatId !== me)` — N−1 boxes; rail is a scrolling flex column |

Two invariants that are **not** purely mechanical and matter for player count:

- **No deduction by elimination.** With 10 characters, `10 − N` are set aside unseen. The spec
  requires **≥4 always set aside** so nobody can narrow opponents' hidden characters by
  elimination. This holds for all `N ∈ [2, 6]` (min 4 aside at N=6). **It breaks at N=7** with
  only 10 characters — see §8.4. This is the single most important consequence of raising the
  ceiling.
- **Hidden-info negative tests.** `docs/v2/table-size.md §66` mandates S-PROJECTION negative
  tests proving the set-aside characters never reach any projection at the extreme counts. Any
  new max must be added to those tests.

---

## 8. How to build the same thing for 4–7 players

Target: **`MIN_SEATS = 4`, `MAX_SEATS = 7`**, default somewhere in range. Because the codebase is
already seat-count-generic, the mechanical work is a small, well-bounded diff. **The one real
design decision is the character deck (§8.4).** Do that first.

### 8.1 Engine constants — `packages/engine/src/rules/seats.ts`

```ts
export const MIN_SEATS = 4;      // was 2
export const MAX_SEATS = 7;      // was 6
export const DEFAULT_SEATS = 4;  // still valid; pick any value in [4, 7]
```

Nothing else in `seats.ts` changes. These are the single source the server imports for
create/join/add-remove gating.

### 8.2 Lobby factory default — `packages/engine/src/state/constructors.ts`

`createLobbyState(matchId, hostSeat, seatCount = 5)` — the **default of `5`** is now inside the
new `[4, 7]` range, so it stays legal, but every production caller passes `DEFAULT_SEATS`
explicitly (the server does). Change the default to `DEFAULT_SEATS` value for clarity if you
like. The bound check `seatCount ∈ [MIN_SEATS, MAX_SEATS]` auto-updates from the constants — no
edit needed there.

### 8.3 Setup — `packages/engine/src/rules/setup.ts`

**No code change required.** `runSetup` already uses `n = state.players.length` for the deal,
set-aside slice, and president pick, and `canStartGame` already reads `MIN_SEATS`/`MAX_SEATS`.
Update the **comments** that say "10 − N (≥4 always aside)" and "N ∈ [2,6]" to reflect the new
range — and resolve §8.4 first, because that comment's claim is what changes.

### 8.4 Character deck — the one genuine design decision ⚠️

`packages/engine/src/data/characters.ts` defines **exactly 10 characters**. Setup deals `N` and
sets aside `10 − N`. At the new maximum **N = 7 that leaves only 3 characters set aside**, which
**violates the "≥4 always set aside → no deduction by elimination" invariant** that the current
design guarantees for 2–6.

You must pick one of:

- **(Recommended) Add characters so `MAX_CHARACTERS − MAX_SEATS ≥ 4`.** For `MAX_SEATS = 7` that
  means **≥ 11 characters**; add **2** (to 12) for symmetry and headroom. Each new character needs
  its full data entry, its rules/mandate behaviour, card art (`<card-id>.png`), i18n copy, and
  test coverage — this is real content work, not a constant bump. This is the only option that
  preserves the security property at 7 players.
- **Weaken the invariant deliberately.** Accept 3 set-aside at N=7 and *re-ratify* the
  hidden-info property (update `table-size.md`, the gameplay spec, and the S-PROJECTION tests to
  assert the new floor). Only do this with an explicit design sign-off — it changes what
  opponents can deduce.

Do **not** silently ship 7 players on 10 characters; that quietly downgrades the top security
property. Decide this explicitly before touching anything else.

Everything else in setup (vote deck of 40, council deck of 80, hand cap of 8, propositions = 5)
is seat-count-independent and needs no change for 7 players — the council deck is treated as
effectively infinite (reshuffles its discard), and the vote deck likewise, so adequacy holds.
(Playtest whether 5 propositions/turn still feels right at 7 seats; that's a balance knob, not a
correctness issue.)

### 8.5 Win threshold — `packages/engine/src/rules/win-condition.ts`

Current: `winThresholdFor(n) = n <= 3 ? 40 : 30`. With the new floor of 4 players, the `40`
branch is now **unreachable** — every table is `≥4`, so the function collapses to a flat `30`.
Decide the intended curve:

- **Flat 30** for all 4–7 (simplest; matches today's 4–6 behaviour). Then
  `winThresholdFor` can just `return 30;`.
- **A new curve** if you want longer 7-player games (e.g. `n <= 5 ? 30 : 40`). If you change the
  shape, update the gameplay spec's threshold table and the `win-condition` tests, and note that
  `endMatch` in `game-room.ts` already reads `winThresholdFor(players.length)` for the
  simultaneous-cross narration — no server edit needed, it just follows the engine.

### 8.6 Server — `apps/server/src/rooms/game-room.ts`

**No logic change.** `maxClients = MAX_SEATS`, the capacity check, the start gate, and
`setSeatCount` all derive from the engine constants. It picks up `4`/`7` automatically once the
engine is rebuilt. Only touch the human-readable strings: the `NOT_ENOUGH_READY` message
interpolates `${MIN_SEATS}–${MAX_SEATS}` so it self-updates, but grep for any hardcoded "2–6" in
comments/logs and fix them.

### 8.7 Client — `apps/client/src/screens/RoomLobby.tsx`

Replace the **hardcoded literals**:

```ts
const MAX_CONFIGURED = 7;   // was 6  — better: import MAX_SEATS from '@gosgames/engine'
const MIN_CONFIGURED = 4;   // was 2  — better: import MIN_SEATS from '@gosgames/engine'
```

Strongly prefer importing `MIN_SEATS`/`MAX_SEATS` from the engine (as `DEFAULT_SEATS` already is
imported here) so the client can never drift from the authoritative bounds. The seat-slot seed
(`DEFAULT_SEATS` placeholders) needs no change.

### 8.8 Client board layout — `GameBoardScreen.tsx` + `App.css`

The opponent rail renders `players.filter(p => p.seatId !== me)` → **N−1 boxes**, so at 7 players
it shows **6** opponent boxes (was max 5). The rail (`.board__rail`) is already a vertical flex
column with `overflow-y: auto` and collapsing spacer pseudo-elements, so **6 boxes scroll
gracefully** — no layout breakage, but at 22vh per box they will overflow and require scrolling on
shorter viewports. Decide whether that's acceptable or whether the boxes should shrink at high
seat counts. This is a visual-polish decision, not a correctness one. Update the
`UI_BOARD_LAYOUT.md` note that says "1 to 5 … at a 2–6 player table" to "1 to 6 … at a 4–7 player
table".

### 8.9 Tests & specs (do not skip — this is where the invariant is re-proved)

- **Engine coverage gate ≥90%** must stay green.
- Extend the **S-PROJECTION negative tests** to the new extremes: prove the `MAX_CHARACTERS − N`
  set-aside characters never appear in any projection at **N = 4** and **N = 7**, and that a
  mid-range match still behaves correctly through the parameterized path.
- Update `win-condition` tests for the chosen threshold curve.
- Update the seat-bound tests, `createLobbyState` bound-check tests, and the server integration
  tests that assert `ROOM_FULL`/start-gate at specific counts.
- Update the specs to mirror reality: the gameplay spec's player-count/threshold section, the
  table-size doc, `UI_BOARD_LAYOUT.md`, and any "2–6"/"5-player" prose.

### 8.10 Change checklist (in dependency order)

1. **Decide the character deck** (§8.4) — add characters, or re-ratify the hidden-info floor.
2. **Decide the win-threshold curve** (§8.5).
3. `seats.ts`: `MIN_SEATS = 4`, `MAX_SEATS = 7` (§8.1).
4. `constructors.ts`: default review (§8.2).
5. `setup.ts` + `characters.ts`: implement the §8.4 decision; refresh comments (§8.3).
6. `win-condition.ts`: implement the §8.5 decision.
7. Rebuild the engine dist so the client/server typecheck against fresh types.
8. `RoomLobby.tsx`: seat bounds via engine imports (§8.7).
9. `GameBoardScreen.tsx`/`App.css`: verify/adjust the 6-opponent rail (§8.8).
10. `game-room.ts`: only strings/comments (§8.6).
11. Tests + specs (§8.9).

Because steps 3–10 are almost entirely constant/threshold edits, the *engineering* cost of
4–7 is small. The *design* cost is entirely in step 1 (characters) and step 2 (threshold) — get
those signed off first, then the rest is a mechanical, well-tested bump.

---

## 9. Quick file map (for the Pantheons port)

| Feature | Client | Server | Engine |
| --- | --- | --- | --- |
| App-load auth | `net/entry.ts`, `session.ts`, `handoff.ts` | `/api/auth/*` | — |
| Landing / create / join | `screens/LandingScreen.tsx` | `onAuth`, `onJoin` | — |
| Live-socket handoff across navigate | `net/active-room.ts` | — | — |
| Resume across reload | `state/resume.ts` | `allowReconnection`, grace windows | — |
| Room acquisition state machine | `screens/RoomScreen.tsx` | `room-exists.ts` (`/api/rooms/:code/exists`) | — |
| Lobby UI | `screens/RoomLobby.tsx` | `LOBBY_STATE`, `SET_READY`, `ADD_SEAT`/`REMOVE_SEAT`, `START_MATCH`, `LEAVE_ROOM` | `createLobbyState`, `canStartGame` |
| In-match | `screens/GameBoardScreen.tsx` | move handlers, `advance()`, `projectFor` | `runSetup`, resolution, `win-condition` |
| Seat-count policy | `RoomLobby.tsx` (bounds) | `maxClients`, capacity, gate | `seats.ts`, `setup.ts`, `constructors.ts`, `win-condition.ts` |
</content>
