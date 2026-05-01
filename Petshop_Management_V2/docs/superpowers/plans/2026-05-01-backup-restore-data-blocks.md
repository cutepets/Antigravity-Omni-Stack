# Backup Restore Data Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add business-level Backup and Restore data block selection while preserving the current module-based `.appbak` format.

**Architecture:** Keep existing backup modules as the durable backend contract. Add data block metadata over those modules, return it from the catalog endpoint, and let the frontend map block selections into the same `modules: string[]` payloads used today.

**Tech Stack:** NestJS, Jest, Prisma-backed backup registry, Next.js client component, React Query, TypeScript.

---

## File Structure

- Modify `Petshop_Management_V2/apps/api/src/modules/settings/backup/backup.types.ts`
  - Add `BackupDataBlockId` and `BackupDataBlockCatalogEntry`.
  - Add optional `dataBlocks` to the catalog response shape through exported types.
- Modify `Petshop_Management_V2/apps/api/src/modules/settings/backup/backup.registry.ts`
  - Define the four business data blocks near the module registry.
  - Export `getBackupDataBlockCatalogEntries()`.
- Modify `Petshop_Management_V2/apps/api/src/modules/settings/backup/backup.service.ts`
  - Return `{ modules, dataBlocks }` from `getCatalog()`.
- Modify `Petshop_Management_V2/apps/api/src/modules/settings/backup/backup.service.spec.ts`
  - Add a failing test for the four data block mappings.
  - Update any catalog expectations if needed.
- Modify `Petshop_Management_V2/apps/web/src/lib/api/settings.api.ts`
  - Add data block types.
  - Change `getBackupCatalog()` to return `{ modules, dataBlocks }` while accepting old array response defensively.
- Modify `Petshop_Management_V2/apps/web/src/app/(dashboard)/settings/components/TabBackup.tsx`
  - Use data block cards as the primary export and restore selection UI.
  - Keep module previews and existing validation behavior.

## Task 1: Backend Data Block Catalog

**Files:**
- Modify: `Petshop_Management_V2/apps/api/src/modules/settings/backup/backup.types.ts`
- Modify: `Petshop_Management_V2/apps/api/src/modules/settings/backup/backup.registry.ts`
- Modify: `Petshop_Management_V2/apps/api/src/modules/settings/backup/backup.service.ts`
- Test: `Petshop_Management_V2/apps/api/src/modules/settings/backup/backup.service.spec.ts`

- [ ] **Step 1: Run impact analysis before editing backup symbols**

Run:

```bash
# MCP, not shell:
gitnexus_impact({ "repo": "Dev2", "target": "BackupService", "direction": "upstream" })
gitnexus_impact({ "repo": "Dev2", "target": "getBackupCatalogEntries", "direction": "upstream" })
gitnexus_impact({ "repo": "Dev2", "target": "BackupCatalogEntry", "direction": "upstream", "relationTypes": ["IMPORTS"] })
```

Expected: report direct callers/importers and risk level before editing. If any result is HIGH or CRITICAL, warn the user before continuing.

- [ ] **Step 2: Write the failing backend catalog test**

Add this test to `backup.service.spec.ts` inside `describe('BackupService', () => { ... })`:

```ts
  it('exposes business data blocks for backup selection', () => {
    const { service } = createService()

    const catalog = service.getCatalog()

    expect(catalog.data.dataBlocks).toEqual([
      {
        blockId: 'configuration',
        label: 'Cấu hình hệ thống và cấu hình ở các mục',
        description: expect.any(String),
        moduleIds: ['core.settings', 'finance.configuration', 'catalog.items'],
      },
      {
        blockId: 'staff_equipment',
        label: 'Nhân viên, chấm công, bảng lương, thưởng phạt, trang thiết bị',
        description: expect.any(String),
        moduleIds: ['core.organization', 'hr.workforce', 'assets.equipment'],
      },
      {
        blockId: 'customers_pets',
        label: 'Khách hàng, thú cưng, điểm',
        description: expect.any(String),
        moduleIds: ['crm.contacts'],
      },
      {
        blockId: 'operations',
        label: 'Đơn hàng, thu chi, grooming, hotel',
        description: expect.any(String),
        moduleIds: ['operations.commerce'],
      },
    ])
    expect(catalog.data.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ moduleId: 'core.settings' }),
        expect.objectContaining({ moduleId: 'operations.commerce' }),
      ]),
    )
  })
```

