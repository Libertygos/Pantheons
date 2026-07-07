# syntax=docker/dockerfile:1
# Multi-stage production build (mirrors WoG): one image — the Node server with the
# built React SPA baked in, served same-origin. Built only in CI, pushed to GHCR.

# ── Stage 1: deps — install the workspace with a frozen lockfile ──────────────────────
FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# ── Stage 2: build — compile engine + server, bundle the client, prune to prod ────────
FROM deps AS build
WORKDIR /app
RUN pnpm --filter @pantheons/engine build \
  && pnpm --filter @pantheons/server build \
  && pnpm --filter @pantheons/client build
# Self-contained prod deployment of the server (workspace @pantheons/engine injected,
# dev dependencies dropped) into /prod/server. Ships drizzle/ for boot-time migrations.
RUN pnpm --filter @pantheons/server deploy --legacy --prod /prod/server

# ── Stage 3: runtime — slim, non-root, server output + prod deps + SPA bundle ─────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=2567
ENV CLIENT_DIST=/app/public
WORKDIR /app
# Server compiled output + production node_modules (incl. the built engine).
COPY --from=build --chown=node:node /prod/server ./
# Built React SPA, served same-origin by the Node process.
COPY --from=build --chown=node:node /app/client/dist ./public
USER node
EXPOSE 2567
CMD ["node", "dist/index.js"]
