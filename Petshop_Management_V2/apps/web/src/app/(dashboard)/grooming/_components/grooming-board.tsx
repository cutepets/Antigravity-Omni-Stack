'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, LayoutGrid, List, Pencil, Plus, RefreshCw, Tag, Trash2, UserRound, XCircle } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import {
  DataListBulkBar,
  DataListFilterPanel,
  DataListPagination,
  DataListShell,
  DataListTable,
  DataListToolbar,
  TableCheckbox,
  filterInputClass,
  filterSelectClass,
  toolbarSelectClass,
  useDataListSelection,
} from '@/components/data-list'
import { groomingApi, type GroomingSession, type GroomingStatus } from '@/lib/api/grooming.api'
import { staffApi } from '@/lib/api/staff.api'
import { cn } from '@/lib/utils'
import { GroomingDetailDrawer } from './grooming-detail-drawer'
import { GroomingModal } from './grooming-modal'
import { CancelNotesModal } from './cancel-notes-modal'
import {
  formatGroomingDateTime,
  formatGroomingMoney,
  formatGroomingTime,
  GroomingStatusBadge,
  GROOMING_STATUS_META,
  GROOMING_STATUS_ORDER,
} from './grooming-status'

type ViewMode = 'kanban' | 'list'

const TABLE_COLUMNS = [
  { id: 'session', label: 'Phiên', width: 'w-28' },
  { id: 'pet', label: 'Thú cưng', minWidth: 'min-w-[180px]' },
  { id: 'customer', label: 'Khách hàng', minWidth: 'min-w-[170px]' },
  { id: 'staff', label: 'Nhân viên', minWidth: 'min-w-[150px]' },
  { id: 'status', label: 'Trạng thái', width: 'w-36' },
  { id: 'start', label: 'Bắt đầu', width: 'w-36' },
  { id: 'price', label: 'Giá', width: 'w-28' },
  { id: 'created', label: 'Tạo lúc', width: 'w-40' },
  { id: 'actions', label: 'Thao tác', width: 'w-24' },
] as const

