'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, LayoutGrid, List, Pencil, Plus, RefreshCw, Table, Tag, Trash2, UserRound, XCircle, Phone } from 'lucide-react'
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
  { id: 'session', label: 'MÃ£ SPA', width: 'w-24' },
  { id: 'pet', label: 'ThÃº cÆ°ng', minWidth: 'min-w-[180px]' },
  { id: 'customer', label: 'KhÃ¡ch hÃ ng', minWidth: 'min-w-[170px]' },
  { id: 'staff', label: 'NhÃ¢n viÃªn', minWidth: 'min-w-[150px]' },
  { id: 'branch', label: 'Chi nhÃ¡nh', width: 'whitespace-nowrap' },
  { id: 'status', label: 'Tráº¡ng thÃ¡i', width: 'w-32' },
  { id: 'start', label: 'Báº¯t Ä‘áº§u', width: 'w-32' },
  { id: 'price', label: 'GiÃ¡', width: 'w-28', align: 'right' as const },
  { id: 'created', label: 'Táº¡o lÃºc', width: 'w-[140px]' },
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
  const canInteract =
    (canDrag ?? hasAnyPermission(['grooming.update', 'grooming.start', 'grooming.complete', 'grooming.cancel'])) &&
    !isCancelled

  const petInitial = (session.petName || 'P').charAt(0).toUpperCase()

  const breedLine = [
    session.pet?.breed || session.pet?.species || null,
    session.weightAtBooking != null
      ? `${session.weightAtBooking}kg`
      : session.weightBand?.label || null,
  ]
    .filter(Boolean)
    .join(' Â· ')

  const allStaff = session.assignedStaff?.length
    ? session.assignedStaff.map((s) => s.fullName)
    : session.staff
      ? [session.staff.fullName]
      : []

  const snap = session.pricingSnapshot as Record<string, any> | null | undefined
  const mainServiceName =
    snap?.mainService?.name ||
    (session.packageCode ? `GÃ³i ${session.packageCode}` : null)
  const extraNames =
    session.extraServices?.map((e) => e.name).join(', ') ||
    (snap?.extraServices as any[] | undefined)?.map((e: any) => e.name).join(', ') ||
    ''

  const timeLabel = session.startTime
    ? new Date(session.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : new Date(session.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const isCalled = (session.contactStatus ?? 'UNCALLED') === 'CALLED'
  const showContact = session.status === 'COMPLETED' || session.status === 'RETURNED'

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
          ? 'cursor-grab border-border hover:-translate-y-0.5 hover:border-primary-500/35 hover:shadow-lg active:cursor-grabbing active:scale-[0.99]'
          : isCancelled
            ? 'cursor-default border-rose-500/20 opacity-70'
            : 'cursor-pointer border-border hover:-translate-y-0.5 hover:border-primary-500/35 hover:shadow-lg',
      )}
    >
      {/* Top block: Avatar left + 2 rows right */}
      <div className="grid grid-cols-[44px_1fr] gap-3">
        {/* Avatar â€” spans 2 rows */}
        <div className="row-span-2 flex h-11 w-11 shrink-0 items-start justify-center pt-0.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary-500/15 bg-primary-500/10 text-base font-black text-primary-500">
            {petInitial}
          </div>
        </div>

        {/* Row 1: TÃªn | Giá»‘ng Â· CÃ¢n - TÃ­nh cÃ¡ch */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[15px] font-bold leading-tight text-foreground">{session.petName}</span>
          {breedLine ? (
            <span className="text-xs text-foreground-muted">{breedLine}</span>
          ) : null}
        </div>

        {/* Row 2: MÃ£ phiáº¿u ná»•i báº­t + Giá» â€” Tá»•ng tiá»n */}
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-primary-500/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary-500">
            {session.sessionCode || `#${session.id.slice(-6).toUpperCase()}`}
          </span>
          <span className="text-[11px] text-foreground-muted">{timeLabel}</span>
          <span className="ml-auto text-[15px] font-black text-primary-500">{formatGroomingMoney(session.price)}</span>
        </div>
      </div>

      {/* Dá»‹ch vá»¥ â€” ná»•i báº­t */}
      {(mainServiceName || extraNames) ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mainServiceName ? (
            <span className="rounded-lg bg-background-secondary px-2 py-1 text-[12px] font-semibold text-foreground">
              {mainServiceName}
            </span>
          ) : null}
          {extraNames ? (
            <span className="rounded-lg bg-background-secondary/70 px-2 py-1 text-[12px] text-foreground-muted">
              {extraNames}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="my-2.5 h-px bg-border/50" />

      {/* KH + SÄT + badge liÃªn há»‡ */}
      <div className="flex items-center gap-1.5 text-[13px]">
        <span className="shrink-0 text-foreground-muted">KH:</span>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {session.pet?.customer?.fullName || 'KhÃ¡ch láº»'}
        </span>
        {session.pet?.customer?.phone ? (
          <span className="shrink-0 text-[12px] text-foreground-muted">{session.pet.customer.phone}</span>
        ) : null}
        {showContact ? (
          <span
            className={`ml-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${isCalled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
              }`}
          >
            {isCalled ? 'ÄÃ£ gá»i' : 'ChÆ°a gá»i'}
          </span>
        ) : null}
      </div>

      {/* NV */}
      {allStaff.length > 0 ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px]">
          <span className="shrink-0 text-foreground-muted">NV:</span>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {allStaff.join(', ')}
          </span>
        </div>
      ) : null}
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
  const { hasPermission, hasAnyPermission, isLoading: isAuthLoading, isSuperAdmin } = useAuthorization()
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
    onError: (error: any) => toast.error(error?.response?.data?.message || 'KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i'),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: GroomingStatus }) => {
      await Promise.all(ids.map((id) => groomingApi.updateSession({ id, status })))
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] })
      toast.success(`ÄÃ£ cáº­p nháº­t ${variables.ids.length} phiÃªn`)
      clearSelection()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'KhÃ´ng thá»ƒ cáº­p nháº­t hÃ ng loáº¡t'),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => groomingApi.bulkDeleteSessions(ids),
    onSuccess: (result) => {
      if (result.deletedIds.length > 0) toast.success(`Da xoa ${result.deletedIds.length} phien grooming`)
      if (result.blocked.length > 0) toast.error(`${result.blocked.length} phien grooming khong the xoa`)
      queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] })
      clearSelection()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the xoa hang loat grooming'),
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
              searchPlaceholder="TÃ¬m theo thÃº cÆ°ng, khÃ¡ch, SÄT, mÃ£ phiÃªn..."
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
                    <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
                    {GROOMING_STATUS_ORDER.map((status) => <option key={status} value={status}>{GROOMING_STATUS_META[status].label}</option>)}
                  </select>
                  <select value={staffFilter} onChange={(event) => { setStaffFilter(event.target.value); setPage(1) }} className={toolbarSelectClass}>
                    <option value="">Táº¥t cáº£ nhÃ¢n viÃªn</option>
                    {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}
                  </select>
                  <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }} className={toolbarSelectClass} />
                </>
              }
              extraActions={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-1 border rounded-2xl border-border bg-background-secondary">
                    <button type="button" onClick={() => setViewMode('kanban')} className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors', viewMode === 'kanban' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground')}><LayoutGrid size={15} />Kanban</button>
                    <button type="button" onClick={() => setViewMode('list')} className={cn('inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors', viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground')}><List size={15} />Danh sÃ¡ch</button>
                  </div>
                </div>
              }
            />

            <DataListFilterPanel onClearAll={clearFilters}>
              <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><Tag size={14} className="text-primary-500" />Tráº¡ng thÃ¡i</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as GroomingStatus | ''); setPage(1) }} className={filterSelectClass}><option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>{GROOMING_STATUS_ORDER.map((status) => <option key={status} value={status}>{GROOMING_STATUS_META[status].label}</option>)}</select></label>
              <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><UserRound size={14} className="text-primary-500" />NhÃ¢n viÃªn</span><select value={staffFilter} onChange={(event) => { setStaffFilter(event.target.value); setPage(1) }} className={filterSelectClass}><option value="">Táº¥t cáº£ nhÃ¢n viÃªn</option>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}</select></label>
              <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><CalendarDays size={14} className="text-primary-500" />NgÃ y táº¡o</span><input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }} className={filterInputClass} /></label>
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

                    if (!dateFilter && (status === 'RETURNED' || status === 'CANCELLED')) {
                      const todayStr = getDateKey(new Date().toISOString());
                      // Lá»c theo ngÃ y cáº­p nháº­t tráº¡ng thÃ¡i (updatedAt), khÃ´ng pháº£i ngÃ y táº¡o
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

                  // áº¨n cá»™t BOOKED khi khÃ´ng cÃ³ items nÃ o
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
                          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground-muted w-full">Äang táº£i...</div>
                        ) : columnSessions.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground-muted w-[296px]">KhÃ´ng cÃ³ phiÃªn nÃ o trong cá»™t nÃ y.</div>
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
                  emptyText="KhÃ´ng cÃ³ phiÃªn grooming phÃ¹ há»£p."
                  allSelected={allVisibleSelected}
                  onSelectAll={() => {
                    if (!canManageSessions) return
                    toggleSelectAllVisible()
                  }}
                  bulkBar={
                    selectedSessionIds.length > 0 ? (
                      <DataListBulkBar selectedCount={selectedSessionIds.length} onClear={clearSelection}>
                        <button type="button" onClick={() => bulkStatusMutation.mutate({ ids: selectedSessionIds, status: 'IN_PROGRESS' })} disabled={bulkStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm font-semibold text-sky-500 transition-opacity hover:opacity-90 disabled:opacity-50">Dang lam</button>
                        <button type="button" onClick={() => bulkStatusMutation.mutate({ ids: selectedSessionIds, status: 'CANCELLED' })} disabled={bulkStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 text-sm font-semibold text-error transition-opacity hover:opacity-90 disabled:opacity-50"><Trash2 size={14} />Huy phien</button>
                        {isSuperAdmin() ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Xoa ${selectedSessionIds.length} phien grooming da chon?`)) {
                                bulkDeleteMutation.mutate(selectedSessionIds)
                              }
                            }}
                            disabled={bulkDeleteMutation.isPending}
                            aria-label="Xóa DB"
                            title="Xóa DB"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-error/20 bg-error/10 text-error transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </DataListBulkBar>
                    ) : undefined
                  }
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
                            case 'pet': return <td key={columnId} className="px-3 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary-500/15 bg-primary-500/10 text-sm font-black uppercase text-primary-500">{session.petName?.charAt(0) || 'P'}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{session.petName}</p><p className="truncate text-xs text-foreground-muted">{session.pet?.breed || session.pet?.species || 'KhÃ´ng rÃµ giá»‘ng'}</p></div></div></td>;
                            case 'customer': return <td key={columnId} className="px-3 py-3"><p className="text-sm font-medium text-foreground">{session.pet?.customer?.fullName || 'KhÃ¡ch láº»'}</p><p className="mt-1 text-xs text-foreground-muted">{session.pet?.customer?.phone || 'â€”'}</p></td>;
                            case 'branch': return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{(session as any).branch?.name || session.branchId || 'â€”'}</td>;
                            case 'staff': return <td key={columnId} className="px-3 py-3 text-sm text-foreground">{session.staff?.fullName || 'ChÆ°a phÃ¢n cÃ´ng'}</td>;
                            case 'status': return <td key={columnId} className="px-3 py-3"><GroomingStatusBadge status={session.status} /></td>;
                            case 'start': return <td key={columnId} className="px-3 py-3 text-sm text-foreground-muted">{session.startTime ? formatGroomingDateTime(session.startTime) : 'â€”'}</td>;
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
            // Náº¿u dialog Ä‘Æ°á»£c má»Ÿ tá»« URL ?sessionId=... (link tá»« trang Orders)
            // â†’ reset vá» kanban tá»•ng quan, xÃ³a URL params
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

