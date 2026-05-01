<!-- Generated: 2026-05-01 | Files scanned: 1110 | Token estimate: ~800 -->
# System Architecture

## Overview
Petshop Management V2 is a full-stack operations platform for pet shop chains. The codebase is a pnpm/Turborepo monorepo with a Next.js App Router frontend, NestJS API, shared domain packages, PostgreSQL persistence, Redis-backed queues, and Docker Compose production deployment.

## Structure
```
Petshop_Management_V2/
├── apps/
│   ├── web/ (Frontend Next.js)
│   └── api/ (Backend NestJS)
└── packages/
    ├── @petshop/auth (Auth & RBAC)
    ├── @petshop/api-client (DTO/client contracts)
    ├── @petshop/config (Env validations)
    ├── @petshop/core (Core domains)
    ├── @petshop/dataloader (Seed/load utilities)
    ├── @petshop/database (Prisma + PostgreSQL)
    ├── @petshop/queue (BullMQ task definitions)
    └── @petshop/shared (Types, Utils, Constants)
```

## Internal Data Flow
- `apps/web` interacts with `apps/api` via REST (centralized API client in `lib/api/`).
- `apps/api` uses shared DTOs from `@petshop/shared` and module-level DTOs.
- `apps/api` interfaces with `@petshop/database` for persistence (Prisma).
- `@petshop/queue` enables asynchronous background processing (hotel/daycare automation).
- Storage module supports local disk + Google Drive integration.

## Production Flow
- Runtime is defined by `docker-compose.prod.yml`.
- `deploy/deploy.sh` pulls branch `codex/baseline-upgrade`, builds `api-runner` and `web-runner` Docker targets, recreates containers, runs Prisma migrations, and performs API/Web health checks.
- Public traffic is handled outside Compose by VPS nginx; containers bind locally to `127.0.0.1:3003` for API and `127.0.0.1:3002` for Web.
