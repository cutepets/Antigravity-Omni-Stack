<!-- Generated: 2026-04-14 | Files scanned: ~400 | Token estimate: ~500 -->
# Frontend Architecture

## Stack
- Framework: Next.js (App Router)
- UI Library: React, Radix UI primitives
- Styling: Tailwind CSS
- State Management: Zustand, React Query (TanStack Query)
- Components: Shadcn/ui

## Key Directories
- `apps/web/src/app/(dashboard)`: Main application views separated by domain (grooming, inventory, orders, pos, hotels, staff).
- `apps/web/src/components`: Reusable UI components.
- `apps/web/src/hooks`: Custom React hooks logic.
- `apps/web/src/lib`: API clients, parsers, formatters.
- `apps/web/src/stores`: Zustand state stores.

## Routing Flow
The application utilizes Next.js App Router. Pages are segregated under domain-specific folders, employing standard Next.js conventions (`page.tsx`, `layout.tsx`).

## Global Behaviors
Includes client-side routing, shared layouts for dashboard, server-side data mutations via hooks/api integration, and unified auth guard context.
