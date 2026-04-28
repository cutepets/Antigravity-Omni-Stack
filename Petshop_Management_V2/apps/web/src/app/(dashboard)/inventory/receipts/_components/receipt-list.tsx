'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, Download, Filter, Plus, X, XCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { useRouter } from 'next/navigation'
import { stockApi } from '@/lib/api/stock.api'
import { useAuthorization } from '@/hooks/useAuthorization'
import {
  DataListBulkBar,
  DataListColumnPanel,
  DataListPagination,
  DataListShell,
  DataListTable,
  DataListToolbar,
  TableCheckbox,
  useDataListCore,
  useDataListSelection,
} from '@petshop/ui/data-list'

type DisplayColumnId = 'code' | 'date' | 'supplier' | 'total' | 'status'
type PinFilterId = never

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'code', label: 'Mã phiếu', sortable: true, width: 'w-44' },
  { id: 'date', label: 'Ngày', sortable: true, width: 'w-44' },
  { id: 'supplier', label: 'Nhà cung cấp', sortable: true, minWidth: 'min-w-[220px]' },
  { id: 'total', label: 'Giá trị', sortable: true, width: 'w-40' },
  { id: 'status', label: 'Trạng thái', width: 'w-44' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(COLUMN_OPTIONS.filter((column) => column.sortable).map((column) => column.id))

function getReceiptStatusBadge(status?: string | null) {
  switch (status) {
    case 'FULL_RECEIVED':
      return <span className="badge badge-success"><CheckCircle2 size={11} /> Đã nhập đủ</span>
    case 'PARTIAL_RECEIVED':
      return <span className="badge badge-info"><Clock size={11} /> Nhập dở</span>
    case 'SHORT_CLOSED':
      return <span className="badge badge-warning"><Clock size={11} /> Chốt thiếu</span>
    case 'CANCELLED':
      return <span className="badge badge-error"><XCircle size={11} /> Đã hủy</span>
    default:
      return <span className="badge badge-warning"><Clock size={11} /> Nháp</span>
  }
}

export function ReceiptList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlProductId = searchParams.get('productId') ?? ''

  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const canReadReceipts = hasPermission('stock_receipt.read')
  const canCreateReceipt = hasPermission('stock_receipt.create')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'date', 'supplier', 'total', 'status'],
    initialTopFilterVisibility: {},
    storageKey: 'receipt-list-columns-v1',
  })

  const { columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', search, page, pageSize, columnSort.columnId, columnSort.direction, urlProductId],
    queryFn: () =>
      stockApi.getReceipts({
        search,
        page,
        limit: pageSize,
        sortBy: columnSort.columnId || undefined,
        sortOrder: (columnSort.direction as 'asc' | 'desc') || undefined,
        productId: urlProductId || undefined,
      }),
    enabled: canReadReceipts,
  })

  const receipts = useMemo(() => {
    const rows = (data as any)?.data?.data
    return Array.isArray(rows) ? rows : []
  }, [data])
  const totalPages = (data as any)?.data?.totalPages ?? 1
  const total = (data as any)?.data?.total ?? receipts.length
  const visibleRowIds = useMemo(() => receipts.map((receipt: any) => `receipt:${receipt.id}`), [receipts])
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + receipts.length)

  const { selectedRowIds, toggleRowSelection, toggleSelectAllVisible, clearSelection, allVisibleSelected } =
    useDataListSelection(visibleRowIds)

  const activeColumns = useMemo(
    () => orderedVisibleColumns.map((id) => ({ ...COLUMN_OPTIONS.find((column) => column.id === id)!, id })),
    [orderedVisibleColumns],
  )

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadReceipts) router.replace('/dashboard')
  }, [canReadReceipts, isAuthLoading, router])

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang kiem tra quyen truy cap...</div>
  }

  if (!canReadReceipts) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang chuyen huong...</div>
  }

  return (
    <DataListShell>
      <DataListToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder="Tìm theo mã phiếu hoặc NCC..."
        showColumnToggle={true}
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
            onToggleSort={(id) => dataListState.toggleColumnSort(id as DisplayColumnId)}
            onDragStart={(id) => dataListState.setDraggingColumnId(id as DisplayColumnId)}
            onDragEnd={() => dataListState.setDraggingColumnId(null)}
          />
        }
        extraActions={
          canCreateReceipt ? (
            <button onClick={() => router.push('/inventory/receipts/new')} className="btn-primary liquid-button h-11 rounded-xl px-4 text-sm">
              <Plus size={15} /> Tạo phiếu nhập
            </button>
          ) : null
        }
      />

      {urlProductId && (
        <div className="mx-1 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
          <Filter size={14} className="shrink-0" />
          <span className="flex-1">Đang lọc phiếu nhập theo sản phẩm</span>
          <button
            onClick={() => router.push('/inventory/receipts')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium hover:bg-amber-500/20 transition-colors"
          >
            <X size={12} /> Xóa bộ lọc
          </button>
        </div>
      )}

      <DataListTable
        columns={activeColumns}
        isLoading={isLoading}
        isEmpty={!isLoading && receipts.length === 0}
        emptyText="Không có phiếu nhập nào."
        allSelected={allVisibleSelected}
        onSelectAll={toggleSelectAllVisible}
        footer={
          <DataListPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[15, 30, 50, 100]}
            attachedToTable
            totalItemText={
              <span className="text-xs">
                Tổng <strong className="text-foreground">{total}</strong> phiếu
              </span>
            }
          />
        }
        bulkBar={
          selectedRowIds.size > 0 ? (
            <DataListBulkBar selectedCount={selectedRowIds.size} onClear={clearSelection}>
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
        {receipts.map((receipt: any) => {
          const rowId = `receipt:${receipt.id}`
          const isSelected = selectedRowIds.has(rowId)
          return (
            <tr
              key={receipt.id}
              className={`group cursor-pointer border-b border-border/50 transition-colors hover:bg-background-secondary/50 ${isSelected ? 'bg-primary-500/5' : ''}`}
              onClick={() => router.push(`/inventory/receipts/${receipt.receiptNumber || receipt.id}`)}
            >
              <td className="w-10 px-3 py-3" onClick={(event) => event.stopPropagation()}>
                <TableCheckbox checked={isSelected} onCheckedChange={(_checked, shiftKey) => toggleRowSelection(rowId, shiftKey)} />
              </td>
              {orderedVisibleColumns.map((columnId) => {
                switch (columnId) {
                  case 'code':
                    return (
                      <td key={columnId} className="w-44 px-3 py-3">
                        <div className="font-mono font-medium text-primary-500 group-hover:underline">
                          {receipt.receiptNumber || receipt.id.substring(0, 8).toUpperCase()}
                        </div>
                      </td>
                    )
                  case 'date':
                    return (
                      <td key={columnId} className="w-44 px-3 py-3 text-sm text-foreground">
                        {dayjs(receipt.receivedAt || receipt.createdAt).format('DD/MM/YYYY HH:mm')}
                      </td>
                    )
                  case 'supplier':
                    return (
                      <td key={columnId} className="min-w-[220px] px-3 py-3">
                        <div className="font-medium text-foreground">{receipt.supplier?.name || 'Chưa chọn NCC'}</div>
                        <div className="mt-1 text-xs text-foreground-muted">{receipt.branch?.name || 'Tổng công ty'}</div>
                      </td>
                    )
                  case 'total':
                    return (
                      <td key={columnId} className="w-40 px-3 py-3 text-right">
                        <div className="font-bold text-foreground">
                          {Number(receipt.totalReceivedAmount || receipt.totalAmount || 0).toLocaleString('vi-VN')}₫
                        </div>
                        <div className="mt-1 text-xs text-foreground-muted">Nợ {Number(receipt.debtAmount || 0).toLocaleString('vi-VN')}₫</div>
                      </td>
                    )
                  case 'status':
                    return (
                      <td key={columnId} className="w-44 px-3 py-3">
                        <div className="space-y-1">
                          {getReceiptStatusBadge(receipt.receiptStatus || receipt.status)}
                          <div className="text-[11px] text-foreground-muted">{receipt.paymentStatus || 'UNPAID'}</div>
                        </div>
                      </td>
                    )
                }
              })}
            </tr>
          )
        })}
      </DataListTable>

    </DataListShell>
  )
}
