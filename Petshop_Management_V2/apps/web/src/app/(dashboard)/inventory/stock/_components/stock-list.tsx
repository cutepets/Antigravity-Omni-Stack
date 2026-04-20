'use client'
import Image from 'next/image';

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Download, PackageCheck, Pin, PinOff } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { stockApi } from '@/lib/api/stock.api'
import {

  DataListShell,
  DataListToolbar,
  DataListFilterPanel,
  DataListColumnPanel,
  DataListTable,
  DataListPagination,
  DataListBulkBar,
  TableCheckbox,
  toolbarSelectClass,
  filterSelectClass,
  useDataListCore,
  useDataListSelection,
} from '@petshop/ui/data-list'

// Shift label helper
const SHIFT_LABELS: Record<string, string> = {
  MON_A: 'T2 | A', MON_B: 'T2 | B', MON_C: 'T2 | C', MON_D: 'T2 | D',
  TUE_A: 'T3 | A', TUE_B: 'T3 | B', TUE_C: 'T3 | C', TUE_D: 'T3 | D',
  WED_A: 'T4 | A', WED_B: 'T4 | B', WED_C: 'T4 | C', WED_D: 'T4 | D',
  THU_A: 'T5 | A', THU_B: 'T5 | B', THU_C: 'T5 | C', THU_D: 'T5 | D',
  FRI_A: 'T6 | A', FRI_B: 'T6 | B', FRI_C: 'T6 | C', FRI_D: 'T6 | D',
  SAT_A: 'T7 | A', SAT_B: 'T7 | B', SAT_C: 'T7 | C', SAT_D: 'T7 | D',
}

function formatShiftLabel(shift: string): string {
  return SHIFT_LABELS[shift] ?? shift
}

type DisplayColumnId = 'code' | 'name' | 'sellable' | 'monthlySellThrough' | 'minStock' | 'stock' | 'status' | 'countShift'
type PinFilterId = 'type'

