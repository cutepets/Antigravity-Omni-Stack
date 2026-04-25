<!-- Generated: 2026-04-25 | Files scanned: ~500 | Token estimate: ~600 -->
# Frontend Architecture

## Stack
- Framework: Next.js (App Router)
- UI Library: React, Radix UI primitives
- Styling: Tailwind CSS
- State Management: Zustand, React Query (TanStack Query)
- Components: Shadcn/ui

## Key Directories
- `apps/web/src/app/(dashboard)`: Main application views separated by domain.
- `apps/web/src/components`: Reusable UI components (service-pricing, products, shared).
- `apps/web/src/hooks`: Custom React hooks logic.
- `apps/web/src/lib/api/`: Domain-specific API clients (order, inventory, hotel, pet, pricing, staff, customer, finance, grooming).
- `apps/web/src/stores`: Zustand state stores.

## Dashboard Pages (18 domains)
- **POS**: Branch selection, cart management, payment flow, stock validation
- **Orders**: Order list, detail, creation, return/exchange modal
- **Products**: Product list, detail, form modal, inventory settings drawer
- **Inventory**: Stock overview, purchase receipts (create/detail), counting sessions, suppliers
- **Grooming**: Service board with scheduling
- **Hotel**: Cage grid, stay list, stay details dialog
- **Customers**: Customer list with search
- **Pets**: Pet list with profile management
- **Staff**: Staff list, detail (documents, preview modal)
- **Finance**: Voucher detail, finance workspace
- **Equipment**: Detail, scan pages
- **Reports/Rewards/Schedule/Leave/Payroll**: Supporting pages
- **Settings**: General settings tab (Google Drive config)
- **Service Pricing**: Shared pricing workspace (grooming + hotel panels, Excel import/export)

## Routing & Navigation
- Standard Next.js App Router (`next/navigation`) with `page.tsx`/`layout.tsx`.
- Modal View State: Finance vouchers, pet details use `window.history.pushState` + local `useState` to avoid layout remount.
- Tab titles follow `{emoji} {Page Name} | Cutepets` format.
