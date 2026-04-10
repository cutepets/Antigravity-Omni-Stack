'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Download,
  ExternalLink,
  Trash2,
  Pin,
  PinOff,
  ShoppingBag,
  CreditCard,
  CalendarDays,
  Printer
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { orderApi } from '@/lib/api/order.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { formatCurrency, formatDateTime } from '@/lib/utils'
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

// ── Types & Constants ────────────────────────────────────────────────────────
type DisplayColumnId = 'code' | 'customer' | 'customerPhone' | 'items' | 'discount' | 'shippingFee' | 'total' | 'customerPaid' | 'payment' | 'status' | 'linkedCodes' | 'note' | 'branch' | 'creator' | 'created' | 'updated'
type PinFilterId = 'paymentStatus'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string; align?: 'left' | 'center' | 'right' }> = [
  { id: 'code',         label: 'Mã đơn',         sortable: false, width: 'w-24' },
  { id: 'customer',     label: 'Tên khách',      sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'customerPhone',label: 'SĐT Khách',      sortable: false, width: 'whitespace-nowrap' },
  { id: 'items',        label: 'Số SP',          sortable: false, width: 'whitespace-nowrap' },
  { id: 'discount',     label: 'Chiết khấu',      sortable: false, width: 'w-28', align: 'right' },
  { id: 'shippingFee',  label: 'Phí ship',       sortable: false, width: 'w-28', align: 'right' },
  { id: 'total',        label: 'Tổng tiền',      sortable: false, width: 'w-28', align: 'right' },
  { id: 'customerPaid', label: 'Khách đã trả',   sortable: false, width: 'w-28', align: 'right' },
  { id: 'payment',      label: 'TT',             sortable: false, width: 'w-32' },
  { id: 'status',       label: 'Trạng thái',     sortable: false, width: 'w-32' },
  { id: 'linkedCodes',  label: 'Mã liên kết',     sortable: false, minWidth: 'min-w-[180px]' },
  { id: 'note',         label: 'Ghi chú',        sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'branch',       label: 'Chi nhánh',      sortable: false, width: 'whitespace-nowrap' },
  { id: 'creator',      label: 'Người tạo',      sortable: false, width: 'whitespace-nowrap' },
  { id: 'created',      label: 'Ngày tạo',       sortable: false, width: 'whitespace-nowrap' },
  { id: 'updated',      label: 'Thời gian cập nhật',  sortable: false, width: 'whitespace-nowrap' },
]
const SORTABLE_COLUMNS = new Set<DisplayColumnId>(
  COLUMN_OPTIONS.filter((c) => c.sortable).map((c) => c.id)
)

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge badge-warning',
  PARTIAL: 'badge badge-accent',
  PAID:    'badge badge-success',
  COMPLETED: 'badge badge-info',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Đang xử lý',
  PARTIAL: 'TT 1 phần',
  PAID:    'Đã thanh toán',
  COMPLETED: 'Hoàn thành',
}

function StatusBadge({ status }: { status: string }) {
  const lbl = PAYMENT_STATUS_LABEL[status] ?? status;
  const cls = PAYMENT_STATUS_BADGE[status] ?? 'badge badge-gray';
  return <span className={cls}>{lbl}</span>
}

