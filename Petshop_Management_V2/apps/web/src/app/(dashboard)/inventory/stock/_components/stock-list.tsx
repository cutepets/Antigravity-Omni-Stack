'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Download, PackageCheck, Pin, PinOff } from 'lucide-react'
import { stockApi } from '@/lib/api/stock.api'
import { useRouter, useSearchParams } from 'next/navigation'
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
} from '@/components/data-list'

type DisplayColumnId = 'code' | 'name' | 'sellable' | 'monthlySellThrough' | 'minStock' | 'stock' | 'status' | 'actions'
type PinFilterId = 'type'

type StockRow = {
  id: string
  name: string
  sku?: string | null
  image?: string | null
  unit?: string | null
  currentStock: number
  sellableStock: number
  minStock: number
  monthlySellThrough?: number | null
  status: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  completedBatchCount?: number
}

const NEXT_COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'code', label: 'Ma SP', sortable: true, width: 'w-24' },
  { id: 'name', label: 'San pham', sortable: true, minWidth: 'min-w-[240px]' },
  { id: 'sellable', label: 'Co the ban', sortable: true, width: 'w-32' },
  { id: 'monthlySellThrough', label: 'Hieu suat ban thang', sortable: true, width: 'w-40' },
  { id: 'minStock', label: 'Dinh muc toi thieu', sortable: true, width: 'w-32' },
  { id: 'stock', label: 'Ton kho hien tai', sortable: true, width: 'w-32' },
  { id: 'status', label: 'Trang thai', sortable: true, width: 'w-32' },
]

/* legacy inventory columns retained from the old table config
  { id: 'code', label: 'Mã SP', sortable: true, width: 'w-24' },
  { id: 'name', label: 'Sản phẩm', sortable: true, minWidth: 'min-w-[180px]' },
  { id: 'minStock', label: 'Định mức tối thiểu', sortable: true, width: 'w-32' },
  { id: 'stock', label: 'Tồn kho hiện tại', sortable: true, width: 'w-32' },
  { id: 'status', label: 'Trạng thái', width: 'w-32' },
  { id: 'actions', label: 'Thao tác', width: 'w-28' },
]
*/

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(
  NEXT_COLUMN_OPTIONS.filter((c) => c.sortable).map((c) => c.id)
)

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

