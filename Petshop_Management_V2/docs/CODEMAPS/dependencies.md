<!-- Generated: 2026-05-01 | Files scanned: 1110 | Token estimate: ~500 -->
# Dependencies Architecture

## Core Platforms
- Node.js 20 (runtime)
- pnpm 10.33.0 (package manager)
- PostgreSQL 16 (primary DB)
- Redis 7 (job queues / caching)
- Docker Compose (production packaging and runtime)

## Framework Dependencies
- NestJS (Backend framework)
- Next.js (Frontend framework)
- Prisma (ORM)
- BullMQ (Queues)
- Tailwind CSS / Radix UI (Styling & Accessibility UI)
- Turborepo (Monorepo orchestration)

## Key Libraries
- `zod`: Schema validation throughout the monorepo.
- `zustand`, `react-query`: Frontend state management.
- `passport`, `passport-jwt`, `passport-google-oauth20`, `bcryptjs`: Backend auth.
- `@googleapis/drive`: Google Drive integration for storage.
- `xlsx`: Excel import/export for pricing data.

## Deployment Dependencies
- `Dockerfile`: Multi-stage build for `api-runner` and `web-runner` images.
- `docker-compose.prod.yml`: PostgreSQL, Redis, API and Web services.
- `deploy/deploy.sh`: VPS release script for pull, build, recreate, migrate and health check.
