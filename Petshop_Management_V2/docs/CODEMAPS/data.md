<!-- Generated: 2026-04-25 | Files scanned: ~500 | Token estimate: ~350 -->
# Data Architecture

## Primary Database
- PostgreSQL (via Prisma ORM `@petshop/database`)

## Key Entities
- **Users/Staff**: RBAC-based access, roles mapping (admin, manager, staff).
- **Core Operations**: Bookings (Grooming / Spa / Hotel), Inventory Stock, Products, Services.
- **Transactions**: Orders (POS), Invoices, Shifts, Return/Exchange Requests.
- **Support**: Customers, Pets Profiles, Check-In configurations, Equipment tracking.
- **Pricing**: Service pricing tables for grooming and hotel/daycare combos.
- **Storage**: File metadata for local and Google Drive assets.

## Tooling
- `prisma/schema.prisma`: The central truth for database schemas.
- `seed.ts`: Comprehensive seeding logic for development data.
