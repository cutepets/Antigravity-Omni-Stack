<!-- Generated: 2026-04-25 | Files scanned: ~500 | Token estimate: ~600 -->
# System Architecture

## Overview
Petshop Management V2 is a full-stack monorepo managed with Turborepo, comprising a Next.js (App Router) frontend and a NestJS backend.

## Structure
```
Petshop_Management_V2/
├── apps/
│   ├── web/ (Frontend Next.js)
│   └── api/ (Backend NestJS)
└── packages/
    ├── @petshop/auth (Auth & RBAC)
    ├── @petshop/config (Env validations)
    ├── @petshop/core (Core domains)
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