- [ ] **Step 3: Run the backend test to verify it fails**

Run:

```bash
cd Petshop_Management_V2
pnpm --filter @petshop/api test -- backup.service.spec.ts
```

Expected: FAIL because `catalog.data.dataBlocks` is undefined and `catalog.data.modules` is not yet the response shape.

- [ ] **Step 4: Add backend data block types**

In `backup.types.ts`, add:

```ts
export type BackupDataBlockId =
  | 'configuration'
  | 'staff_equipment'
  | 'customers_pets'
  | 'operations'

export interface BackupDataBlockCatalogEntry {
  blockId: BackupDataBlockId
  label: string
  description: string
  moduleIds: BackupModuleId[]
}

export interface BackupCatalogResult {
  modules: BackupCatalogEntry[]
  dataBlocks: BackupDataBlockCatalogEntry[]
}
```

- [ ] **Step 5: Add data block registry metadata**

In `backup.registry.ts`, update the import:

```ts
import type {
  BackupCatalogEntry,
  BackupDataBlockCatalogEntry,
  BackupModuleId,
} from './backup.types.js'
```

Add this after `registry` is defined:

```ts
const dataBlocks = [
  {
    blockId: 'configuration',
    label: 'Cấu hình hệ thống và cấu hình ở các mục',
    description:
      'Cấu hình hệ thống, mẫu in, cấu hình module, thanh toán, thu chi, danh mục, dịch vụ, bảng giá, lồng/phòng và quy tắc giá.',
    moduleIds: ['core.settings', 'finance.configuration', 'catalog.items'],
  },
  {
    blockId: 'staff_equipment',
    label: 'Nhân viên, chấm công, bảng lương, thưởng phạt, trang thiết bị',
    description:
      'Chi nhánh, vai trò, tài khoản, lịch làm, nghỉ phép, chấm công, bảng lương, dòng thưởng phạt và trang thiết bị.',
    moduleIds: ['core.organization', 'hr.workforce', 'assets.equipment'],
  },
  {
    blockId: 'customers_pets',
    label: 'Khách hàng, thú cưng, điểm',
    description:
      'Nhóm khách hàng, hồ sơ khách hàng, thú cưng, lịch sử cân nặng, tiêm phòng, ghi chú sức khỏe, timeline và điểm theo ranh giới dữ liệu hiện có.',
    moduleIds: ['crm.contacts'],
  },
  {
    blockId: 'operations',
    label: 'Đơn hàng, thu chi, grooming, hotel',
    description:
      'Đơn hàng, thanh toán, thu chi, giao dịch ngân hàng, grooming, hotel, trả hàng, timeline và két tiền.',
    moduleIds: ['operations.commerce'],
  },
] satisfies BackupDataBlockCatalogEntry[]
```

Add this export near the other catalog exports:

```ts
export function getBackupDataBlockCatalogEntries(): BackupDataBlockCatalogEntry[] {
  return dataBlocks.map((entry) => ({
    blockId: entry.blockId,
    label: entry.label,
    description: entry.description,
    moduleIds: [...entry.moduleIds],
  }))
}
```

- [ ] **Step 6: Return modules and dataBlocks from the service catalog**

In `backup.service.ts`, update imports:

```ts
  getBackupCatalogEntries,
  getBackupDataBlockCatalogEntries,
  getBackupModuleDefinition,
```

Update `getCatalog()`:

```ts
  getCatalog() {
    return {
      success: true,
      data: {
        modules: getBackupCatalogEntries(),
        dataBlocks: getBackupDataBlockCatalogEntries(),
      },
    }
  }
```

