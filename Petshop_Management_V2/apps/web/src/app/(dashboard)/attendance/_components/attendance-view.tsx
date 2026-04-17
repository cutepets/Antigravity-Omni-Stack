'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    AlertCircle,
    BadgeCheck,
    CalendarDays,
    Clock,
    User,
    Pin,
    PinOff,
} from 'lucide-react'
import { useAuthorization } from '@/hooks/useAuthorization'
import { attendanceApi, type AttendanceStatus } from '@/lib/api/attendance.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
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
} from '@petshop/ui/data-list'

type DisplayColumnId = 'date' | 'staff' | 'checkIn' | 'checkOut' | 'status' | 'isManual' | 'faceConfidence' | 'note'
type PinFilterId = 'status'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
    { id: 'date', label: 'Ngày', sortable: true, width: 'w-32' },
    { id: 'staff', label: 'Nhân viên', sortable: false, minWidth: 'min-w-[160px]' },
    { id: 'checkIn', label: 'Giờ vào', sortable: false, width: 'w-24' },
    { id: 'checkOut', label: 'Giờ ra', sortable: false, width: 'w-24' },
    { id: 'status', label: 'Trạng thái', sortable: true, width: 'w-32' },
    { id: 'isManual', label: 'Thủ công', sortable: false, width: 'w-24' },
    { id: 'faceConfidence', label: 'Xác thực', sortable: false, width: 'w-24' },
    { id: 'note', label: 'Ghi chú', sortable: false, minWidth: 'min-w-[150px]' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(
    COLUMN_OPTIONS.filter((c) => c.sortable).map((c) => c.id)
)

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    AUTO_APPROVED: { label: 'Tự duyệt', cls: 'badge-success' },
    APPROVED: { label: 'Đã duyệt', cls: 'badge-success' },
    PENDING_REVIEW: { label: 'Chờ duyệt', cls: 'badge-warning' },
    REJECTED: { label: 'Từ chối', cls: 'badge-error' },
    ABSENT: { label: 'Vắng mặt', cls: 'badge-error' },
    ON_LEAVE: { label: 'Nghỉ phép', cls: 'badge-info' },
}

