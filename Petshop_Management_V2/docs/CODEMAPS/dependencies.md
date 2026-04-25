<!-- Generated: 2026-04-25 | Files scanned: ~500 | Token estimate: ~350 -->
# Dependencies Architecture

## Core Platforms
- Node.js (Runtime)
- PostgreSQL (Primary DB)
- Redis (Job queues / caching)

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