function getDateKey(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

function getSearchText(session: GroomingSession) {
  return [
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
}: {
  session: GroomingSession
  onOpen: (session: GroomingSession) => void
}) {
  const isCancelled = session.status === 'CANCELLED'

  return (
    <button
      type="button"
      draggable={!isCancelled}
      onDragStart={(event) => {
        if (!isCancelled) event.dataTransfer.setData('sessionId', session.id)
      }}
      onClick={() => onOpen(session)}
      className={cn(
        'w-full rounded-[24px] border bg-background-base p-4 text-left transition-all',
        isCancelled
          ? 'cursor-default border-rose-500/20 opacity-70'
          : 'cursor-grab border-border hover:-translate-y-0.5 hover:border-primary-500/35 hover:shadow-lg active:cursor-grabbing',
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

export function GroomingBoard() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statusFilter, setStatusFilter] = useState<GroomingStatus | ''>('')
  const [staffFilter, setStaffFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<GroomingSession | null>(null)
  const [cancelSessionData, setCancelSessionData] = useState<{ id: string; session: GroomingSession } | null>(null)

  const sessionsQuery = useQuery({
    queryKey: ['grooming-sessions'],
    queryFn: () => groomingApi.getSessions(),
  })

  const staffQuery = useQuery({
    queryKey: ['staff', 'grooming-board'],
    queryFn: staffApi.getAll,
  })

  const sessions = sessionsQuery.data ?? []
  const staffOptions = (staffQuery.data ?? []).filter((staff) => !['RESIGNED', 'QUIT'].includes(staff.status))

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

  return (
    <DataListShell className="min-h-0">
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        <DataListToolbar
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(1) }}
          searchPlaceholder="Tìm theo thú cưng, khách, SĐT, mã phiên..."
          showColumnToggle={false}
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
              <button type="button" onClick={() => sessionsQuery.refetch()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background-secondary px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/60"><RefreshCw size={15} className={sessionsQuery.isRefetching ? 'animate-spin' : ''} />Làm mới</button>
              <button type="button" onClick={() => setIsCreateModalOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"><Plus size={15} />Thêm phiên</button>
            </div>
          }
        />

        <DataListFilterPanel onClearAll={clearFilters}>
          <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><Tag size={14} className="text-primary-500" />Trạng thái</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as GroomingStatus | ''); setPage(1) }} className={filterSelectClass}><option value="">Tất cả trạng thái</option>{GROOMING_STATUS_ORDER.map((status) => <option key={status} value={status}>{GROOMING_STATUS_META[status].label}</option>)}</select></label>
          <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><UserRound size={14} className="text-primary-500" />Nhân viên</span><select value={staffFilter} onChange={(event) => { setStaffFilter(event.target.value); setPage(1) }} className={filterSelectClass}><option value="">Tất cả nhân viên</option>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}</select></label>
          <label className="space-y-2"><span className="inline-flex items-center gap-2 text-sm text-foreground-muted"><CalendarDays size={14} className="text-primary-500" />Ngày tạo</span><input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }} className={filterInputClass} /></label>
        </DataListFilterPanel>

        <p className="px-1 text-xs text-foreground-muted">Tổng <strong className="text-foreground">{filteredSessions.length}</strong> phiên{activeFilterCount > 0 ? <span> · {activeFilterCount} bộ lọc đang hoạt động</span> : null}{search ? <span> · tìm kiếm “{search}”</span> : null}</p>

        {viewMode === 'kanban' ? (
          <div className="custom-scrollbar flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
            {GROOMING_STATUS_ORDER.map((status) => {
              const meta = GROOMING_STATUS_META[status]
              const Icon = meta.icon
              const columnSessions = filteredSessions.filter((session) => session.status === status)
              return (
                <section key={status} className={cn('flex w-[320px] min-w-[320px] flex-col overflow-hidden rounded-[28px] border', meta.columnClassName)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}>
                  <div className={cn('flex items-center justify-between px-4 py-3', meta.headerClassName)}>
                    <div className="flex items-center gap-2 text-sm font-bold"><Icon size={16} />{meta.columnTitle}</div>
                    <span className="rounded-full border border-current/15 bg-white/10 px-2 py-1 text-xs font-semibold">{columnSessions.length}</span>
                  </div>
                  <div className="custom-scrollbar flex min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto p-3">
                    {sessionsQuery.isLoading ? <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground-muted">Đang tải dữ liệu...</div> : columnSessions.length === 0 ? <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground-muted">Không có phiên nào trong cột này.</div> : columnSessions.map((session) => <KanbanCard key={session.id} session={session} onOpen={setSelectedSession} />)}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <>
            <DataListTable
              columns={TABLE_COLUMNS.map((column) => ({ ...column }))}
              isLoading={sessionsQuery.isLoading}
              isEmpty={!sessionsQuery.isLoading && paginatedSessions.length === 0}
              emptyText="Không có phiên grooming phù hợp."
              allSelected={allVisibleSelected}
              onSelectAll={toggleSelectAllVisible}
              bulkBar={selectedSessionIds.length > 0 ? <DataListBulkBar selectedCount={selectedSessionIds.length} onClear={clearSelection}><button type="button" onClick={() => bulkStatusMutation.mutate({ ids: selectedSessionIds, status: 'IN_PROGRESS' })} disabled={bulkStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm font-semibold text-sky-500 transition-opacity hover:opacity-90 disabled:opacity-50">Đang làm</button><button type="button" onClick={() => bulkStatusMutation.mutate({ ids: selectedSessionIds, status: 'CANCELLED' })} disabled={bulkStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 text-sm font-semibold text-error transition-opacity hover:opacity-90 disabled:opacity-50"><Trash2 size={14} />Hủy phiên</button></DataListBulkBar> : undefined}
            >
              {paginatedSessions.map((session) => {
                const rowId = `g:${session.id}`
                const isSelected = selectedRowIds.has(rowId)
                return (
                  <tr key={session.id} className={cn('border-b border-border/50 transition-colors hover:bg-background-secondary/40', isSelected ? 'bg-primary-500/5' : '')}>
                    <td className="w-12 px-3 py-3"><TableCheckbox checked={isSelected} onCheckedChange={(_, shiftKey) => toggleRowSelection(rowId, shiftKey)} /></td>
                    <td className="px-3 py-3"><button type="button" onClick={() => setSelectedSession(session)} className="inline-flex items-center gap-1 rounded-lg bg-primary-500/10 px-2 py-1 font-mono text-xs font-semibold text-primary-500 transition-colors hover:bg-primary-500/15">{session.id.slice(-6).toUpperCase()}<Pencil size={12} /></button></td>
                    <td className="px-3 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary-500/15 bg-primary-500/10 text-sm font-black uppercase text-primary-500">{session.petName?.charAt(0) || 'P'}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{session.petName}</p><p className="truncate text-xs text-foreground-muted">{session.pet?.breed || session.pet?.species || 'Không rõ giống'}</p></div></div></td>
                    <td className="px-3 py-3"><p className="text-sm font-medium text-foreground">{session.pet?.customer?.fullName || 'Khách lẻ'}</p><p className="mt-1 text-xs text-foreground-muted">{session.pet?.customer?.phone || '—'}</p></td>
                    <td className="px-3 py-3 text-sm text-foreground">{session.staff?.fullName || 'Chưa phân công'}</td>
                    <td className="px-3 py-3"><GroomingStatusBadge status={session.status} /></td>
                    <td className="px-3 py-3 text-sm text-foreground-muted">{session.startTime ? formatGroomingDateTime(session.startTime) : '—'}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-primary-500">{formatGroomingMoney(session.price)}</td>
                    <td className="px-3 py-3 text-xs text-foreground-muted">{formatGroomingDateTime(session.createdAt)}</td>
                    <td className="px-3 py-3"><button type="button" onClick={() => setSelectedSession(session)} className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background-secondary px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary-500/60">Mở</button></td>
                  </tr>
                )
              })}
            </DataListTable>
            <DataListPagination page={page} totalPages={totalPages} pageSize={pageSize} total={filteredSessions.length} rangeStart={rangeStart} rangeEnd={rangeEnd} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[12, 24, 48]} />
          </>
        )}

        <GroomingModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} initialData={null} />
        <GroomingDetailDrawer isOpen={Boolean(selectedSession)} session={selectedSession} staffOptions={staffOptions} onClose={() => setSelectedSession(null)} />
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
