---
name: verify
description: Launch the real Pantheons stack (Postgres + server + built SPA) and drive a 2-player game (browser host + headless colyseus.js bot) to verify changes at the runtime surface.
---

# Verify Pantheons end-to-end

## Build

```bash
pnpm install --frozen-lockfile
pnpm build:engine   # REQUIRED first: server/client typecheck+build resolve @pantheons/engine from dist
pnpm build          # builds engine, server (server/dist), client (client/dist)
```

## Stack (no docker needed if a local Postgres cluster exists)

```bash
pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER pantheons PASSWORD 'pantheons';" -c "CREATE DATABASE pantheons OWNER pantheons;"

cd server && DATABASE_URL="postgres://pantheons:pantheons@localhost:5432/pantheons" \
  HANDOFF_JWT_SECRET=devsecret SESSION_JWT_SECRET=devsecret2 INTERNAL_SERVICE_TOKEN=devtok \
  ADMIN_USER_IDS="user-jules" PORT=2567 node dist/index.js &
```

- The server serves the built SPA itself (same origin) at `http://localhost:2567`.
- Migrations run at boot (`db migrations applied` in the log).
- `ADMIN_USER_IDS` makes that host account able to start a 2-player test game
  (lobby defaults to 4 seats — the host must click « Retirer un siège » twice).

## Auth handoff

Mint an HS256 JWT with claims `{iss:'gosgames', aud:'pantheons', access:true, sub, username, iat, exp}`
signed with `HANDOFF_JWT_SECRET`, then open `http://localhost:2567/#token=<jwt>` in the browser.
Headless clients POST it to `/auth/exchange` → `{sessionToken}`.

## Bot second player (headless colyseus.js — no browser)

`colyseus.js` is in `client/node_modules` (symlink it into your script dir). Join:
probe `GET /api/rooms/<CODE>/exists` → `new Client('ws://localhost:2567').joinById(roomId, {sessionToken, roomCode})`.
Then `room.send('SET_READY',{ready:true})`. Register `room.onMessage` for at least:
`state` (per-seat projection: `.tour/.phase/.barrier.submitted/.self`), `error`, `JOIN_OK`,
`LOBBY_STATE`, `event`, `gameOver`, `reveal`, `RECONNECT_OK`, `CONN_STATUS`.

Phase submissions: `pioche` (`{}` or `{discardPowerId}` when `self.powerCards.length > 1`),
`question` (`{intent:{plays:[]}, specialePlays:[]}` = pass), `declaration` (`{}` = pass).

## Browser host (Playwright, chromium preinstalled)

Global `playwright` package (symlink from `/opt/node22/lib/node_modules/playwright`).
Useful selectors: buttons by French label (« Créer un salon », « Je suis prêt »,
« Démarrer la partie », « Valider la pioche », « Passer sans question », « Passer »,
« Déclarer « Panthéons » ») ; tracker ticks `.pret-tique--ok[aria-label*="<name>"]` ;
confirmation chip `.fait-chip` ; active phase `.traqueur__etape--active`.
Room code is in the URL after creation (`/room/<CODE>`). Viewport 1440×900 avoids layout surprises.

## Gotchas

- In a 2-player game the LAST submitter of a phase never sees its « ✓ Validé/Passé » chip —
  the barrier completes and the phase advances instantly. To observe an actor's own
  confirmation, have it submit FIRST while the other holds.
- Watch page WebSocket frames (`page.on('websocket')`, `framesent`) to assert protocol
  behavior (e.g. no `REQUEST_STATE` polling).
- Kill the server and `pg_ctlcluster 16 main stop` when done.
