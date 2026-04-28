'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hotelApi, HotelStay } from '@/lib/api/hotel.api'
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
  filterSelectClass,
  toolbarSelectClass,
} from '@petshop/ui/data-list'
import { Pin, PinOff, Trash2 } from 'lucide-react'

type DisplayColumnId = 'code' | 'pet' | 'customer' | 'checkIn' | 'checkOut' | 'days' | 'status'
type PinFilterId = 'status'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string; align?: 'left' | 'center' | 'right' }> = [
  { id: 'code', label: 'Mã lưu trú', sortable: false, width: 'w-24' },
  { id: 'pet', label: 'Thú cưng', sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'customer', label: 'Khách hàng', sortable: false, minWidth: 'min-w-[150px]' },
  { id: 'checkIn', label: 'Check-in', sortable: false, width: 'whitespace-nowrap' },
  { id: 'checkOut', label: 'Check-out', sortable: false, width: 'whitespace-nowrap' },
  { id: 'days', label: 'Số ngày', sortable: false, width: 'w-24', align: 'center' },
  { id: 'status', label: 'Trạng thái', sortable: false, width: 'w-32' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>([])

export default function StayList({
  initialSearch = '',
  focusStayId,
}: {
  initialSearch?: string
  focusStayId?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isSuperAdmin } = useAuthorization()
  const canCheckout = hasPermission('hotel.checkout')
  const autoOpenedStayIdRef = useRef<string | null>(null)

  const [search, setSearch] = useState(initialSearch)
  const [stayStatus, setStayStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedStay, setSelectedStay] = useState<HotelStay | null>(null)

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'pet', 'customer', 'checkIn', 'checkOut', 'days', 'status'],
    initialTopFilterVisibility: { status: true }
  })

  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  useEffect(() => {
    setSearch(initialSearch)
    setPage(1)
  }, [initialSearch])

  const { data: stays, isLoading } = useQuery({
    queryKey: ['stays'],
    queryFn: () => hotelApi.getStayList(),
  })

  const allStays = useMemo(() => stays?.items || [], [stays?.items])

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
        stay.customer?.fullName?.toLowerCase().includes(normalizedSearch)
      )
    }
    if (stayStatus) {
      filtered = filtered.filter((stay) => stay.status === stayStatus)
    }
    return filtered
  }, [allStays, search, stayStatus])

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
          searchPlaceholder="Tìm thú cưng, mã lưu trú..."
          showColumnToggle={true}
          showFilterToggle={true}
          filterSlot={
            <>
              {topFilterVisibility.status && (
                <select
                  className={toolbarSelectClass}
                  value={stayStatus}
                  onChange={(e) => {
                    setStayStatus(e.target.value)
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
        />

        <DataListFilterPanel onClearAll={clearFilters}>
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
              onChange={(e) => { setStayStatus(e.target.value); setPage(1) }}
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
          bulkBar={
            selectedStayIds.length > 0 ? (
              <DataListBulkBar selectedCount={selectedStayIds.length} onClear={clearSelection}>
                {isSuperAdmin() ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Xoa ${selectedStayIds.length} luot luu tru da chon?`)) {
                        bulkDeleteMutation.mutate(selectedStayIds)
                      }
                    }}
                    disabled={bulkDeleteMutation.isPending}
                    className="inline-flex h-8 items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-3 text-xs font-semibold text-error transition-colors hover:bg-error/20 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Xoa
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
          totalItemText={
            <p className="shrink-0 text-xs text-foreground-muted">
              Tổng số <strong className="text-foreground">{visibleStays.length}</strong> lượt lưu trú
            </p>
          }
        />
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