export function AttendanceView() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const { hasAnyPermission, hasRole, isLoading: isAuthLoading } = useAuthorization()

    const canReadAttendance = hasAnyPermission(['attendance.read', 'attendance.manage']) || hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
    const canManageAttendance = hasAnyPermission(['attendance.manage']) || hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])

    const [search, setSearch] = useState('')
    const [status, setStatus] = useState<AttendanceStatus | ''>('')

    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(15)

    // Standard Hook for Table View
    const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
        initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
        initialVisibleColumns: ['date', 'staff', 'checkIn', 'checkOut', 'status', 'isManual', 'faceConfidence', 'note'],
        initialTopFilterVisibility: { status: true },
        storageKey: 'attendance-list-columns-v1',
    })

    const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

    useEffect(() => {
        if (isAuthLoading) return
        if (!canReadAttendance) {
            router.replace('/dashboard')
        }
    }, [canReadAttendance, isAuthLoading, router])

    // Queries
    const { data, isLoading } = useQuery({
        queryKey: ['attendance', search, status, page, pageSize, columnSort.columnId, columnSort.direction],
        queryFn: () => attendanceApi.list({
            status: status || undefined,
            page,
            limit: pageSize,
        }),
        enabled: canReadAttendance && !isAuthLoading,
    })

    // Mutations
    const approveMutation = useMutation({
        mutationFn: (ids: string[]) => attendanceApi.bulkReview({ recordIds: ids, status: 'APPROVED' }),
        onSuccess: (res) => {
            toast.success(`Đã duyệt thành công ${res.count} record`)
            queryClient.invalidateQueries({ queryKey: ['attendance'] })
            clearSelection()
        },
        onError: () => toast.error('Lỗi khi duyệt chấm công'),
    })

    const rawRecords = useMemo(() => {
        if (data?.data && Array.isArray(data.data)) return data.data
        if (Array.isArray(data)) return data
        return []
    }, [data])

    const total = data?.total ?? 0
    const totalPages = data?.totalPages ?? 1

    const visibleRowIds = useMemo(
        () => rawRecords.map((r: any) => `r:${r.id}`),
        [rawRecords]
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
        setStatus('')
        setSearch('')
        setPage(1)
    }

    const activeColumns = useMemo(() => {
        return orderedVisibleColumns.map((id) => {
            const col = COLUMN_OPTIONS.find((c) => c.id === id)!
            return { ...col, id: id as DisplayColumnId }
        })
    }, [orderedVisibleColumns])

    const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
    const rangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rawRecords.length)

    if (isAuthLoading) {
        return <div className="flex h-64 items-center justify-center text-foreground-muted">Đang kiểm tra quyền truy cập...</div>
    }

    if (!canReadAttendance) {
        return <div className="flex h-64 items-center justify-center text-foreground-muted">Đang chuyển hướng...</div>
    }

    return (
        <DataListShell>
            <DataListToolbar
                searchValue={search}
                onSearchChange={(v) => { setSearch(v); setPage(1) }}
                searchPlaceholder="Tìm kiếm tên nhân viên..."
                showColumnToggle={true}
                showFilterToggle={true}
                filterSlot={
                    <>
                        {topFilterVisibility.status && (
                            <select
                                value={status}
                                onChange={(e) => { setStatus(e.target.value as AttendanceStatus); setPage(1) }}
                                className={toolbarSelectClass}
                            >
                                <option value="">Tất cả trạng thái</option>
                                <option value="AUTO_APPROVED">Tự duyệt</option>
                                <option value="APPROVED">Đã duyệt</option>
                                <option value="PENDING_REVIEW">Chờ duyệt</option>
                                <option value="REJECTED">Từ chối</option>
                                <option value="ABSENT">Vắng mặt</option>
                                <option value="ON_LEAVE">Nghỉ phép</option>
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
                    <button
                        type="button"
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary-500 bg-primary-500/10 px-4 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-500/20"
                        onClick={() => toast.success('Phần mềm PWA hoặc Máy chấm công sẽ bắn data vào đây. Nếu Admin click, sẽ mở Modal chấm công thủ công.')}
                    >
                        <Clock size={15} /> Tạo chấm công thủ công
                    </button>
                }
            />

            {/* Filter Panel */}
            <DataListFilterPanel onClearAll={clearFilters}>
                <label className="space-y-2">
                    <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
                        <span className="inline-flex items-center gap-2">
                            <AlertCircle size={14} className="text-primary-500" />
                            Trạng thái
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
                        value={status}
                        onChange={(e) => { setStatus(e.target.value as AttendanceStatus); setPage(1) }}
                        className={filterSelectClass}
                    >
                        <option value="">Tất cả</option>
                        <option value="AUTO_APPROVED">Tự duyệt</option>
                        <option value="APPROVED">Đã duyệt</option>
                        <option value="PENDING_REVIEW">Chờ duyệt</option>
                        <option value="REJECTED">Từ chối</option>
                        <option value="ABSENT">Vắng mặt</option>
                        <option value="ON_LEAVE">Nghỉ phép</option>
                    </select>
                </label>
            </DataListFilterPanel>

            <DataListTable
                columns={activeColumns}
                isLoading={isLoading}
                isEmpty={!isLoading && rawRecords.length === 0}
                emptyText="Không tìm thấy dữ liệu chấm công."
                allSelected={allVisibleSelected}
                onSelectAll={toggleSelectAllVisible}
                bulkBar={
                    selectedRowIds.size > 0 && canManageAttendance ? (
                        <DataListBulkBar selectedCount={selectedRowIds.size} onClear={clearSelection}>
                            <button
                                type="button"
                                className="flex h-8 items-center gap-1.5 rounded-lg border border-primary-500/20 bg-primary-500/10 px-3 text-xs font-semibold text-primary-500 transition-colors hover:bg-primary-500/20"
                                onClick={() => {
                                    const ids = Array.from(selectedRowIds).map(id => id.replace('r:', ''))
                                    approveMutation.mutate(ids)
                                }}
                            >
                                <BadgeCheck size={13} /> Duyệt chấm công
                            </button>
                        </DataListBulkBar>
                    ) : undefined
                }
            >
                {rawRecords.map((r: any) => {
                    const rowId = `r:${r.id}`
                    const isSelected = selectedRowIds.has(rowId)

                    return (
                        <tr key={r.id} className={`border-b border-border/50 transition-colors hover:bg-background-secondary/40 ${isSelected ? 'bg-primary-500/5' : ''}`}>
                            <td className="w-10 px-3 py-3">
                                <TableCheckbox
                                    checked={isSelected}
                                    onCheckedChange={(checked, shiftKey) => toggleRowSelection(rowId, shiftKey)}
                                />
                            </td>
                            {orderedVisibleColumns.map(columnId => {
                                switch (columnId) {
                                    case 'date': return (
                                        <td key={columnId} className="px-3 py-3 w-32">
                                            <span className="text-sm font-semibold text-foreground">
                                                {new Date(r.date).toLocaleDateString('vi-VN')}
                                            </span>
                                        </td>
                                    )
                                    case 'staff': return (
                                        <td key={columnId} className="px-3 py-3 min-w-[160px]">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-foreground-muted" />
                                                <span className="text-sm font-medium">{r.staff?.fullName || r.staffId}</span>
                                            </div>
                                        </td>
                                    )
                                    case 'checkIn': return (
                                        <td key={columnId} className="px-3 py-3 w-24">
                                            <span className="text-sm font-mono">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
                                        </td>
                                    )
                                    case 'checkOut': return (
                                        <td key={columnId} className="px-3 py-3 w-24">
                                            <span className="text-sm font-mono">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
                                        </td>
                                    )
                                    case 'status': {
                                        const badge = STATUS_BADGE[r.status] || { label: r.status, cls: 'badge-gray' }
                                        return (
                                            <td key={columnId} className="px-3 py-3 w-32">
                                                <span className={badge.cls}>{badge.label}</span>
                                            </td>
                                        )
                                    }
                                    case 'isManual': return (
                                        <td key={columnId} className="px-3 py-3 w-24">
                                            {r.isManualEntry ? <span className="text-xs font-semibold text-warning">Thủ công</span> : <span className="text-xs text-foreground-muted">Auto</span>}
                                        </td>
                                    )
                                    case 'faceConfidence': return (
                                        <td key={columnId} className="px-3 py-3 w-24">
                                            {r.faceConfidence ? <span className="text-xs">{Math.round(r.faceConfidence * 100)}%</span> : '--'}
                                        </td>
                                    )
                                    case 'note': return (
                                        <td key={columnId} className="px-3 py-3 min-w-[150px]">
                                            {r.manualReason ? <div className="text-xs text-warning truncate" title={r.manualReason}>📝 {r.manualReason}</div> : null}
                                            {r.managerNote ? <div className="text-xs text-info truncate" title={r.managerNote}>👤 {r.managerNote}</div> : null}
                                        </td>
                                    )
                                }
                            })}
                        </tr>
                    )
                })}
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
                        Tổng <strong className="text-foreground">{total}</strong> records
                    </p>
                }
            />
        </DataListShell>
    )
}