type StockRow = {
  id: string
  productId: string
  productVariantId?: string | null
  inventoryItemType: 'PRODUCT' | 'VARIANT'
  name: string
  variantName?: string | null
  unitLabel?: string | null
  displayName: string
  sku?: string | null
  image?: string | null
  unit?: string | null
  currentStock: number
  sellableStock: number
  minStock: number
  monthlySellThrough?: number | null
  status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  completedBatchCount?: number
  lastCountShift?: string | null
}

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'code', label: 'Ma SP', sortable: true, width: 'w-28' },
  { id: 'name', label: 'San pham / phien ban', sortable: true, minWidth: 'min-w-[260px]' },
  { id: 'sellable', label: 'Co the ban', sortable: true, width: 'w-32' },
  { id: 'monthlySellThrough', label: 'Hieu suat ban thang', sortable: true, width: 'w-40' },
  { id: 'minStock', label: 'Dinh muc toi thieu', sortable: true, width: 'w-32' },
  { id: 'stock', label: 'Ton kho hien tai', sortable: true, width: 'w-32' },
  { id: 'countShift', label: 'Ca làm', sortable: false, width: 'w-32' },
  { id: 'status', label: 'Trang thai', sortable: true, width: 'w-32' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(COLUMN_OPTIONS.filter((column) => column.sortable).map((column) => column.id))

function renderStatusBadge(status: StockRow['status']) {
  if (status === 'OUT_OF_STOCK') {
    return (
      <span className="badge badge-error">
        <AlertCircle size={11} /> Het hang
      </span>
    )
  }

  if (status === 'LOW_STOCK') {
    return (
      <span className="badge badge-warning">
        <AlertCircle size={11} /> Sap het
      </span>
    )
  }

  return <span className="badge badge-success">Binh thuong</span>
}

function buildStockDetailHref(row: StockRow) {
  if (!row.productVariantId) return `/inventory/stock/${row.productId}`
  return `/inventory/stock/${row.productId}?${new URLSearchParams({ variantId: row.productVariantId }).toString()}`
}

export function StockList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const reportSource = searchParams.get('from')
  const scopedBranchId = searchParams.get('branchId')?.trim() || ''
  const scopedDateFrom = searchParams.get('dateFrom')?.trim() || ''
  const scopedDateTo = searchParams.get('dateTo')?.trim() || ''

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'name', 'sellable', 'monthlySellThrough', 'minStock', 'stock', 'status'],
    initialTopFilterVisibility: { type: true },
  })
  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  useEffect(() => {
    const nextSearch = searchParams.get('search') ?? ''
    const nextFilterType = searchParams.get('filterType') ?? 'ALL'
    const nextPage = Number(searchParams.get('page') ?? '1')
    const nextPageSize = Number(searchParams.get('limit') ?? '20')

    setSearch((current) => (current !== nextSearch ? nextSearch : current))
    setFilterType((current) => (current !== nextFilterType ? nextFilterType : current))
    setPage((current) => (Number.isFinite(nextPage) && nextPage > 0 ? (current !== nextPage ? nextPage : current) : current !== 1 ? 1 : current))
    setPageSize((current) =>
      Number.isFinite(nextPageSize) && nextPageSize > 0 ? (current !== nextPageSize ? nextPageSize : current) : current !== 20 ? 20 : current,
    )
  }, [searchParams])

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (search.trim()) nextParams.set('search', search.trim())
    else nextParams.delete('search')

    if (filterType !== 'ALL') nextParams.set('filterType', filterType)
    else nextParams.delete('filterType')

    if (page > 1) nextParams.set('page', String(page))
    else nextParams.delete('page')

    if (pageSize !== 20) nextParams.set('limit', String(pageSize))
    else nextParams.delete('limit')

    const currentQuery = searchParams.toString()
    const nextQuery = nextParams.toString()
    if (currentQuery !== nextQuery) {
      router.replace(nextQuery ? `/inventory/stock?${nextQuery}` : '/inventory/stock', { scroll: false })
    }
  }, [filterType, page, pageSize, router, search, searchParams])

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-stock-products', search, filterType, scopedBranchId || 'all', page, pageSize, columnSort.columnId, columnSort.direction],
    queryFn: () =>
      stockApi.getProducts({
        search,
        branchId: scopedBranchId || undefined,
        filterType,
        page,
        limit: pageSize,
        sortBy: columnSort.columnId || undefined,
        sortOrder: (columnSort.direction as 'asc' | 'desc') || undefined,
      }),
  })

  const rows = useMemo(
    () => (Array.isArray((data as any)?.data) ? ((data as any).data as StockRow[]) : []),
    [data],
  )
  const totalPages = (data as any)?.totalPages ?? 1
  const total = (data as any)?.total ?? rows.length

  const visibleRowIds = useMemo(() => rows.map((row) => `stock:${row.id}`), [rows])
  const { selectedRowIds, toggleRowSelection, toggleSelectAllVisible, clearSelection, allVisibleSelected } = useDataListSelection(visibleRowIds)

  const activeColumns = useMemo(
    () =>
      orderedVisibleColumns.map((id) => {
        const column = COLUMN_OPTIONS.find((item) => item.id === id)!
        return { ...column, id: id as DisplayColumnId }
      }),
    [orderedVisibleColumns],
  )

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rows.length)

  const clearFilters = () => {
    setFilterType('ALL')
    setSearch('')
    setPage(1)
  }

  const toggleColumnSort = (columnId: DisplayColumnId) => {
    if (!SORTABLE_COLUMNS.has(columnId)) return
    dataListState.toggleColumnSort(columnId)
  }

  return (
    <DataListShell>
      {reportSource === 'reports' ? (
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary-500/15 bg-primary-500/5 px-4 py-3 text-sm text-foreground">
          <span className="font-semibold text-primary-600">Dang mo tu bao cao</span>
          {scopedBranchId ? <span className="rounded-full bg-background px-3 py-1 text-xs">Chi nhanh: {scopedBranchId}</span> : null}
          {scopedDateFrom && scopedDateTo ? (
            <span className="rounded-full bg-background px-3 py-1 text-xs">
              Pham vi ngay: {scopedDateFrom} den {scopedDateTo}
            </span>
          ) : null}
          <span className="rounded-full bg-background px-3 py-1 text-xs">Ton kho la snapshot hien tai</span>
        </div>
      ) : null}

      <DataListToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder="Tim ten san pham, phien ban, SKU..."
        showColumnToggle={true}
        showFilterToggle={true}
        filterSlot={
          topFilterVisibility.type ? (
            <select
              value={filterType}
              onChange={(event) => {
                setFilterType(event.target.value)
                setPage(1)
              }}
              className={toolbarSelectClass}
            >
              <option value="ALL">Tat ca mat hang</option>
              <option value="LOW_STOCK">Sap het hang</option>
            </select>
          ) : null
        }
        columnPanelContent={
          <DataListColumnPanel
            columns={COLUMN_OPTIONS}
            columnOrder={columnOrder}
            visibleColumns={visibleColumns}
            sortInfo={columnSort}
            sortableColumns={SORTABLE_COLUMNS}
            draggingColumnId={draggingColumnId}
            onToggle={(id) => dataListState.toggleColumn(id as DisplayColumnId)}
            onReorder={(sourceId, targetId) => dataListState.reorderColumn(sourceId as DisplayColumnId, targetId as DisplayColumnId)}
            onToggleSort={(id) => toggleColumnSort(id as DisplayColumnId)}
            onDragStart={(id) => dataListState.setDraggingColumnId(id as DisplayColumnId)}
            onDragEnd={() => dataListState.setDraggingColumnId(null)}
          />
        }
        extraActions={
          <div className="flex items-center gap-2">
            <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background-secondary px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/60">
              <Download size={15} /> Xuat kho
            </button>
          </div>
        }
      />

      <DataListFilterPanel onClearAll={clearFilters}>
        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-2">
              <PackageCheck size={14} className="text-primary-500" /> Loai ton kho
            </span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('type')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${topFilterVisibility.type ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              {topFilterVisibility.type ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
            value={filterType}
            onChange={(event) => {
              setFilterType(event.target.value)
              setPage(1)
            }}
            className={filterSelectClass}
          >
            <option value="ALL">Tat ca mat hang</option>
            <option value="LOW_STOCK">Sap het hang</option>
          </select>
        </label>
      </DataListFilterPanel>

      <DataListTable
        columns={activeColumns}
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
        emptyText="Khong co du lieu ton kho."
        allSelected={allVisibleSelected}
        onSelectAll={toggleSelectAllVisible}
        bulkBar={
          selectedRowIds.size > 0 ? (
            <DataListBulkBar selectedCount={selectedRowIds.size} onClear={clearSelection}>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background-secondary px-3 text-xs font-semibold text-foreground transition-colors hover:bg-background-tertiary"
              >
                <Download size={13} /> Khac
              </button>
            </DataListBulkBar>
          ) : undefined
        }
      >
        {rows.map((row) => {
          const rowSelectionId = `stock:${row.id}`
          const isSelected = selectedRowIds.has(rowSelectionId)
          const isLowStock = row.status === 'LOW_STOCK' || row.status === 'OUT_OF_STOCK'
          const stockTone = row.status === 'OUT_OF_STOCK' ? 'text-error' : isLowStock ? 'text-warning' : 'text-emerald-500'
          const detailHref = buildStockDetailHref(row)

          return (
            <tr
              key={row.id}
              className={`border-b border-border/50 transition-colors hover:bg-background-secondary/40 ${isSelected ? 'bg-primary-500/5' : ''}`}
            >
              <td className="w-10 px-3 py-3">
                <TableCheckbox checked={isSelected} onCheckedChange={(_, shiftKey) => toggleRowSelection(rowSelectionId, shiftKey)} />
              </td>

              {orderedVisibleColumns.map((columnId) => {
                switch (columnId) {
                  case 'code':
                    return (
                      <td key={columnId} className="w-28 px-3 py-3">
                        {row.sku ? (
                          <span className="w-fit rounded-md bg-primary-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary-500">
                            {row.sku}
                          </span>
                        ) : (
                          <span className="text-xs text-foreground-muted">-</span>
                        )}
                      </td>
                    )

                  case 'name':
                    return (
                      <td key={columnId} className="min-w-[260px] px-3 py-3">
                        <div className="flex items-center gap-3">
                          {row.image ? (
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-background-secondary">
                              <Image src={row.image} alt={row.displayName} className="h-full w-full object-cover" width={400} height={400} unoptimized />
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background-secondary text-foreground-muted">
                              <PackageCheck size={18} />
                            </div>
                          )}

                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => router.push(detailHref)}
                              title={row.displayName}
                              className="block truncate text-left font-semibold text-foreground transition-colors hover:text-primary-500"
                            >
                              {row.displayName}
                            </button>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted">
                              <span>{row.unit ?? 'cai'}</span>
                              {row.variantName ? <span className="rounded-full bg-background-secondary px-2 py-0.5">Phien ban: {row.variantName}</span> : null}
                              {row.unitLabel ? <span className="rounded-full bg-background-secondary px-2 py-0.5">Don vi: {row.unitLabel}</span> : null}
                              <span>{row.completedBatchCount ? `${row.completedBatchCount} lo da ban het` : 'Chua du du lieu chu ky'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    )

                  case 'sellable':
                    return (
                      <td key={columnId} className="w-32 px-3 py-3 text-right font-semibold text-primary-500">
                        {row.sellableStock ?? 0}
                      </td>
                    )

                  case 'monthlySellThrough':
                    return (
                      <td key={columnId} className="w-40 px-3 py-3 text-right text-sm">
                        {row.monthlySellThrough != null ? (
                          <span className="font-semibold text-foreground">{Math.round(row.monthlySellThrough).toLocaleString('vi-VN')}</span>
                        ) : (
                          <span className="text-foreground-muted">Chua du du lieu</span>
                        )}
                      </td>
                    )

                  case 'minStock':
                    return (
                      <td key={columnId} className="w-32 px-3 py-3 text-right text-sm text-foreground-muted">
                        {row.minStock ?? 0}
                      </td>
                    )

                  case 'stock':
                    return (
                      <td key={columnId} className={`w-32 px-3 py-3 text-right text-lg font-bold ${stockTone}`}>
                        {row.currentStock ?? 0}
                      </td>
                    )

                  case 'status':
                    return (
                      <td key={columnId} className="w-32 px-3 py-3">
                        {renderStatusBadge(row.status)}
                      </td>
                    )

                  case 'countShift':
                    return (
                      <td key={columnId} className="w-32 px-3 py-3">
                        {row.lastCountShift ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2.5 py-1 text-xs font-medium text-primary-600">
                            {formatShiftLabel(row.lastCountShift)}
                          </span>
                        ) : (
                          <span className="text-xs text-foreground-muted">—</span>
                        )}
                      </td>
                    )

                  default:
                    return null
                }
              })}
            </tr>
          )
        })}
      </DataListTable>

      <div className="-mt-1">
        <div className="rounded-b-2xl border border-t-0 border-border bg-card/95">
          <DataListPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[20, 50, 100]}
            totalItemText={
              <span className="text-xs">
                Tong <strong className="text-foreground">{total}</strong> mat hang
              </span>
            }
          />
        </div>
      </div>
    </DataListShell>
  )
}
