<!-- Generated: 2026-04-14 | Files scanned: ~400 | Token estimate: ~300 -->
# Data Architecture

## Primary Database
- PostgreSQL (via Prisma ORM `@petshop/database`)

## Key Entities
- **Users/Staff**: RBAC-based access, roles mapping (admin, manager, staff).
- **Core Operations**: Bookings (Grooming / Spa / Hotel), Inventory Stock, Products, Services.
- **Transactions**: Orders (POS), Invoices, Shifts.
- **Support**: Customers, Pets Profiles, Check-In configurations.

## Tooling
- `prisma.schema.prisma`: The central truth for database schemas.
- `demo-data.ts`, `seed.ts`: Comprehensive seeding logic extending dummy 30-50 dataset records.
