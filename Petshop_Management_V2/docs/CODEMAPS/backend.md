<!-- Generated: 2026-04-25 | Files scanned: ~500 | Token estimate: ~500 -->
# Backend Architecture

## Key Services
- `apps/api`: NestJS backend providing RESTful APIs.
- `@petshop/auth`: Core authentication (JWT, Google OAuth) and RBAC logic.
- `@petshop/database`: Prisma ORM client and schemas.
- `@petshop/queue`: Background job processing with BullMQ.
- `@petshop/config`: Centralized environment configurations using Zod validation.
- `@petshop/shared`: Shared types, constants, layout metadata, and utility functions.

## API Modules (22 modules)
- **Auth**: JWT login, Google OAuth, bootstrap/seed, RBAC guards
- **Customer**: CRUD, search, loyalty
- **Pet**: Profiles, breed/species sync, attribute management
- **Orders/POS**: Order creation, stock validation per branch, return/exchange requests
- **Inventory**: Stock tracking, purchase receipts, stock counting sessions, supplier management
- **Grooming/Spa**: Appointment scheduling, service boards
- **Hotel**: Room/cage management, check-in/out, daycare combos, automation service
- **Pricing**: Service pricing (grooming + hotel), Excel import/export
- **Staff**: Staff CRUD, schedule, attendance, leave, payroll, document management
- **Equipment**: Asset tracking, QR scanning
- **Finance**: Vouchers, transaction workspace
- **Reports**: Revenue analytics, operational reports
- **Storage**: Local file storage + Google Drive provider
- **Settings**: System-wide configurations
- **Roles/Shifts/Schedule/Attendance/Leave/Payroll**: HR modules

## Data Flow
Frontend (Next.js) -> Backend (NestJS API Hub) -> Database (Prisma / PostgreSQL)
                                              -> Cache / Queue (Redis / BullMQ)
                                              -> Storage (Local / Google Drive)