export function StockList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL') // ALL, LOW_STOCK
  const [page, setPage] = useState(1)

  const [pageSize, setPageSize] = useState(20)
  const reportSource = searchParams.get('from')
  const scopedBranchId = searchParams.get('branchId')?.trim() || ''
  const scopedDateFrom = searchParams.get('dateFrom')?.trim() || ''
  const scopedDateTo = searchParams.get('dateTo')?.trim() || ''

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: NEXT_COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'name', 'sellable', 'monthlySellThrough', 'minStock', 'stock', 'status'],
    initialTopFilterVisibility: { type: true }
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
    queryFn: () => stockApi.getProducts({
      search,
      branchId: scopedBranchId || undefined,
      filterType,
      page,
      limit: pageSize,
      sortBy: columnSort.columnId || undefined,
      sortOrder: (columnSort.direction as 'asc' | 'desc') || undefined,
    }),
  })

  const products = Array.isArray((data as any)?.data) ? ((data as any).data as StockRow[]) : []
  const totalPages = (data as any)?.totalPages ?? 1
  const total = (data as any)?.total ?? products.length

  const visibleRowIds = useMemo(
    () => products.map((p: any) => `p:${p.id}`),
    [products]
  )

  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visibleRowIds)

  const activeColumns = useMemo(() => {
    return orderedVisibleColumns.map((id) => {
      const col = NEXT_COLUMN_OPTIONS.find((c) => c.id === id)!
      return { ...col, id: id as DisplayColumnId }
    })
  }, [orderedVisibleColumns])

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd   = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + products.length)

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
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Tìm tên sản phẩm, SKU..."
        showColumnToggle={true}
        showFilterToggle={true}
        filterSlot={
          <>
            {topFilterVisibility.type && (
              <select
                value={filterType}
                onChange={e => { setFilterType(e.target.value); setPage(1) }}
                className={toolbarSelectClass}
              >
                <option value="ALL">Tất cả sản phẩm</option>
                <option value="LOW_STOCK">Sắp hết hàng</option>
              </select>
            )}
          </>
        }
        columnPanelContent={
          <DataListColumnPanel
            columns={NEXT_COLUMN_OPTIONS}
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
              <Download size={15} /> Xuất kho
            </button>
          </div>
        }
      />

      <DataListFilterPanel onClearAll={clearFilters}>
        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-2">
              <PackageCheck size={14} className="text-primary-500" /> Loại tồn kho
            </span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('type')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                topFilterVisibility.type ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {topFilterVisibility.type ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1) }}
            className={filterSelectClass}
          >
            <option value="ALL">Tất cả sản phẩm</option>
            <option value="LOW_STOCK">Sắp hết hàng</option>
          </select>
        </label>
      </DataListFilterPanel>

      <DataListTable
        columns={activeColumns}
        isLoading={isLoading}
        isEmpty={!isLoading && products.length === 0}
        emptyText="Không có dữ liệu tồn kho."
        allSelected={allVisibleSelected}
        onSelectAll={toggleSelectAllVisible}
        bulkBar={
          selectedRowIds.size > 0 ? (
            <DataListBulkBar
              selectedCount={selectedRowIds.size}
              onClear={clearSelection}
            >
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background-secondary px-3 text-xs font-semibold text-foreground transition-colors hover:bg-background-tertiary"
              >
                <Download size={13} /> Khác
              </button>
            </DataListBulkBar>
          ) : undefined
        }
      >
        {products.map((p: StockRow) => {
          const isLowStock = p.status === 'LOW_STOCK' || p.status === 'OUT_OF_STOCK'
          const stockTone = p.status === 'OUT_OF_STOCK' ? 'text-error' : isLowStock ? 'text-warning' : 'text-emerald-500'
          const rowId = `p:${p.id}`
          const isSelected = selectedRowIds.has(rowId)

          return (
            <tr 
              key={p.id} 
              className={`border-b border-border/50 transition-colors hover:bg-background-secondary/40 ${isSelected ? 'bg-primary-500/5' : ''}`}
            >
              <td className="w-10 px-3 py-3">
                <TableCheckbox 
                  checked={isSelected}
                  onCheckedChange={(checked, shiftKey) => toggleRowSelection(rowId, shiftKey)}
                />
              </td>
              {orderedVisibleColumns.map(columnId => {
                switch(columnId) {
                  case 'code': return (
                    <td key={columnId} className="px-3 py-3 w-24">
                      {p.sku && <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md w-fit">{p.sku}</span>}
                    </td>
                  );
                  case 'name': return (
                    <td key={columnId} className="px-3 py-3 min-w-[240px]">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-background-secondary border border-border">
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-background-secondary border border-border text-foreground-muted">
                            <PackageCheck size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => router.push(`/inventory/stock/${p.id}`)}
                            title={p.name}
                            className="block truncate text-left font-semibold text-foreground transition-colors hover:text-primary-500"
                          >
                            {p.name}
                          </button>
                          <div className="text-xs text-foreground-muted">
                            {p.unit ?? 'cai'}
                            {p.completedBatchCount ? ` · ${p.completedBatchCount} lo da ban het` : ' · Chua du du lieu chu ky'}
                          </div>
                        </div>
                      </div>
                    </td>
                  );
                  case 'sellable': return (
                    <td key={columnId} className="px-3 py-3 text-right font-semibold text-primary-500 w-32">
                      {p.sellableStock ?? 0}
                    </td>
                  );
                  case 'monthlySellThrough': return (
                    <td key={columnId} className="px-3 py-3 text-right text-sm w-40">
                      {p.monthlySellThrough != null ? (
                        <span className="font-semibold text-foreground">
                          {Math.round(p.monthlySellThrough).toLocaleString('vi-VN')}
                        </span>
                      ) : (
                        <span className="text-foreground-muted">Chua du du lieu</span>
                      )}
                    </td>
                  );
                  case 'minStock': return (
                    <td key={columnId} className="px-3 py-3 text-right text-sm text-foreground-muted w-32">{p.minStock ?? 0}</td>
                  );
                  case 'stock': return (
                    <td key={columnId} className={`px-3 py-3 text-right font-bold text-lg w-32 ${stockTone}`}>
                      {p.currentStock ?? 0}
                    </td>
                  );
                  case 'status': return (
                    <td key={columnId} className="px-3 py-3 w-32">
                      {renderStatusBadge(p.status)}{/*
                         <span className="badge badge-error"><AlertCircle size={11} /> Sắp hết</span>
                      ) : (
                         <span className="badge badge-success">Bình thường</span>
                      )}
                    */}</td>
                  );
                  case 'actions': return (
                    <td key={columnId} className="px-3 py-3 w-28">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/inventory/stock/${p.id}`)}
                          className="text-xs font-medium bg-background-tertiary hover:bg-border px-3 py-1.5 rounded-lg border border-border"
                        >
                          Lịch sử
                        </button>
                        <button
                          onClick={() => router.push(`/inventory/receipts/new?productId=${p.id}`)}
                          className="text-xs font-medium bg-background-tertiary hover:bg-border px-3 py-1.5 rounded-lg border border-border text-primary-600"
                        >
                          Nhập
                        </button>
                      </div>
                    </td>
                  );
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
                Tổng <strong className="text-foreground">{total}</strong> sản phẩm
              </span>
            }
          />
        </div>
      </div>
    </DataListShell>
  )
}
