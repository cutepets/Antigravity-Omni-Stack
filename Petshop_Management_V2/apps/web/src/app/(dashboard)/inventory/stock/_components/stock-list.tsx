'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, AlertCircle, PackageCheck, Download, Pin, PinOff } from 'lucide-react'
import { inventoryApi } from '@/lib/api/inventory.api'
import { useRouter } from 'next/navigation'
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

type DisplayColumnId = 'code' | 'name' | 'minStock' | 'stock' | 'status' | 'actions'
type PinFilterId = 'type'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'code', label: 'Mã SP', sortable: true, width: 'w-24' },
  { id: 'name', label: 'Sản phẩm', sortable: true, minWidth: 'min-w-[180px]' },
  { id: 'minStock', label: 'Định mức tối thiểu', sortable: true, width: 'w-32' },
  { id: 'stock', label: 'Tồn kho hiện tại', sortable: true, width: 'w-32' },
  { id: 'status', label: 'Trạng thái', width: 'w-32' },
  { id: 'actions', label: 'Thao tác', width: 'w-28' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(
  COLUMN_OPTIONS.filter((c) => c.sortable).map((c) => c.id)
)

export function StockList() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL') // ALL, LOW_STOCK
  const [page, setPage] = useState(1)

  const [pageSize, setPageSize] = useState(20)

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'name', 'minStock', 'stock', 'status', 'actions'],
    initialTopFilterVisibility: { type: true }
  })
  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  const { data, isLoading } = useQuery({
    queryKey: ['products-stock', search, filterType, page, pageSize, columnSort.columnId, columnSort.direction],
    queryFn: () => inventoryApi.getProducts({
      search,
      page,
      limit: pageSize,
      sortBy: columnSort.columnId || undefined,
      sortOrder: (columnSort.direction as 'asc' | 'desc') || undefined,
    }),
  })

  const rawProducts = Array.isArray((data as any)?.data) ? (data as any).data : []
  const products = filterType === 'LOW_STOCK' ? rawProducts.filter((p: any) => p.stock <= p.minStock) : rawProducts

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
      const col = COLUMN_OPTIONS.find((c) => c.id === id)!
      return { ...col, id: id as DisplayColumnId }
    })
  }, [orderedVisibleColumns])

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd   = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rawProducts.length)

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
        {products.map((p: any) => {
          const isLowStock = p.stock <= p.minStock
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
                    <td key={columnId} className="px-3 py-3 min-w-[180px]">
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
                        <div>
                          <div className="font-semibold text-foreground">{p.name}</div>
                        </div>
                      </div>
                    </td>
                  );
                  case 'minStock': return (
                    <td key={columnId} className="px-3 py-3 text-right text-sm text-foreground-muted w-32">{p.minStock ?? 0}</td>
                  );
                  case 'stock': return (
                    <td key={columnId} className={`px-3 py-3 text-right font-bold text-lg w-32 ${isLowStock ? 'text-error' : 'text-emerald-500'}`}>
                      {p.stock ?? 0}
                    </td>
                  );
                  case 'status': return (
                    <td key={columnId} className="px-3 py-3 w-32">
                      {isLowStock ? (
                         <span className="badge badge-error"><AlertCircle size={11} /> Sắp hết</span>
                      ) : (
                         <span className="badge badge-success">Bình thường</span>
                      )}
                    </td>
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