- [ ] **Step 7: Run the backend test to verify it passes**

Run:

```bash
cd Petshop_Management_V2
pnpm --filter @petshop/api test -- backup.service.spec.ts
```

Expected: PASS for `backup.service.spec.ts`.

## Task 2: Frontend API Types For Catalog Blocks

**Files:**
- Modify: `Petshop_Management_V2/apps/web/src/lib/api/settings.api.ts`

- [ ] **Step 1: Run impact analysis before editing frontend API types**

Run:

```bash
# MCP, not shell:
gitnexus_impact({ "repo": "Dev2", "target": "BackupCatalogEntry", "direction": "upstream", "relationTypes": ["IMPORTS"] })
```

Expected: report importers, including `TabBackup`.

- [ ] **Step 2: Update frontend catalog types**

In `settings.api.ts`, after `BackupCatalogEntry`, add:

```ts
export type BackupDataBlockCatalogEntry = {
  blockId: 'configuration' | 'staff_equipment' | 'customers_pets' | 'operations'
  label: string
  description: string
  moduleIds: string[]
}

export type BackupCatalogResult = {
  modules: BackupCatalogEntry[]
  dataBlocks: BackupDataBlockCatalogEntry[]
}
```

- [ ] **Step 3: Update `getBackupCatalog()` defensively**

Replace `getBackupCatalog` with:

```ts
  getBackupCatalog: async (): Promise<BackupCatalogResult> => {
    const { data } = await api.get('/settings/backups/catalog')
    const payload = data.data ?? {}

    if (Array.isArray(payload)) {
      return {
        modules: payload,
        dataBlocks: [],
      }
    }

    return {
      modules: Array.isArray(payload.modules) ? payload.modules : [],
      dataBlocks: Array.isArray(payload.dataBlocks) ? payload.dataBlocks : [],
    }
  },
```

- [ ] **Step 4: Run frontend type-check to expose downstream changes**

Run:

```bash
cd Petshop_Management_V2
pnpm --filter @petshop/web type-check
```

Expected: FAIL in `TabBackup.tsx` because `catalogQuery.data` is now an object, not an array.

## Task 3: Export Block Selection UI

**Files:**
- Modify: `Petshop_Management_V2/apps/web/src/app/(dashboard)/settings/components/TabBackup.tsx`

- [ ] **Step 1: Run impact analysis before editing `TabBackup`**

Run:

```bash
# MCP, not shell:
gitnexus_impact({ "repo": "Dev2", "target": "TabBackup", "direction": "upstream" })
gitnexus_impact({ "repo": "Dev2", "target": "expandModules", "direction": "upstream" })
```

Expected: report direct callers/importers and risk level before editing.

- [ ] **Step 2: Update imports**

In `TabBackup.tsx`, add the block type:

```ts
  type BackupDataBlockCatalogEntry,
```

- [ ] **Step 3: Add block helper functions**

Add these functions after `sumRecordCounts`:

```ts
function modulesFromBlocks(
  blockIds: string[],
  dataBlocks: BackupDataBlockCatalogEntry[],
  availableModuleIds?: Set<string>,
) {
  const blockMap = new Map(dataBlocks.map((entry) => [entry.blockId, entry]))
  const selected = new Set<string>()

  for (const blockId of blockIds) {
    const block = blockMap.get(blockId as BackupDataBlockCatalogEntry['blockId'])
    if (!block) continue

    for (const moduleId of block.moduleIds) {
      if (!availableModuleIds || availableModuleIds.has(moduleId)) {
        selected.add(moduleId)
      }
    }
  }

  return [...selected]
}

function isBlockAvailableForRestore(
  block: BackupDataBlockCatalogEntry,
  availableModuleIds: Set<string>,
) {
  return block.moduleIds.some((moduleId) => availableModuleIds.has(moduleId))
}
```

- [ ] **Step 4: Replace module state with block state**

Replace:

```ts
  const [exportModules, setExportModules] = useState<string[]>([])
```

