'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Filter, Plus, Trash2, X, XCircle } from 'lucide-react'
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
  { id: 'code', label: 'MÃ£ phiáº¿u', sortable: true, width: 'w-44' },
  { id: 'date', label: 'NgÃ y', sortable: true, width: 'w-44' },
  { id: 'supplier', label: 'NhÃ  cung cáº¥p', sortable: true, minWidth: 'min-w-[220px]' },
  { id: 'total', label: 'GiÃ¡ trá»‹', sortable: true, width: 'w-40' },
  { id: 'status', label: 'Tráº¡ng thÃ¡i', width: 'w-44' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(COLUMN_OPTIONS.filter((column) => column.sortable).map((column) => column.id))

function getReceiptStatusBadge(status?: string | null) {
  switch (status) {
    case 'FULL_RECEIVED':
      return <span className="badge badge-success"><CheckCircle2 size={11} /> ÄÃ£ nháº­p Ä‘á»§</span>
    case 'PARTIAL_RECEIVED':
      return <span className="badge badge-info"><Clock size={11} /> Nháº­p dá»Ÿ</span>
    case 'SHORT_CLOSED':
      return <span className="badge badge-warning"><Clock size={11} /> Chá»‘t thiáº¿u</span>
    case 'CANCELLED':
      return <span className="badge badge-error"><XCircle size={11} /> ÄÃ£ há»§y</span>
    default:
      return <span className="badge badge-warning"><Clock size={11} /> NhÃ¡p</span>
  }
}

export function ReceiptList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlProductId = searchParams.get('productId') ?? ''

  const queryClient = useQueryClient()
  const { hasPermission, isLoading: isAuthLoading, isSuperAdmin } = useAuthorization()
  const canReadReceipts = hasPermission('stock_receipt.read')
  const canCreateReceipt = hasPermission('stock_receipt.create')
  const canViewImportCost = hasPermission('stock_receipt.cost.read') || hasPermission('inventory.cost.read')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: canViewImportCost ? ['code', 'date', 'supplier', 'total', 'status'] : ['code', 'date', 'supplier', 'status'],
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
  const selectedReceiptIds = useMemo(() => Array.from(selectedRowIds).map((rowId) => rowId.replace(/^receipt:/, '')), [selectedRowIds])

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => stockApi.bulkDeleteReceipts(ids),
    onSuccess: () => {
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: (payload: { ids: string[]; updates: any }) => stockApi.bulkUpdateReceipts(payload.ids, payload.updates),
    onSuccess: () => {
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })

  const activeColumns = useMemo(
    () =>
      orderedVisibleColumns
        .filter((id) => canViewImportCost || id !== 'total')
        .map((id) => ({ ...COLUMN_OPTIONS.find((column) => column.id === id)!, id })),
    [canViewImportCost, orderedVisibleColumns],
  )
  const availableColumnOptions = useMemo(
    () => COLUMN_OPTIONS.filter((column) => canViewImportCost || column.id !== 'total'),
    [canViewImportCost],
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
        searchPlaceholder="TÃ¬m theo mÃ£ phiáº¿u hoáº·c NCC..."
        showColumnToggle={true}
        columnPanelContent={
          <DataListColumnPanel
            columns={availableColumnOptions}
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
              <Plus size={15} /> Táº¡o phiáº¿u nháº­p
            </button>
          ) : null
        }
      />

      {urlProductId && (
        <div className="mx-1 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
          <Filter size={14} className="shrink-0" />
          <span className="flex-1">Äang lá»c phiáº¿u nháº­p theo sáº£n pháº©m</span>
          <button
            onClick={() => router.push('/inventory/receipts')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium hover:bg-amber-500/20 transition-colors"
          >
            <X size={12} /> XÃ³a bá»™ lá»c
          </button>
        </div>
      )}

      <DataListTable
        columns={activeColumns}
        isLoading={isLoading}
        isEmpty={!isLoading && receipts.length === 0}
        emptyText="KhÃ´ng cÃ³ phiáº¿u nháº­p nÃ o."
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
                Tá»•ng <strong className="text-foreground">{total}</strong> phiáº¿u
              </span>
            }
          />
        }
        bulkBar={
          selectedRowIds.size > 0 ? (
            <DataListBulkBar selectedCount={selectedRowIds.size} onClear={clearSelection}>
              <select
                className="h-8 rounded-lg border border-border bg-background-secondary px-3 text-xs font-semibold text-foreground"
                defaultValue=""
                disabled={bulkUpdateMutation.isPending}
                onChange={(event) => {
                  const value = event.target.value
                  event.target.value = ''
                  if (value) bulkUpdateMutation.mutate({ ids: selectedReceiptIds, updates: { receiptStatus: value, status: value } })
                }}
              >
                <option value="" disabled>Tr?ng thái</option>
                <option value="DRAFT">Nháp</option>
                <option value="FULL_RECEIVED">Ðã nh?p d?</option>
                <option value="PARTIAL_RECEIVED">Nh?p d?</option>
                <option value="SHORT_CLOSED">Ch?t thi?u</option>
                <option value="CANCELLED">Ðã h?y</option>
              </select>
              {isSuperAdmin() ? (
                <button
                  type="button"
                  aria-label="Xóa DB"
                  title="Xóa DB"
                  onClick={() => {
                    if (window.confirm(`Xóa vinh vi?n ${selectedReceiptIds.length} phi?u nh?p dã ch?n?`)) {
                      bulkDeleteMutation.mutate(selectedReceiptIds)
                    }
                  }}
                  disabled={bulkDeleteMutation.isPending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-error/20 bg-error/10 text-error transition-colors hover:bg-error/15 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
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
              {activeColumns.map(({ id: columnId }) => {
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
                        <div className="font-medium text-foreground">{receipt.supplier?.name || 'ChÆ°a chá»n NCC'}</div>
                        <div className="mt-1 text-xs text-foreground-muted">{receipt.branch?.name || 'Tá»•ng cÃ´ng ty'}</div>
                      </td>
                    )
                  case 'total':
                    return (
                      <td key={columnId} className="w-40 px-3 py-3 text-right">
                        <div className="font-bold text-foreground">
                          {canViewImportCost
                            ? `${Number(receipt.totalReceivedAmount || receipt.totalAmount || 0).toLocaleString('vi-VN')}đ`
                            : '--'}
                        </div>
                        {canViewImportCost ? (
                          <div className="mt-1 text-xs text-foreground-muted">Nợ {Number(receipt.debtAmount || 0).toLocaleString('vi-VN')}đ</div>
                        ) : null}
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
