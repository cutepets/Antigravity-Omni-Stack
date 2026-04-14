<!-- Generated: 2026-04-14 | Files scanned: ~400 | Token estimate: ~400 -->
# Backend Architecture

## Key Services
- `apps/api`: NestJS backend providing RESTful APIs.
- `@petshop/auth`: Core authentication (JWT) and RBAC logic.
- `@petshop/database`: Prisma ORM client and schemas.
- `@petshop/queue`: Background job processing with BullMQ.
- `@petshop/config`: Centralized environment configurations using Zod validation.
- `@petshop/shared`: Shared types, constants, layout metadata, and utility functions.

## Major Modules
- Grooming/Spa Module
- Hotel Module (Slots, Bookings, Check-ins)
- Inventory Module (Counting, Supplier Management)
- Orders/POS Module
- Staff Module
- Financial/Transactions Module

## Data Flow
Frontend (Next.js) -> Backend (NestJS API Hub) -> Database (Prisma / PostgreSQL)
                                              -> Cache / Queue (Redis / BullMQ)