with:

```ts
  const [exportBlocks, setExportBlocks] = useState<string[]>([])
```

Add catalog derived values after `configQuery`:

```ts
  const catalogModules = catalogQuery.data?.modules ?? []
  const catalogDataBlocks = catalogQuery.data?.dataBlocks ?? []

  const exportModules = useMemo(
    () => modulesFromBlocks(exportBlocks, catalogDataBlocks),
    [catalogDataBlocks, exportBlocks],
  )
```

Update export preview:

```ts
    () => expandModules(exportModules, catalogModules),
    [catalogModules, exportModules],
```

- [ ] **Step 5: Replace `toggleExportModule` with `toggleExportBlock`**

Replace the function with:

```ts
  const toggleExportBlock = (blockId: string) => {
    if (!canManageBackup) return
    setExportBlocks((current) =>
      current.includes(blockId)
        ? current.filter((entry) => entry !== blockId)
        : [...current, blockId],
    )
  }
```

- [ ] **Step 6: Replace the export module checkbox grid**

Replace the export grid that maps `(catalogQuery.data ?? []).map((entry) => { ... })` with:

```tsx
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {catalogDataBlocks.map((entry) => {
                const checked = exportBlocks.includes(entry.blockId)
                return (
                  <label
                    key={entry.blockId}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${
                      checked
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border/40 bg-background-base'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExportBlock(entry.blockId)}
                      className="mt-1 h-4 w-4 rounded border-border/50"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground-base">
                        {entry.label}
                      </div>
                      <div className="mt-2 text-xs text-foreground-muted">
                        {entry.description}
                      </div>
                      <div className="mt-2 text-xs text-foreground-muted">
                        Module: {entry.moduleIds.join(', ')}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
```

- [ ] **Step 7: Update export validation text**

Change:

```ts
      toast.error('Cần chọn ít nhất 1 module để backup')
```

to:

```ts
      toast.error('Cần chọn ít nhất 1 khối dữ liệu để backup')
```

- [ ] **Step 8: Run frontend type-check**

Run:

```bash
cd Petshop_Management_V2
pnpm --filter @petshop/web type-check
```

Expected: type-check may still fail until restore UI is updated in Task 4; any remaining failures should point to restore usage of `catalogQuery.data` or stale module state.

## Task 4: Restore Block Selection UI

**Files:**
- Modify: `Petshop_Management_V2/apps/web/src/app/(dashboard)/settings/components/TabBackup.tsx`

- [ ] **Step 1: Add restore block state and derived module set**

Replace:

```ts
  const [restoreModules, setRestoreModules] = useState<string[]>([])
```

with:

```ts
  const [restoreBlocks, setRestoreBlocks] = useState<string[]>([])
```

Add these derived values near other restore `useMemo` calls:

```ts
  const inspectedModuleIds = useMemo(
    () => new Set((inspectedBackup?.modules ?? []).map((entry) => entry.moduleId)),
    [inspectedBackup?.modules],
  )

  const restoreModules = useMemo(
    () => modulesFromBlocks(restoreBlocks, catalogDataBlocks, inspectedModuleIds),
    [catalogDataBlocks, inspectedModuleIds, restoreBlocks],
  )
```

- [ ] **Step 2: Update inspect success and file reset state**

In `inspectMutation.onSuccess`, replace `setRestoreModules(...)` with:

```ts
        const compatibleModuleIds = new Set(
          result.modules
            .filter((entry) => entry.compatible)
            .map((entry) => entry.moduleId),
        )
        setRestoreBlocks(
          catalogDataBlocks
            .filter((block) =>
              block.moduleIds.some((moduleId) => compatibleModuleIds.has(moduleId)),
            )
            .map((block) => block.blockId),
        )
```

Replace all `setRestoreModules([])` calls with:

```ts
      setRestoreBlocks([])
```

- [ ] **Step 3: Replace `toggleRestoreModule` with `toggleRestoreBlock`**

Replace the function with:

