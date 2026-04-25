# ═══════════════════════════════════════════════════════════════
# Petshop Management V2 — Multi-stage Docker Build
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Base ─────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ── Stage 2: Dependencies ────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/dataloader/package.json ./packages/dataloader/package.json
RUN pnpm install --no-frozen-lockfile

# ── Stage 3: Source ──────────────────────────────────────────
FROM deps AS source
COPY . .

# ── Stage 4: Generate Prisma Client ─────────────────────────
FROM source AS prisma
RUN cd packages/database && DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm exec prisma generate --schema=prisma/schema.prisma
# Locate where prisma client was generated for later COPY
RUN find /app -path '*/node_modules/.prisma/client' -type d | head -1 > /tmp/prisma_client_path

# ── Stage 5: Build API ───────────────────────────────────────
FROM prisma AS build-api
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm --filter @petshop/database build 2>/dev/null || true
RUN pnpm --filter @petshop/shared build 2>/dev/null || true
RUN pnpm --filter @petshop/core build 2>/dev/null || true
RUN pnpm --filter @petshop/auth build 2>/dev/null || true
RUN pnpm --filter @petshop/queue build 2>/dev/null || true
RUN pnpm --filter @petshop/dataloader build 2>/dev/null || true
RUN pnpm --filter @petshop/api build

# ── Stage 6: Build Web ───────────────────────────────────────
FROM prisma AS build-web
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Build-time env vars (will be overridden at runtime via .env)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @petshop/shared build 2>/dev/null || true
RUN pnpm --filter @petshop/auth build 2>/dev/null || true
RUN pnpm --filter @petshop/ui build 2>/dev/null || true
RUN pnpm --filter @petshop/api-client build 2>/dev/null || true
RUN pnpm --filter @petshop/web build

# ── Stage 7: Production API Runner ───────────────────────────
FROM node:20-alpine AS api-runner
WORKDIR /app

ENV NODE_ENV=production

# Copy full node_modules (includes hoisted prisma client)
COPY --from=build-api /app/node_modules ./node_modules
COPY --from=build-api /app/package.json ./package.json
COPY --from=build-api /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy API build output
COPY --from=build-api /app/apps/api/dist ./apps/api/dist
COPY --from=build-api /app/apps/api/package.json ./apps/api/package.json
COPY --from=build-api /app/apps/api/node_modules ./apps/api/node_modules

# Copy packages (compiled + node_modules)
COPY --from=build-api /app/packages ./packages

# Copy Prisma schema for migrations
COPY --from=prisma /app/packages/database/prisma ./packages/database/prisma

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3001
CMD ["node", "apps/api/dist/apps/api/src/main.js"]

# ── Stage 8: Production Web Runner ───────────────────────────
FROM node:20-alpine AS web-runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Copy standalone output
COPY --from=build-web /app/apps/web/.next/standalone ./
COPY --from=build-web /app/apps/web/.next/static ./apps/web/.next/static/
RUN mkdir -p ./apps/web/public
COPY --from=build-web /app/apps/web/public ./apps/web/public/

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