export function OrderList() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // System hook for data-list standard
  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'customer', 'items', 'total', 'customerPaid', 'payment', 'status', 'branch', 'creator', 'created', 'updated'],
    initialTopFilterVisibility: { paymentStatus: true }
  })
  
  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['orders', search, paymentStatus, page, pageSize],
    queryFn: () => orderApi.list({
      search,
      paymentStatus: paymentStatus || undefined,
      page,
      limit: pageSize,
    }),
  })

  // ── Computation ──────────────────────────────────────────────────────────────
  const rawOrders = (data as any)?.data ?? []
  const total = (data as any)?.total ?? 0
  const totalPages = (data as any)?.totalPages ?? 1

  // Client side sort if needed, currently API pagination so no complex generic sort.
  const processedOrders = useMemo(() => {
    return [...rawOrders];
  }, [rawOrders])

  const visibleRowIds = useMemo(
    () => processedOrders.map((o: any) => `o:${o.id}`),
    [processedOrders]
  )

  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visibleRowIds)

  const toggleColumnSort = (columnId: DisplayColumnId) => {
    if (!SORTABLE_COLUMNS.has(columnId)) return
    dataListState.toggleColumnSort(columnId)
  }

  const clearFilters = () => {
    setPaymentStatus('')
    setSearch('')
    setPage(1)
  }

  // ── Layout Components ─────────────────────────────────────────────────────────
  
  const renderActiveColumns = () => {
    return orderedVisibleColumns.map((id) => {
      const col = COLUMN_OPTIONS.find((c) => c.id === id)!
      return { ...col, id: id as DisplayColumnId }
    })
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd   = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rawOrders.length)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <DataListShell>
      {/* Toolbar */}
      <DataListToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Tìm mã đơn, tên KH, số điện thoại..."
        showColumnToggle={true}
        showFilterToggle={true}
        filterSlot={
          <>
            {/* Top filter: Status */}
            {topFilterVisibility.paymentStatus && (
              <select
                value={paymentStatus}
                onChange={(e) => { setPaymentStatus(e.target.value); setPage(1) }}
                className={toolbarSelectClass}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chưa thanh toán</option>
                <option value="PARTIAL">Thanh toán 1 phần</option>
                <option value="PAID">Đã thanh toán đủ</option>
                <option value="COMPLETED">Hoàn thành</option>
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
             <button
               type="button"
               onClick={() => router.push('/pos')}
               className="flex h-8 items-center gap-1.5 rounded-lg bg-primary-500 px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-600 shadow-sm"
             >
               + Tạo đơn mới
             </button>
          </div>
        }
      />

      {/* ── Filter Panel ────────────────────────────────── */}
      <DataListFilterPanel onClearAll={clearFilters}>
        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-2">
              <AlertCircle size={14} className="text-primary-500" />
              Trạng thái thanh toán
            </span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('paymentStatus')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                topFilterVisibility.paymentStatus ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {topFilterVisibility.paymentStatus ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
             value={paymentStatus}
             onChange={(e) => { setPaymentStatus(e.target.value); setPage(1) }}
             className={filterSelectClass}
          >
             <option value="">Tất cả trạng thái</option>
             <option value="PENDING">Chưa thanh toán</option>
             <option value="PARTIAL">Thanh toán 1 phần</option>
             <option value="PAID">Đã thanh toán đủ</option>
             <option value="COMPLETED">Hoàn thành</option>
          </select>
        </label>
      </DataListFilterPanel>

      {/* Table */}
      <DataListTable
        columns={renderActiveColumns()}
        isLoading={isLoading}
        isEmpty={!isLoading && processedOrders.length === 0}
        emptyText="Không tìm thấy đơn hàng nào phù hợp."
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
                onClick={() => {
                  toast.success('Tính năng in đang được phát triển')
                }}
              >
                <Printer size={13} /> In {selectedRowIds.size} đơn
              </button>
            </DataListBulkBar>
          ) : undefined
        }
      >
        {processedOrders.map((o: any) => {
          const rowId = `o:${o.id}`
          const isSelected = selectedRowIds.has(rowId)
          
          return (
            <tr 
              key={o.id} 
              className={`border-b border-border/50 transition-colors hover:bg-background-secondary/40 ${isSelected ? 'bg-primary-500/5' : ''}`}
            >
              <td className="w-12 px-3 py-3 w-10">
                <TableCheckbox 
                  checked={isSelected}
                  onCheckedChange={(checked, shiftKey) => toggleRowSelection(rowId, shiftKey)}
                />
              </td>
              {orderedVisibleColumns.map(columnId => {
              switch(columnId) {
                case 'code': return (
                  <td key={columnId} className="px-3 py-3 w-24">
                    <span 
                       onClick={() => window.open(`/pos?orderId=${o.id}`, '_blank')}
                       className="font-mono text-xs font-bold text-primary-500 hover:underline cursor-pointer transition-colors"
                    >
                      {o.orderNumber || '--'}
                    </span>
                  </td>
                );
                case 'customer': return (
                  <td key={columnId} className="px-3 py-3 min-w-[150px]">
                    <div className="font-semibold text-foreground text-sm">
                      {o.customer?.name || o.customer?.fullName || 'Khách lẻ'}
                    </div>
                  </td>
                );
                case 'customerPhone': return (
                  <td key={columnId} className="px-3 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-foreground-secondary">
                      {o.customer?.phone || '--'}
                    </div>
                  </td>
                );
                case 'discount': return (
                  <td key={columnId} className="px-3 py-3 w-28 text-right">
                    <div className="text-sm font-medium text-foreground-secondary">
                      {formatCurrency(o.discount || 0)}
                    </div>
                  </td>
                );
                case 'shippingFee': return (
                  <td key={columnId} className="px-3 py-3 w-28 text-right">
                    <div className="text-sm font-medium text-foreground-secondary">
                      {formatCurrency(o.shippingFee || 0)}
                    </div>
                  </td>
                );
                case 'linkedCodes': return (
                  <td key={columnId} className="px-3 py-3 min-w-[180px]">
                    <div className="flex flex-wrap gap-1">
                      {o.transactions?.map((t: any, idx: number) => (
                        <span key={'tx-'+idx} className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${t.type === 'INCOME' ? 'bg-success/10 text-success-600' : 'bg-destructive/10 text-destructive-600'}`}>
                          {t.type === 'INCOME' ? 'PT' : 'PC'}: {t.voucherNumber}
                        </span>
                      ))}
                      {o.groomingSessions?.map((s: any, idx: number) => (
                        <span key={'gr-'+idx} className="bg-primary/10 text-primary-700 px-1.5 py-0.5 rounded-md text-[10px] font-medium">
                          SPA: {s.sessionCode}
                        </span>
                      ))}
                      {o.hotelStays?.map((h: any, idx: number) => (
                        <span key={'ht-'+idx} className="bg-warning/10 text-warning-700 px-1.5 py-0.5 rounded-md text-[10px] font-medium">
                          HOTEL: {h.stayCode}
                        </span>
                      ))}
                      {!(o.transactions?.length) && !(o.groomingSessions?.length) && !(o.hotelStays?.length) && (
                        <span className="text-xs text-foreground-muted">--</span>
                      )}
                    </div>
                  </td>
                );
                case 'note': return (
                  <td key={columnId} className="px-3 py-3 min-w-[150px]">
                    <div className="text-xs text-foreground-secondary line-clamp-2" title={o.notes || ''}>
                      {o.notes || '--'}
                    </div>
                  </td>
                );
                case 'items': return (
                  <td key={columnId} className="px-3 py-3 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 bg-background-tertiary px-2 py-0.5 rounded-md">
                      <ShoppingBag size={11} className="text-foreground-muted" />
                      <span className="text-xs font-medium text-foreground-secondary">{o.items?.length || 0} SP</span>
                    </div>
                  </td>
                );
                case 'total': return (
                  <td key={columnId} className="px-3 py-3 w-28 text-right">
                    <div className="text-sm font-bold text-foreground">
                      {formatCurrency(o.total)}
                    </div>
                  </td>
                );
                case 'customerPaid': return (
                  <td key={columnId} className="px-3 py-3 w-28 text-right">
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(o.paidAmount || 0)}
                    </div>
                  </td>
                );
                case 'payment': return (
                  <td key={columnId} className="px-3 py-3 w-32">
                    <div className="flex items-center gap-1.5 text-xs text-foreground-secondary font-medium">
                      <CreditCard size={13} className="text-foreground-muted" />
                      {o.paymentMethod?.replace('_', ' ') || '—'}
                    </div>
                  </td>
                );
                case 'status': return (
                  <td key={columnId} className="px-3 py-3 w-32">
                    <StatusBadge status={o.paymentStatus} />
                  </td>
                );
                case 'branch': return (
                  <td key={columnId} className="px-3 py-3 whitespace-nowrap">
                    <div className="text-xs text-foreground-secondary font-medium">
                      {o.branch?.name || '--'}
                    </div>
                  </td>
                );
                case 'creator': return (
                  <td key={columnId} className="px-3 py-3 whitespace-nowrap">
                    <div className="text-xs text-foreground-secondary">
                      {o.staff?.fullName || o.staff?.name || '--'}
                    </div>
                  </td>
                );
                case 'created': return (
                  <td key={columnId} className="px-3 py-3 whitespace-nowrap text-xs text-foreground-muted">
                    <div className="flex items-center gap-1">
                      <CalendarDays size={12}/>
                      {o.createdAt ? formatDateTime(o.createdAt) : '--'}
                    </div>
                  </td>
                );
                case 'updated': return (
                  <td key={columnId} className="px-3 py-3 whitespace-nowrap text-xs text-foreground-muted">
                    <div className="flex items-center gap-1">
                      <CalendarDays size={12}/>
                      {o.updatedAt ? formatDateTime(o.updatedAt) : '--'}
                    </div>
                  </td>
                );

              }
            })}
          </tr>
        )})}
      </DataListTable>

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
          <p className="shrink-0 text-xs text-foreground-muted">
            Tổng <strong className="text-foreground">{total}</strong> đơn hàng
            {search && <span> · tìm kiếm &quot;{search}&quot;</span>}
          </p>
        }
      />
    </DataListShell>
  )
}