```ts
  const toggleRestoreBlock = (blockId: string) => {
    if (!canManageBackup) return
    setRestoreBlocks((current) =>
      current.includes(blockId)
        ? current.filter((entry) => entry !== blockId)
        : [...current, blockId],
    )
  }
```

- [ ] **Step 4: Replace restore module checkbox grid with block grid**

Replace the grid under `Chọn module cần khôi phục` with:

```tsx
                <div className="text-sm font-semibold text-foreground-base">Chọn khối dữ liệu cần khôi phục</div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {catalogDataBlocks.map((entry) => {
                    const available = isBlockAvailableForRestore(entry, inspectedModuleIds)
                    const checked = restoreBlocks.includes(entry.blockId)
                    const blockModules = inspectedBackup.modules.filter((moduleEntry) =>
                      entry.moduleIds.includes(moduleEntry.moduleId),
                    )
                    const compatible = blockModules.some((moduleEntry) => moduleEntry.compatible)
                    const totalRecords = blockModules.reduce(
                      (total, moduleEntry) => total + sumRecordCounts(moduleEntry.recordCounts),
                      0,
                    )

                    return (
                      <label
                        key={entry.blockId}
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${
                          checked
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-border/40 bg-background-base'
                        } ${!available ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!available || !compatible}
                          onChange={() => toggleRestoreBlock(entry.blockId)}
                          className="mt-1 h-4 w-4 rounded border-border/50"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground-base">
                            <span>{entry.label}</span>
                            {available && compatible ? (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                                Có thể khôi phục
                              </span>
                            ) : available ? (
                              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300">
                                Không tương thích
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs text-foreground-muted">
                                Không có trong file
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-foreground-muted">
                            {entry.description}
                          </div>
                          <div className="mt-2 text-xs text-foreground-muted">
                            {totalRecords} bản ghi • Module trong file: {blockModules.map((moduleEntry) => moduleEntry.moduleId).join(', ') || 'Không có'}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
```

- [ ] **Step 5: Update restore validation text**

Change:

```ts
      toast.error('Cần chọn ít nhất 1 module để khôi phục')
```

to:

```ts
      toast.error('Cần chọn ít nhất 1 khối dữ liệu để khôi phục')
```

- [ ] **Step 6: Run frontend type-check**

Run:

```bash
cd Petshop_Management_V2
pnpm --filter @petshop/web type-check
```

Expected: PASS or only unrelated pre-existing type errors. Any `TabBackup.tsx` errors must be fixed before continuing.

## Task 5: Verification And Scope Check

**Files:**
- Verify changes in all modified files.

- [ ] **Step 1: Run backend backup tests**

Run:

```bash
cd Petshop_Management_V2
pnpm --filter @petshop/api test -- backup.service.spec.ts backup.format.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run frontend type-check**

Run:

```bash
cd Petshop_Management_V2
pnpm --filter @petshop/web type-check
```

Expected: PASS or report unrelated existing errors separately.

- [ ] **Step 3: Run GitNexus detect changes**

Run:

```bash
# MCP, not shell:
gitnexus_detect_changes({ "repo": "Dev2", "scope": "all" })
```

Expected: changes include the planned backup files plus the already-existing dirty workspace files. Confirm the backup-related changed symbols are expected.

- [ ] **Step 4: Inspect git diff for touched files only**

Run:

```bash
cd Petshop_Management_V2
git diff -- apps/api/src/modules/settings/backup/backup.types.ts apps/api/src/modules/settings/backup/backup.registry.ts apps/api/src/modules/settings/backup/backup.service.ts apps/api/src/modules/settings/backup/backup.service.spec.ts apps/web/src/lib/api/settings.api.ts "apps/web/src/app/(dashboard)/settings/components/TabBackup.tsx" docs/superpowers/specs/2026-05-01-backup-restore-data-blocks-design.md docs/superpowers/plans/2026-05-01-backup-restore-data-blocks.md
```

Expected: diff only contains backup data block work and docs.

