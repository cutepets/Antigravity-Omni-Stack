'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, LayoutGrid, List, Pencil, Plus, RefreshCw, Table, Tag, Trash2, UserRound, XCircle } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { ServicePricingWorkspace } from '@/components/service-pricing/ServicePricingWorkspace'
import {
  DataListBulkBar,
  DataListFilterPanel,
  DataListPagination,
  DataListShell,
  DataListTable,
  DataListToolbar,
  DataListColumnPanel,
  TableCheckbox,
  filterInputClass,
  filterSelectClass,
  toolbarSelectClass,
  useDataListSelection,
  useDataListCore,
} from '@petshop/ui/data-list'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useAuthStore } from '@/stores/auth.store'
import { groomingApi, type GroomingSession, type GroomingStatus } from '@/lib/api/grooming.api'
import { staffApi } from '@/lib/api/staff.api'
import { cn } from '@/lib/utils'
import { GroomingSessionDialog } from './grooming-session-dialog'
import { CancelNotesModal } from './cancel-notes-modal'
import {
  formatGroomingDateTime,
  formatGroomingMoney,
  formatGroomingTime,
  GroomingStatusBadge,
  GROOMING_STATUS_META,
  GROOMING_STATUS_ORDER,
} from './grooming-status'

type ViewMode = 'kanban' | 'list' | 'pricing'

const TABLE_COLUMNS = [
  { id: 'session', label: 'Mã SPA', width: 'w-24' },
  { id: 'pet', label: 'Thú cưng', minWidth: 'min-w-[180px]' },
  { id: 'customer', label: 'Khách hàng', minWidth: 'min-w-[170px]' },
  { id: 'staff', label: 'Nhân viên', minWidth: 'min-w-[150px]' },
  { id: 'branch', label: 'Chi nhánh', width: 'whitespace-nowrap' },
  { id: 'status', label: 'Trạng thái', width: 'w-32' },
  { id: 'start', label: 'Bắt đầu', width: 'w-32' },
  { id: 'price', label: 'Giá', width: 'w-28', align: 'right' as const },
  { id: 'created', label: 'Tạo lúc', width: 'w-[140px]' },
] as const

type DisplayColumnId = typeof TABLE_COLUMNS[number]['id']

