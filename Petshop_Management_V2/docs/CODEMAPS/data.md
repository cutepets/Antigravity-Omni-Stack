<!-- Generated: 2026-05-01 | Files scanned: 1110 | Token estimate: ~600 -->
# Data Architecture

## Primary Database
- PostgreSQL (via Prisma ORM `@petshop/database`)
- Redis is used for queue/cache workloads through BullMQ.

## Key Entities
- **Users/Staff**: RBAC-based access, roles mapping (admin, manager, staff).
- **Core Operations**: Bookings (Grooming / Spa / Hotel), Inventory Stock, Products, Services.
- **Transactions**: Orders (POS), Invoices, Shifts, Return/Exchange Requests.
- **Support**: Customers, CRM history, Pets Profiles, Check-In configurations, Equipment tracking.
- **Pricing**: Service pricing tables for grooming and hotel/daycare combos.
- **Storage**: File metadata for local and Google Drive assets.
- **HR/Finance**: Attendance, leave, payroll, vouchers and cash shift data.

## Tooling
- `prisma/schema.prisma`: The central truth for database schemas.
- `seed.ts`: Comprehensive seeding logic for development data.
- `packages/database/prisma/migrations`: Production migration history deployed by `prisma migrate deploy`.
- `APP_SECRET_ENCRYPTION_KEY`: Required for encrypted integration secrets in production.
