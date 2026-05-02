'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hotelApi, HotelStay, type HotelLineType, type HotelPaymentStatus, type HotelStatus } from '@/lib/api/hotel.api'
import { format, differenceInDays } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import StayDetailsDialog from './StayDetailsDialog'
import { useAuthorization } from '@/hooks/useAuthorization'
import {
  DataListBulkBar,
  DataListShell,
  DataListToolbar,
  DataListFilterPanel,
  DataListColumnPanel,
  DataListTable,
  DataListPagination,
  TableCheckbox,
  useDataListCore,
  useDataListSelection,
  filterInputClass,
  filterSelectClass,
  toolbarSelectClass,
} from '@petshop/ui/data-list'
import { CalendarDays, CreditCard, Home, LayoutGrid, List, MapPin, Pin, PinOff, Tag, Trash2 } from 'lucide-react'
import { confirmDialog } from '@/components/ui/confirmation-provider'
import { HotelQuickPreviewTool } from '@/components/hotel-quick-preview/HotelQuickPreviewTool'

type DisplayColumnId = 'code' | 'pet' | 'customer' | 'branch' | 'cage' | 'checkIn' | 'checkOut' | 'days' | 'payment' | 'status'
type PinFilterId = 'status' | 'branch' | 'payment'
type HotelListViewMode = 'kanban' | 'list'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string; align?: 'left' | 'center' | 'right' }> = [
  { id: 'code', label: 'Mã lưu trú', sortable: false, width: 'w-24' },
  { id: 'pet', label: 'Thú cưng', sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'customer', label: 'Khách hàng', sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'branch', label: 'Chi nhánh', sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'cage', label: 'Chuồng', sortable: false, width: 'whitespace-nowrap' },
  { id: 'checkIn', label: 'Check-in', sortable: false, width: 'whitespace-nowrap' },
  { id: 'checkOut', label: 'Check-out', sortable: false, width: 'whitespace-nowrap' },
  { id: 'days', label: 'Số ngày', sortable: false, width: 'w-24', align: 'center' },
  { id: 'payment', label: 'Thanh toán', sortable: false, width: 'w-32' },
  { id: 'status', label: 'Trạng thái', sortable: false, width: 'w-32' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>([])

export default function StayList({
  initialSearch = '',
  focusStayId,
  viewMode = 'list',
  onViewModeChange,
}: {
  initialSearch?: string
  focusStayId?: string
  viewMode?: HotelListViewMode
  onViewModeChange?: (mode: HotelListViewMode) => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isSuperAdmin, allowedBranches } = useAuthorization()
  const canCheckout = hasPermission('hotel.checkout')
  const autoOpenedStayIdRef = useRef<string | null>(null)

  const [search, setSearch] = useState(initialSearch)
  const [stayStatus, setStayStatus] = useState<HotelStatus | ''>('')
  const [branchFilter, setBranchFilter] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<HotelPaymentStatus | ''>('')
  const [cageFilter, setCageFilter] = useState('')
  const [lineTypeFilter, setLineTypeFilter] = useState<HotelLineType | ''>('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedStay, setSelectedStay] = useState<HotelStay | null>(null)

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'pet', 'customer', 'branch', 'cage', 'checkIn', 'checkOut', 'days', 'payment', 'status'],
    initialTopFilterVisibility: { status: true, branch: true, payment: true }
  })

  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  useEffect(() => {
    setSearch(initialSearch)
    setPage(1)
  }, [initialSearch])

  const { data: stays, isLoading } = useQuery({
    queryKey: ['stays', 'all-branches'],
    queryFn: () => hotelApi.getStayList({ omitBranchId: true, limit: 500 }),
  })

  const allStays = useMemo(() => stays?.items || [], [stays?.items])
  const branchOptions = useMemo(() => {
    const branchMap = new Map<string, { id: string; name: string; code?: string | null }>()

    allowedBranches.forEach((branch) => {
      branchMap.set(branch.id, { id: branch.id, name: branch.name })
    })
    allStays.forEach((stay) => {
      if (!stay.branchId) return
      branchMap.set(stay.branchId, {
        id: stay.branchId,
        name: stay.branch?.name ?? stay.branchId,
        code: stay.branch?.code,
      })
    })

    return Array.from(branchMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [allStays, allowedBranches])
  const cageOptions = useMemo(() => {
    const cageMap = new Map<string, string>()

    allStays.forEach((stay) => {
      if (!stay.cageId) return
      cageMap.set(stay.cageId, stay.cage?.name ?? stay.cageId)
    })

    return Array.from(cageMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [allStays])

  const visibleStays = useMemo(() => {
    let filtered = allStays
    if (search) {
      const normalizedSearch = search.toLowerCase()
      filtered = filtered.filter((stay) =>
        stay.pet?.name?.toLowerCase().includes(normalizedSearch) ||
        stay.petName?.toLowerCase().includes(normalizedSearch) ||
        stay.id.toLowerCase().includes(normalizedSearch) ||
        stay.stayCode?.toLowerCase().includes(normalizedSearch) ||
        stay.customer?.phone?.toLowerCase().includes(normalizedSearch) ||
        stay.customer?.representativePhone?.toLowerCase().includes(normalizedSearch) ||
        stay.secondaryPhone?.toLowerCase().includes(normalizedSearch) ||
        stay.customer?.fullName?.toLowerCase().includes(normalizedSearch) ||
        stay.branch?.name?.toLowerCase().includes(normalizedSearch) ||
        stay.branch?.code?.toLowerCase().includes(normalizedSearch) ||
        stay.cage?.name?.toLowerCase().includes(normalizedSearch)
      )
    }
    if (stayStatus) {
      filtered = filtered.filter((stay) => stay.status === stayStatus)
    }
    if (branchFilter) {
      filtered = filtered.filter((stay) => stay.branchId === branchFilter)
    }
    if (paymentStatus) {
      filtered = filtered.filter((stay) => stay.paymentStatus === paymentStatus)
    }
    if (cageFilter) {
      filtered = filtered.filter((stay) => stay.cageId === cageFilter)
    }
    if (lineTypeFilter) {
      filtered = filtered.filter((stay) => stay.lineType === lineTypeFilter)
    }
    if (dateFilter) {
      filtered = filtered.filter((stay) => format(new Date(stay.checkIn), 'yyyy-MM-dd') === dateFilter)
    }
    return filtered
  }, [allStays, branchFilter, cageFilter, dateFilter, lineTypeFilter, paymentStatus, search, stayStatus])

  const paginatedStays = useMemo(() => {
    const start = (page - 1) * pageSize
    return visibleStays.slice(start, start + pageSize)
  }, [page, pageSize, visibleStays])

  const visibleRowIds = useMemo(() => paginatedStays.map((stay) => `stay:${stay.id}`), [paginatedStays])
  const {
    selectedRowIds,
    allVisibleSelected,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useDataListSelection(visibleRowIds)

  const selectedStayIds = useMemo(
    () => Array.from(selectedRowIds).map((rowId) => rowId.replace('stay:', '')),
    [selectedRowIds]
  )

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => hotelApi.bulkDeleteStays(ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      clearSelection()
      if (result.deletedIds.length > 0) toast.success(`Da xoa ${result.deletedIds.length} luot luu tru`)
      if (result.blocked.length > 0) toast.error(`${result.blocked.length} luot luu tru khong the xoa`)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Khong the xoa hang loat luu tru')
    },
  })

  const handleNavigateDetail = (stay: HotelStay) => {
    setSelectedStay(stay)
  }

  useEffect(() => {
    if (!focusStayId || autoOpenedStayIdRef.current === focusStayId || allStays.length === 0) return
    const matchedStay = allStays.find((stay) => stay.id === focusStayId)
    if (!matchedStay) return
    autoOpenedStayIdRef.current = focusStayId
    setSelectedStay(matchedStay)
  }, [allStays, focusStayId])

  const getStatusBadge = (status: HotelStay['status']) => {
    switch (status) {
      case 'BOOKED':
        return <span className="badge badge-info badge-sm">Đã đặt</span>
      case 'CHECKED_IN':
        return <span className="badge badge-warning badge-sm">Đang ở</span>
      case 'CHECKED_OUT':
        return <span className="badge badge-success badge-sm">Đã trả</span>
      case 'CANCELLED':
        return <span className="badge badge-error badge-sm">Đã hủy</span>
      default:
        return <span className="badge badge-ghost badge-sm">{status}</span>
    }
  }

  const getPaymentStatusBadge = (status: HotelStay['paymentStatus']) => {
    switch (status) {
      case 'PAID':
      case 'COMPLETED':
        return <span className="badge badge-success badge-sm">Đã thanh toán</span>
      case 'PARTIAL':
        return <span className="badge badge-warning badge-sm">Thanh toán một phần</span>
      case 'UNPAID':
        return <span className="badge badge-error badge-sm">Chưa thanh toán</span>
      default:
        return <span className="badge badge-ghost badge-sm">{status}</span>
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const getDaysCount = (stay: HotelStay) => {
    const checkIn = new Date(stay.checkIn)
    const checkOut = stay.checkOutActual ? new Date(stay.checkOutActual) : stay.estimatedCheckOut ? new Date(stay.estimatedCheckOut) : null
    if (!checkOut) return 1
    return Math.max(1, differenceInDays(checkOut, checkIn))
  }

  const clearFilters = () => {
    setStayStatus('')
    setBranchFilter('')
    setPaymentStatus('')
    setCageFilter('')
    setLineTypeFilter('')
    setDateFilter('')
    setSearch('')
    setPage(1)
  }

  const renderActiveColumns = () => {
    return orderedVisibleColumns.map((id) => {
      const col = COLUMN_OPTIONS.find((c) => c.id === id)!
      return { ...col, id: id as DisplayColumnId }
    })
  }

  return (
    <>
      <DataListShell>
        <DataListToolbar
          searchValue={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Tìm thú cưng, khách, SĐT, mã lưu trú, chi nhánh..."
          showColumnToggle={true}
          showFilterToggle={true}
          filterSlot={
            <>
              {topFilterVisibility.status && (
                <select
                  className={toolbarSelectClass}
                  value={stayStatus}
                  onChange={(e) => {
                    setStayStatus(e.target.value as HotelStatus | '')
                    setPage(1)
                  }}
                >
                  <option value="">Trạng thái (Tất cả)</option>
                  <option value="BOOKED">Đã đặt</option>
                  <option value="CHECKED_IN">Đang ở</option>
                  <option value="CHECKED_OUT">Đã trả</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              )}
              {topFilterVisibility.branch && (
                <select
                  className={toolbarSelectClass}
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">Tất cả chi nhánh</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              )}
              {topFilterVisibility.payment && (
                <select
                  className={toolbarSelectClass}
                  value={paymentStatus}
                  onChange={(e) => {
                    setPaymentStatus(e.target.value as HotelPaymentStatus | '')
                    setPage(1)
                  }}
                >
                  <option value="">Tất cả thanh toán</option>
                  <option value="UNPAID">Chưa thanh toán</option>
                  <option value="PARTIAL">Thanh toán một phần</option>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="COMPLETED">Hoàn tất</option>
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
              onToggleSort={() => { }}
              onDragStart={(id) => dataListState.setDraggingColumnId(id as DisplayColumnId)}
              onDragEnd={() => dataListState.setDraggingColumnId(null)}
            />
          }
          extraActions={
            <div className="flex flex-wrap items-center gap-2">
              <HotelQuickPreviewTool triggerClassName="bg-background-secondary text-foreground hover:bg-background-secondary/80" />
              <div className="inline-flex items-center rounded-2xl border border-border bg-background-secondary p-1">
                <button
                  type="button"
                  onClick={() => onViewModeChange?.('kanban')}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    viewMode === 'kanban' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  <LayoutGrid size={15} />
                  Sơ đồ
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange?.('list')}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  <List size={15} />
                  Danh sách
                </button>
              </div>
            </div>
          }
        />

        <DataListFilterPanel onClearAll={clearFilters}>
          <label className="space-y-2">
            <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
              <span className="inline-flex items-center gap-2"><MapPin size={14} className="text-primary-500" />Chi nhánh</span>
              <button type="button" onClick={() => dataListState.toggleTopFilterVisibility('branch')} className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${topFilterVisibility.branch ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'}`}>
                {topFilterVisibility.branch ? <Pin size={12} /> : <PinOff size={12} />}
              </button>
            </span>
            <select value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setPage(1) }} className={filterSelectClass}>
              <option value="">Tất cả chi nhánh</option>
              {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
              <span className="inline-flex items-center gap-2"><CreditCard size={14} className="text-primary-500" />Thanh toán</span>
              <button type="button" onClick={() => dataListState.toggleTopFilterVisibility('payment')} className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${topFilterVisibility.payment ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'}`}>
                {topFilterVisibility.payment ? <Pin size={12} /> : <PinOff size={12} />}
              </button>
            </span>
            <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value as HotelPaymentStatus | ''); setPage(1) }} className={filterSelectClass}>
              <option value="">Tất cả thanh toán</option>
              <option value="UNPAID">Chưa thanh toán</option>
              <option value="PARTIAL">Thanh toán một phần</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="COMPLETED">Hoàn tất</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><Home size={14} className="text-primary-500" />Chuồng</span>
            <select value={cageFilter} onChange={(e) => { setCageFilter(e.target.value); setPage(1) }} className={filterSelectClass}>
              <option value="">Tất cả chuồng</option>
              {cageOptions.map((cage) => <option key={cage.id} value={cage.id}>{cage.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><Tag size={14} className="text-primary-500" />Loại giá</span>
            <select value={lineTypeFilter} onChange={(e) => { setLineTypeFilter(e.target.value as HotelLineType | ''); setPage(1) }} className={filterSelectClass}>
              <option value="">Tất cả loại giá</option>
              <option value="REGULAR">Ngày thường</option>
              <option value="HOLIDAY">Ngày lễ</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><CalendarDays size={14} className="text-primary-500" />Ngày check-in</span>
            <input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1) }} className={filterInputClass} />
          </label>
          <label className="space-y-2">
            <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
              <span className="inline-flex items-center gap-2">
                Trạng thái lưu trú
              </span>
              <button
                type="button"
                onClick={() => dataListState.toggleTopFilterVisibility('status')}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${topFilterVisibility.status ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                  }`}
              >
                {topFilterVisibility.status ? <Pin size={12} /> : <PinOff size={12} />}
              </button>
            </span>
            <select
              value={stayStatus}
              onChange={(e) => { setStayStatus(e.target.value as HotelStatus | ''); setPage(1) }}
              className={filterSelectClass}
            >
              <option value="">Tất cả</option>
              <option value="BOOKED">Đã đặt</option>
              <option value="CHECKED_IN">Đang ở</option>
              <option value="CHECKED_OUT">Đã trả</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>
        </DataListFilterPanel>

        <DataListTable
          isLoading={isLoading}
          isEmpty={paginatedStays.length === 0}
          emptyText="Không có lượt lưu trú nào phù hợp"
          columns={renderActiveColumns()}
          allSelected={allVisibleSelected}
          onSelectAll={toggleSelectAllVisible}
          footer={
            <DataListPagination
              page={page}
              pageSize={pageSize}
              total={visibleStays.length}
              totalPages={Math.ceil(visibleStays.length / pageSize)}
              rangeStart={(page - 1) * pageSize + 1}
              rangeEnd={Math.min(page * pageSize, visibleStays.length)}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50]}
              attachedToTable
              totalItemText={
                <p className="shrink-0 text-xs text-foreground-muted">
                  Tổng số <strong className="text-foreground">{visibleStays.length}</strong> lượt lưu trú
                </p>
              }
            />
          }
          bulkBar={
            selectedStayIds.length > 0 ? (
              <DataListBulkBar selectedCount={selectedStayIds.length} onClear={clearSelection}>
                {isSuperAdmin() ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await confirmDialog(`Xoa ${selectedStayIds.length} luot luu tru da chon?`)) {
                        bulkDeleteMutation.mutate(selectedStayIds)
                      }
                    }}
                    disabled={bulkDeleteMutation.isPending}
                    aria-label="Xóa DB"
                    title="Xóa DB"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-error/20 bg-error/10 text-error transition-colors hover:bg-error/20 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                ) : (
                  <span className="text-sm text-foreground-muted">Chon thao tac hang loat</span>
                )}
              </DataListBulkBar>
            ) : undefined
          }
        >
          {paginatedStays.map((stay) => {
            const rowId = `stay:${stay.id}`
            const isSelected = selectedRowIds.has(rowId)
            return (
              <tr
                key={stay.id}
                className={`border-b border-border/50 transition-colors hover:bg-background-secondary/40 cursor-pointer ${isSelected ? 'bg-primary-500/5' : ''}`}
                onClick={() => handleNavigateDetail(stay)}
              >
                <td className="w-10 px-3 py-3" onClick={(event) => event.stopPropagation()}>
                  <TableCheckbox
                    checked={isSelected}
                    onCheckedChange={(_, shiftKey) => toggleRowSelection(rowId, shiftKey)}
                  />
                </td>
                {orderedVisibleColumns.map((colId) => {
                  const alignClass = COLUMN_OPTIONS.find((c) => c.id === colId)?.align === 'right' ? 'text-right' : COLUMN_OPTIONS.find((c) => c.id === colId)?.align === 'center' ? 'text-center' : 'text-left'

                  return (
                    <td key={colId} className={`px-4 py-3 ${alignClass}`}>
                      {colId === 'code' && (
                        <div className="font-mono text-sm text-foreground">
                          {stay.stayCode || `#${stay.id.slice(-6).toUpperCase()}`}
                        </div>
                      )}
                      {colId === 'pet' && (
                        <div className="text-sm font-semibold text-foreground">
                          <div>{stay.pet?.name || stay.petName || '—'}</div>
                        </div>
                      )}
                      {colId === 'customer' && (
                        <div className="text-sm">
                          <div className="font-medium text-foreground">{stay.customer?.fullName || 'Khách lẻ'}</div>
                          {stay.customer?.phone && <div className="text-xs text-foreground-muted">{stay.customer.phone}</div>}
                        </div>
                      )}
                      {colId === 'branch' && (
                        <div className="text-sm text-foreground">
                          <div className="font-medium">{stay.branch?.name || stay.branchId || '—'}</div>
                          {stay.branch?.code ? <div className="text-xs text-foreground-muted">{stay.branch.code}</div> : null}
                        </div>
                      )}
                      {colId === 'cage' && (
                        <div className="text-sm text-foreground">
                          {stay.cage?.name || stay.cageId || '—'}
                        </div>
                      )}
                      {colId === 'checkIn' && (
                        <div className="text-sm text-foreground">
                          {format(new Date(stay.checkIn), 'dd/MM/yyyy')}
                          <div className="text-xs text-foreground-muted">{format(new Date(stay.checkIn), 'HH:mm')}</div>
                        </div>
                      )}
                      {colId === 'checkOut' && (
                        <div className="text-sm text-foreground">
                          {stay.status === 'CHECKED_OUT' && stay.checkOutActual ? (
                            <>
                              {format(new Date(stay.checkOutActual), 'dd/MM/yyyy')}
                              <div className="text-xs text-foreground-muted">Ra: {format(new Date(stay.checkOutActual), 'HH:mm')}</div>
                            </>
                          ) : stay.estimatedCheckOut ? (
                            <>
                              {format(new Date(stay.estimatedCheckOut), 'dd/MM/yyyy')}
                              <div className="text-xs text-foreground-muted">Dự kiến: {format(new Date(stay.estimatedCheckOut), 'HH:mm')}</div>
                            </>
                          ) : (
                            '—'
                          )}
                        </div>
                      )}
                      {colId === 'days' && (
                        <div className="text-sm font-medium text-foreground">
                          {getDaysCount(stay)} ngày
                        </div>
                      )}
                      {colId === 'payment' && (
                        <div>{getPaymentStatusBadge(stay.paymentStatus)}</div>
                      )}
                      {colId === 'status' && (
                        <div>{getStatusBadge(stay.status)}</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </DataListTable>

      </DataListShell>
      <StayDetailsDialog
        stay={selectedStay}
        isOpen={!!selectedStay}
        onClose={() => {
          setSelectedStay(null)
          // If opened via deep-link (focusStayId), clear URL params so workspace returns to kanban
          if (focusStayId) {
            router.replace('/hotel', { scroll: false })
          }
        }}
      />
    </>
  )
}