function getDateKey(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

function getSearchText(session: GroomingSession) {
  return [
    session.sessionCode,
    session.petName,
    session.pet?.breed,
    session.pet?.species,
    session.pet?.customer?.fullName,
    session.pet?.customer?.phone,
    session.staff?.fullName,
    session.id,
    session.orderId,
    session.serviceId,
    session.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function KanbanCard({
  session,
  onOpen,
  canDrag,
}: {
  session: GroomingSession
  onOpen: (session: GroomingSession) => void
  canDrag?: boolean
}) {
  const { hasAnyPermission } = useAuthorization()
  const isCancelled = session.status === 'CANCELLED'
  const canInteract = (canDrag ?? hasAnyPermission(['grooming.update', 'grooming.start', 'grooming.complete', 'grooming.cancel'])) && !isCancelled

  return (
    <button
      type="button"
      draggable={canInteract}
      onDragStart={(event) => {
        if (canInteract) event.dataTransfer.setData('sessionId', session.id)
      }}
      onClick={() => onOpen(session)}
      className={cn(
        'w-[296px] shrink-0 rounded-[24px] border bg-background-base p-4 text-left transition-all',
        canInteract
          ? 'cursor-grab border-border hover:-translate-y-0.5 hover:border-primary-500/35 hover:shadow-lg active:cursor-grabbing'
          : isCancelled
            ? 'cursor-default border-rose-500/20 opacity-70'
            : 'cursor-pointer border-border hover:-translate-y-0.5 hover:border-primary-500/35 hover:shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary-500/15 bg-primary-500/10 text-lg font-black uppercase text-primary-500">
              {session.petName?.charAt(0) || 'P'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground">{session.petName}</p>
              <p className="truncate text-sm text-foreground-muted">{session.pet?.breed || session.pet?.species || 'Không rõ giống'}</p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-foreground-muted">{formatGroomingTime(session.createdAt)}</p>
          <p className="mt-1 text-base font-black text-primary-500">{formatGroomingMoney(session.price)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground-muted">Khách</span>
          <span className="truncate font-medium text-foreground">{session.pet?.customer?.fullName || 'Khách lẻ'}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground-muted">SĐT</span>
          <span className="font-medium text-foreground">{session.pet?.customer?.phone || '—'}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground-muted">Nhân viên</span>
          <span className="truncate font-medium text-foreground">{session.staff?.fullName || 'Chưa phân công'}</span>
        </div>
      </div>
    </button>
  )
}

function KanbanCardCancelled({
  session,
  onOpen,
}: {
  session: GroomingSession
  onOpen: (session: GroomingSession) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(session)}
      className="w-full rounded-2xl border border-rose-500/15 bg-rose-500/3 p-3 text-left transition-all hover:border-rose-500/30 hover:bg-rose-500/6 cursor-pointer"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm font-black uppercase text-rose-500">
          {session.petName?.charAt(0) || 'P'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{session.petName}</p>
          <p className="truncate text-xs text-foreground-muted font-mono">{session.sessionCode || session.id.slice(-6).toUpperCase()}</p>
        </div>
      </div>
    </button>
  )
}

export function GroomingBoard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasPermission, hasAnyPermission, isLoading: isAuthLoading } = useAuthorization()
  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statusFilter, setStatusFilter] = useState<GroomingStatus | ''>('')
  const [staffFilter, setStaffFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [dialogMode, setDialogMode] = useState<'create' | 'detail' | null>(null)
  const [selectedSession, setSelectedSession] = useState<GroomingSession | null>(null)
  const [cancelSessionData, setCancelSessionData] = useState<{ id: string; session: GroomingSession } | null>(null)
  const autoOpenedSessionIdRef = useRef<string | null>(null)
  const canReadGrooming = hasPermission('grooming.read')
  const canCreateGrooming = hasPermission('grooming.create')
  const canManageSessions = hasAnyPermission(['grooming.update', 'grooming.start', 'grooming.complete', 'grooming.cancel'])
  const initialSearch = searchParams.get('search')?.trim() ?? ''
  const initialView = searchParams.get('view')
  const focusSessionId = searchParams.get('sessionId')

  const dataListState = useDataListCore<DisplayColumnId, never>({
    initialColumnOrder: TABLE_COLUMNS.map((col) => col.id as DisplayColumnId),
    initialVisibleColumns: ['session', 'pet', 'customer', 'staff', 'branch', 'status', 'start', 'price', 'created'],
    initialTopFilterVisibility: {}
  })

  const { orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  const renderActiveColumns = () => {
    return orderedVisibleColumns.map((id) => {
      const col = TABLE_COLUMNS.find((c) => c.id === id)!
      return { ...col, id: id as DisplayColumnId }
    })
  }

  const [itemsPerColumn, setItemsPerColumn] = useState(4)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateSize = () => {
      const availableHeight = window.innerHeight - 360
      const calc = Math.floor(availableHeight / 175)
      setItemsPerColumn(Math.max(2, calc))
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadGrooming) {
      router.replace('/dashboard')
    }
  }, [canReadGrooming, isAuthLoading, router])

  useEffect(() => {
    const handleOpenSettings = () => setViewMode(prev => prev === 'pricing' ? 'kanban' : 'pricing')
    window.addEventListener('openGroomingSettings', handleOpenSettings)
    return () => window.removeEventListener('openGroomingSettings', handleOpenSettings)
  }, [])

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch)
      setPage(1)
    }
    if (initialView === 'list' || focusSessionId) {
      setViewMode('list')
    }
  }, [focusSessionId, initialSearch, initialView])

  const sessionsQuery = useQuery({
    queryKey: ['grooming-sessions'],
    queryFn: () => groomingApi.getSessions({ omitBranchId: true }),
    enabled: !isAuthLoading && canReadGrooming,
  })

  const staffQuery = useQuery({
    queryKey: ['staff', 'grooming-board'],
    queryFn: staffApi.getAll,
    enabled: !isAuthLoading && canReadGrooming,
  })

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data])
  const staffOptions = (staffQuery.data ?? []).filter((staff) => !['RESIGNED', 'QUIT'].includes(staff.status))

  useEffect(() => {
    if (!focusSessionId || autoOpenedSessionIdRef.current === focusSessionId || sessions.length === 0) return
    const matchedSession = sessions.find((session) => session.id === focusSessionId)
    if (!matchedSession) return
    autoOpenedSessionIdRef.current = focusSessionId
    setSelectedSession(matchedSession)
    setDialogMode('detail')
    setViewMode('list')
  }, [focusSessionId, sessions])

  const filteredSessions = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()

    return sessions.filter((session) => {
      if (statusFilter && session.status !== statusFilter) return false
      if (staffFilter && session.staffId !== staffFilter) return false
      if (dateFilter && getDateKey(session.createdAt) !== dateFilter) return false
      if (normalizedSearch && !getSearchText(session).includes(normalizedSearch)) return false
      return true
    })
  }, [dateFilter, deferredSearch, sessions, staffFilter, statusFilter])

  const sortedSessions = useMemo(
    () => [...filteredSessions].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [filteredSessions],
  )

  const paginatedSessions = sortedSessions.slice((page - 1) * pageSize, page * pageSize)
  const visibleRowIds = useMemo(() => paginatedSessions.map((session) => `g:${session.id}`), [paginatedSessions])
  const { selectedRowIds, toggleRowSelection, toggleSelectAllVisible, clearSelection, allVisibleSelected } =
    useDataListSelection(visibleRowIds)
  const selectedSessionIds = useMemo(() => Array.from(selectedRowIds).map((rowId) => rowId.replace(/^g:/, '')), [selectedRowIds])

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: GroomingStatus; notes?: string }) =>
      groomingApi.updateSession({ id, status, ...(notes !== undefined ? { notes } : {}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] }),
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể cập nhật trạng thái'),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: GroomingStatus }) => {
      await Promise.all(ids.map((id) => groomingApi.updateSession({ id, status })))
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] })
      toast.success(`Đã cập nhật ${variables.ids.length} phiên`)
      clearSelection()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể cập nhật hàng loạt'),
  })

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setStaffFilter('')
    setDateFilter('')
    setPage(1)
  }

  const handleDrop = (event: React.DragEvent, status: GroomingStatus) => {
    event.preventDefault()
    if (!canManageSessions) return
    const id = event.dataTransfer.getData('sessionId')
    if (!id) return
    const session = sessions.find((item) => item.id === id)
    if (!session || session.status === status) return

    if (status === 'CANCELLED') {
      setCancelSessionData({ id, session })
      return
    }

    updateStatusMutation.mutate({ id, status })
  }

  const handleConfirmCancel = (note: string) => {
    if (!cancelSessionData) return
    const existingNotes = cancelSessionData.session.notes || ''
    const cancelNote = note.trim()
    const combinedNotes = cancelNote ? cancelNote + (existingNotes ? '\n' + existingNotes : '') : existingNotes

    updateStatusMutation.mutate({ id: cancelSessionData.id, status: 'CANCELLED', notes: combinedNotes || undefined })
    setCancelSessionData(null)
  }

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize))
  const rangeStart = filteredSessions.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = filteredSessions.length === 0 ? 0 : Math.min(filteredSessions.length, page * pageSize)
  const activeFilterCount = [statusFilter, staffFilter, dateFilter].filter(Boolean).length

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Dang kiem tra quyen truy cap...</div>
  }

  if (!canReadGrooming) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Dang chuyen huong...</div>
  }

  return (
    <DataListShell className="min-h-0">
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {viewMode === 'pricing' ? (
          <div className="flex flex-col">
            <ServicePricingWorkspace mode="GROOMING" />
          </div>
        ) : (
          <>
            <DataListToolbar
              searchValue={search}
              onSearchChange={(value) => { setSearch(value); setPage(1) }}
              searchPlaceholder="Tìm theo thú cưng, khách, SĐT, mã phiên..."
              showColumnToggle={viewMode === 'list'}
              columnPanelContent={
                viewMode === 'list' && (
                  <DataListColumnPanel
                    columns={TABLE_COLUMNS.map(c => ({ ...c }))}
                    columnOrder={columnOrder}
                    visibleColumns={visibleColumns}
                    sortInfo={{ columnId: 'index', direction: 'asc' }}
                    sortableColumns={new Set()}
                    draggingColumnId={draggingColumnId}
                    onToggle={(id) => dataListState.toggleColumn(id as DisplayColumnId)}
                    onReorder={(s, t) => dataListState.reorderColumn(s as DisplayColumnId, t as DisplayColumnId)}
                    onDragStart={(id) => dataListState.setDraggingColumnId(id as DisplayColumnId)}
                    onDragEnd={() => dataListState.setDraggingColumnId(null)}
                  />
                )
              }
              filterSlot={
                <>
                  <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as GroomingStatus | ''); setPage(1) }} className={toolbarSelectClass}>
                    <option value="">Tất cả trạng thái</option>
                    {GROOMING_STATUS_ORDER.map((status) => <option key={status} value={status}>{GROOMING_STATUS_META[status].label}</option>)}
                  </select>
                  <select value={staffFilter} onChange={(event) => { setStaffFilter(event.target.value); setPage(1) }} className={toolbarSelectClass}>
                    <option value="">Tất cả nhân viên</option>
                    {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}
                  </select>
                  <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }} className={toolbarSelectClass} />
                </>
              }
              extraActions={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-1 border rounded-2xl border-border bg-background-secondary">
                    <button type="button" onClick={() => setViewMode('kanban')} className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors', viewMode === 'kanban' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground')}><LayoutGrid size={15} />Kanban</button>
                    <button type="button" onClick={() => setViewMode('list')} className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors', viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground')}><List size={15} />Danh sách</button>
                  </div>
                </div>
              }
            />

            <DataListFilterPanel onClearAll={clearFilters}>
              <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><Tag size={14} className="text-primary-500" />Trạng thái</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as GroomingStatus | ''); setPage(1) }} className={filterSelectClass}><option value="">Tất cả trạng thái</option>{GROOMING_STATUS_ORDER.map((status) => <option key={status} value={status}>{GROOMING_STATUS_META[status].label}</option>)}</select></label>
              <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><UserRound size={14} className="text-primary-500" />Nhân viên</span><select value={staffFilter} onChange={(event) => { setStaffFilter(event.target.value); setPage(1) }} className={filterSelectClass}><option value="">Tất cả nhân viên</option>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}</select></label>
              <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><CalendarDays size={14} className="text-primary-500" />Ngày tạo</span><input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }} className={filterInputClass} /></label>
            </DataListFilterPanel>

            {viewMode === 'kanban' ? (
              <div className="custom-scrollbar flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
                {GROOMING_STATUS_ORDER.map((status) => {
                  const meta = GROOMING_STATUS_META[status]
                  const Icon = meta.icon
                  const isFlexibleColumn = status === 'PENDING' || status === 'IN_PROGRESS';

                  const columnSessions = filteredSessions.filter((session) => {
                    if (session.status !== status) return false;
                    if (session.branchId !== activeBranchId) return false;

                    if (!dateFilter && (status === 'COMPLETED' || status === 'CANCELLED')) {
                      const todayStr = getDateKey(new Date().toISOString());
                      // Lọc theo ngày cập nhật trạng thái (updatedAt), không phải ngày tạo
                      const sessionDateStr = getDateKey(session.updatedAt ?? session.createdAt);
                      if (todayStr !== sessionDateStr) return false;
                    }

                    return true;
                  })

                  const chunks: GroomingSession[][] = [];
                  if (isFlexibleColumn && columnSessions.length > 0) {
                    for (let i = 0; i < columnSessions.length; i += itemsPerColumn) {
                      chunks.push(columnSessions.slice(i, i + itemsPerColumn));
                    }
                  }

                  // Ẩn cột BOOKED khi không có items nào
                  if (status === 'BOOKED' && columnSessions.length === 0 && !sessionsQuery.isLoading) return null

                  const isCancelledColumn = status === 'CANCELLED'

                  return (
                    <section key={status} className={cn('flex flex-col rounded-[28px] border shrink-0', meta.columnClassName, isFlexibleColumn ? 'w-auto min-w-[320px]' : isCancelledColumn ? 'w-[220px] min-w-[220px] overflow-hidden' : 'w-[320px] min-w-[320px] overflow-hidden')} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}>
                      <div className={cn('flex items-center justify-between px-4 py-3 shrink-0', meta.headerClassName)}>
                        <div className="flex items-center gap-2 text-sm font-bold"><Icon size={16} />{meta.columnTitle}</div>
                        <span className="rounded-full border border-current/15 bg-white/10 px-2 py-1 text-xs font-semibold">{columnSessions.length}</span>
                      </div>
                      <div className={cn("flex flex-1 min-h-0", isFlexibleColumn ? "flex-row p-3 gap-4 overflow-hidden" : "custom-scrollbar flex-col gap-2 p-2 overflow-y-auto overflow-x-hidden")}>
                        {sessionsQuery.isLoading ? (
                          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground-muted w-full">Đang tải...</div>
                        ) : columnSessions.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground-muted w-[296px]">Không có phiên nào trong cột này.</div>
                        ) : isFlexibleColumn ? (
                          chunks.map((chunk, idx) => (
                            <div key={idx} className="flex flex-col gap-3 w-[296px] shrink-0">
                              {chunk.map((session) => <KanbanCard key={session.id} session={session} onOpen={(s) => { setSelectedSession(s); setDialogMode('detail'); }} />)}
                            </div>
                          ))
                        ) : isCancelledColumn ? (
                          columnSessions.map((session) => <KanbanCardCancelled key={session.id} session={session} onOpen={(s) => { setSelectedSession(s); setDialogMode('detail'); }} />)
                        ) : (
                          columnSessions.map((session) => <KanbanCard key={session.id} session={session} onOpen={(s) => { setSelectedSession(s); setDialogMode('detail'); }} />)
                        )}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <>
                <DataListTable
                  columns={renderActiveColumns()}
                  isLoading={sessionsQuery.isLoading}
                  isEmpty={!sessionsQuery.isLoading && paginatedSessions.length === 0}
                  emptyText="Không có phiên grooming phù hợp."
                  allSelected={allVisibleSelected}
                  onSelectAll={() => {
                    if (!canManageSessions) return
                    toggleSelectAllVisible()
                  }}
                  bulkBar={selectedSessionIds.length > 0 ? <DataListBulkBar selectedCount={selectedSessionIds.length} onClear={clearSelection}><button type="button" onClick={() => bulkStatusMutation.mutate({ ids: selectedSessionIds, status: 'IN_PROGRESS' })} disabled={bulkStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm font-semibold text-sky-500 transition-opacity hover:opacity-90 disabled:opacity-50">Đang làm</button><button type="button" onClick={() => bulkStatusMutation.mutate({ ids: selectedSessionIds, status: 'CANCELLED' })} disabled={bulkStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 text-sm font-semibold text-error transition-opacity hover:opacity-90 disabled:opacity-50"><Trash2 size={14} />Hủy phiên</button></DataListBulkBar> : undefined}
                >
                  {paginatedSessions.map((session) => {
                    const rowId = `g:${session.id}`
                    const isSelected = selectedRowIds.has(rowId)
                    return (
                      <tr key={session.id} onClick={() => { setSelectedSession(session); setDialogMode('detail'); }} className={cn('border-b border-border/50 transition-colors hover:bg-background-secondary/40 cursor-pointer', isSelected ? 'bg-primary-500/5' : '')}>
                        <td className="w-12 px-3 py-3" onClick={(e) => e.stopPropagation()}><TableCheckbox checked={isSelected} onCheckedChange={(_, shiftKey) => { if (!canManageSessions) return; toggleRowSelection(rowId, shiftKey) }} /></td>
                        {orderedVisibleColumns.map(columnId => {
                          switch (columnId) {
                            case 'session': return <td key={columnId} className="px-3 py-3"><span className="font-mono text-xs font-semibold text-primary-500">{session.sessionCode || session.id.slice(-6).toUpperCase()}</span></td>;
                            case 'pet': return <td key={columnId} className="px-3 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary-500/15 bg-primary-500/10 text-sm font-black uppercase text-primary-500">{session.petName?.charAt(0) || 'P'}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{session.petName}</p><p className="truncate text-xs text-foreground-muted">{session.pet?.breed || session.pet?.species || 'Không rõ giống'}</p></div></div></td>;
                            case 'customer': return <td key={columnId} className="px-3 py-3"><p className="text-sm font-medium text-foreground">{session.pet?.customer?.fullName || 'Khách lẻ'}</p><p className="mt-1 text-xs text-foreground-muted">{session.pet?.customer?.phone || '—'}</p></td>;
                            case 'branch': return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{(session as any).branch?.name || session.branchId || '—'}</td>;
                            case 'staff': return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{session.staff?.fullName || 'Chưa phân công'}</td>;
                            case 'status': return <td key={columnId} className="px-3 py-3"><GroomingStatusBadge status={session.status} /></td>;
                            case 'start': return <td key={columnId} className="px-3 py-3 text-sm text-foreground-muted">{session.startTime ? formatGroomingDateTime(session.startTime) : '—'}</td>;
                            case 'price': return <td key={columnId} className="px-3 py-3 text-sm font-semibold text-primary-500 text-right">{formatGroomingMoney(session.price)}</td>;
                            case 'created': return <td key={columnId} className="px-3 py-3 text-xs text-foreground-muted">{formatGroomingDateTime(session.createdAt)}</td>;
                            default: return null;
                          }
                        })}
                      </tr>
                    )
                  })}
                </DataListTable>
                <DataListPagination page={page} totalPages={totalPages} pageSize={pageSize} total={filteredSessions.length} rangeStart={rangeStart} rangeEnd={rangeEnd} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[12, 24, 48]} />
              </>
            )}
          </>
        )}

        <GroomingSessionDialog
          isOpen={Boolean(dialogMode)}
          mode={dialogMode || 'create'}
          session={selectedSession}
          onClose={() => {
            setDialogMode(null)
            setSelectedSession(null)
            // Nếu dialog được mở từ URL ?sessionId=... (link từ trang Orders)
            // → reset về kanban tổng quan, xóa URL params
            if (focusSessionId) {
              setViewMode('kanban')
              setSearch('')
              router.replace('/grooming')
            }
          }}
        />
        {cancelSessionData && (
          <CancelNotesModal
            session={cancelSessionData.session}
            onConfirm={handleConfirmCancel}
            onCancel={() => setCancelSessionData(null)}
          />
        )}
      </div>
    </DataListShell>
  )
}
