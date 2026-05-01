<!-- Generated: 2026-05-01 | Files scanned: 1110 | Token estimate: ~900 -->
# Frontend Architecture

## Stack
- Framework: Next.js (App Router)
- UI Library: React, Radix UI primitives
- Styling: Tailwind CSS
- State Management: Zustand, React Query (TanStack Query)
- Components: Shadcn/ui

## Key Directories
- `apps/web/src/app/(dashboard)`: Main application views separated by domain.
- `apps/web/src/app/(auth)`: Authentication views, including login.
- `apps/web/src/components`: Reusable UI components (service-pricing, products, shared).
- `apps/web/src/hooks`: Custom React hooks logic.
- `apps/web/src/lib/api/`: Domain-specific API clients (order, inventory, hotel, pet, pricing, staff, customer, finance, grooming).
- `apps/web/src/stores`: Zustand state stores.
- `apps/web/src/middleware.ts`: Auth/session route protection and redirects.

## Dashboard Pages (21 domains)
- **POS**: Branch selection, cart management, payment flow, stock validation
- **Orders**: Order list, detail, creation, return/exchange modal
- **Products**: Product list, detail, form modal, inventory settings drawer
- **Inventory**: Stock overview, purchase receipts (create/detail), counting sessions, suppliers
- **Grooming**: Service board with scheduling
- **Hotel**: Cage grid, stay list, stay details dialog
- **Customers/CRM**: Customer list, detail, loyalty history, Excel import/export
- **Pets**: Pet list with profile management
- **Staff**: Staff list, detail, documents, schedule, attendance integration
- **Finance**: Voucher detail, finance workspace
- **Equipment**: Detail, scan pages
- **Promotions/Rewards**: Campaign and reward workflows
- **Reports/Schedule/Leave/Payroll/Attendance**: Operational support pages
- **Settings**: General settings, module config, Google OAuth, Google Drive, backup and About tab
- **Service Pricing**: Shared pricing workspace (grooming + hotel panels, Excel import/export)

## Routing & Navigation
- Standard Next.js App Router (`next/navigation`) with `page.tsx`/`layout.tsx`.
- Modal View State: Finance vouchers, pet details use `window.history.pushState` + local `useState` to avoid layout remount.
- Tab titles follow `{emoji} {Page Name} | Cutepets` format.
- Root `app/page.tsx` redirects authenticated product usage to `/dashboard`.
