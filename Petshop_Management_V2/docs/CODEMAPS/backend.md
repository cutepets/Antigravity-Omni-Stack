<!-- Generated: 2026-05-01 | Files scanned: 1110 | Token estimate: ~800 -->
# Backend Architecture

## Key Services
- `apps/api`: NestJS backend providing RESTful APIs.
- `@petshop/auth`: Core authentication (JWT, Google OAuth) and RBAC logic.
- `@petshop/database`: Prisma ORM client and schemas.
- `@petshop/queue`: Background job processing with BullMQ.
- `@petshop/config`: Centralized environment configurations using Zod validation.
- `@petshop/shared`: Shared types, constants, layout metadata, and utility functions.
- `@petshop/api-client`: DTO/client contracts shared with the web app.

## API Modules (24 modules)
- **Auth**: JWT login, Google OAuth, bootstrap/seed, RBAC guards
- **Customer/CRM**: CRUD, search, loyalty, Excel import/export, customer classification
- **Pet**: Profiles, breed/species sync, attribute management
- **Orders/POS**: Order creation, stock validation per branch, return/exchange requests
- **Inventory**: Stock tracking, purchase receipts, stock counting sessions, supplier management
- **Grooming/Spa**: Appointment scheduling, service boards
- **Hotel**: Room/cage management, check-in/out, daycare combos, automation service
- **Pricing**: Service pricing (grooming + hotel), Excel import/export
- **Staff**: Staff CRUD, Excel import/export, schedule, attendance, leave, payroll, document management
- **Equipment**: Asset tracking, QR scanning
- **Finance**: Vouchers, transaction workspace
- **Reports**: Revenue analytics, operational reports
- **Storage**: Local file storage + Google Drive provider
- **Settings**: System-wide configurations
- **Roles/Shifts/Schedule/Attendance/Leave/Payroll**: HR modules
- **Promotions/Stock/Stock Count/Queue**: campaign rules, stock operations, counting sessions and background work

## Data Flow
Frontend (Next.js) -> Backend (NestJS API Hub) -> Database (Prisma / PostgreSQL)
                                              -> Cache / Queue (Redis / BullMQ)
                                              -> Storage (Local / Google Drive)

## Runtime Notes
- API container listens on port `3001`; production Compose exposes it locally as `127.0.0.1:3003`.
- Required production secrets are loaded from `/root/petshop/.env` via `env_file`.
- Prisma migrations are deployed from the API container during `deploy/deploy.sh`.
