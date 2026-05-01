# Backup And Restore Data Blocks Design

## Context

The current Backup and Restore screen lets Super Admin users select low-level backup modules such as `core.settings`, `catalog.items`, `crm.contacts`, and `operations.commerce`. The requested change is to let users select broader business data blocks:

- System configuration and all configurable sections.
- Staff, attendance, payroll, rewards/penalties, and equipment.
- Customers, pets, and points.
- Orders, cashbook/finance operations, grooming, and hotel.

The existing module registry, dependency expansion, encrypted `.appbak` archive format, inspect flow, and `replace_selected` restore strategy should remain compatible with existing backups.

## Goals

- Add business-level data block selection for backup export.
- Add matching business-level data block selection for restore after inspecting a backup file.
- Preserve the current backend module IDs and archive manifest shape so old backup files still inspect and restore.
- Keep dependency expansion behavior so selecting a block still includes required backing data.
- Make it clear in the UI which modules will actually be included/restored after dependency expansion.

## Non-Goals

- Do not replace the low-level module registry with four large module definitions.
- Do not change encryption, file format, Google Drive upload behavior, or restore strategy.
- Do not implement partial row-level restore within a module.
- Do not redesign unrelated settings tabs.

## Data Blocks

### Configuration

Label: `Cấu hình hệ thống và cấu hình ở các mục`

Modules:

- `core.settings`
- `finance.configuration`
- `catalog.items`

This includes system configuration, print templates, module configuration, storage asset references, payment/cashbook configuration, payment methods, webhook secrets, categories, brands, units, services, price books, hotel rate tables, cages, hotel price rules, grooming/spa price rules, and holiday calendar configuration.

### Staff And Equipment

Label: `Nhân viên, chấm công, bảng lương, thưởng phạt, trang thiết bị`

Modules:

- `core.organization`
- `hr.workforce`
- `assets.equipment`

`core.organization` is included because HR and equipment data depend on branches, roles, and users. Rewards and penalties are included through the current payroll/workforce module boundary if they are represented in payroll line items or related HR records.

### Customers And Pets

Label: `Khách hàng, thú cưng, điểm`

Modules:

- `crm.contacts`

This includes customer groups, customers, pets, weight logs, vaccinations, health notes, and pet timelines. Customer points follow the existing schema boundary: if points are stored on customer/contact records, they are covered by this block; if points are stored only in order/payment history, they are covered by the operations block through the existing module registry.

### Operations

Label: `Đơn hàng, thu chi, grooming, hotel`

Modules:

- `operations.commerce`

This includes orders, order items, payments, timelines, payment intents, bank transactions, payment webhook events, grooming sessions/timelines, hotel stays/timelines/health logs/charges/adjustments, return requests, transactions, and cash vault entries. Existing dependency expansion will include required configuration, organization, customers, and catalog data when needed.

## Backend Design

Add a block/group definition beside the backup module registry. Each block has:

- Stable `blockId`.
- Vietnamese label.
- Description.
- Ordered module IDs.

The catalog endpoint should include both:

- Existing module catalog entries.
- New data block catalog entries.

Existing API payloads continue to use `modules: string[]`. The backend does not need a new restore/export payload shape for the first implementation. It may expose block metadata only for UI selection.

Server-side export and restore continue to validate module IDs, expand dependencies, check restore blockers, and sort by dependencies exactly as they do today.

## Frontend Design

Update `TabBackup` to present data blocks as the primary selection surface.

For export:

- Show four block checkboxes/cards.
- Selecting a block selects its configured module IDs.
- If multiple blocks overlap or dependencies expand, the preview continues to show the final module set.
- Keep the existing destination and password controls.

For restore:

- After inspect, show the same four blocks, but only enable a block if at least one of its modules exists in the inspected backup.
- Selecting a block selects the compatible modules from that block that are present in the backup.
- Preserve existing module compatibility checks and reverse dependency blockers.
- Keep a final module preview so the user can see the actual restore set.

Low-level module details may remain visible in previews or secondary detail rows, but the main workflow should be block-based.

## Error Handling

- If a selected block maps to no available restore modules in the inspected archive, it should not be selectable.
- Existing backend errors for missing dependencies, incompatible module versions, unsupported strategy, invalid password, and invalid file format remain unchanged.
- Restore should remain blocked when the selected module set violates reverse dependency rules.

## Testing

Backend tests:

- Catalog exposes the four data blocks with the expected module mappings.
- Existing export/inspect/restore tests continue to pass.

Frontend or UI logic tests where practical:

- Selecting the configuration block maps to `core.settings`, `finance.configuration`, and `catalog.items`.
- Selecting staff/equipment maps to `core.organization`, `hr.workforce`, and `assets.equipment`.
- Restore block selection ignores modules absent from the inspected backup.
- Existing dependency preview behavior still expands selected modules.

Manual verification:

- Open the Backup tab as Super Admin.
- Export each block to download.
- Inspect a generated `.appbak` file.
- Select a restore block and confirm the final restore module preview matches expectations.

## Rollout

This is backward-compatible with existing `.appbak` files because the archive still stores module manifests and module payloads. The new block catalog is UI metadata over the existing module system.
