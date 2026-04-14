<!-- Generated: 2026-04-14 | Files scanned: ~400 | Token estimate: ~300 -->
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
- `zod`: Schema validaton throughout the monolithic architecture.
- `zustand`, `react-query`: Frontend state management.
- `passport`, `passport-jwt`, `bcryptjs`: Backend auth.
