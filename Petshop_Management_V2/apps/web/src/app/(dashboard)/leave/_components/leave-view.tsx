'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    AlertCircle,
    CalendarDays,
    User,
    Pin,
    PinOff,
    CheckCircle,
    XCircle,
    Plus
} from 'lucide-react'
import { leaveApi, LeaveStatus } from '@/lib/api/leave.api'
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
import { LeaveRequestForm } from './leave-request-form'

type DisplayColumnId = 'dateRange' | 'staff' | 'leaveType' | 'totalDays' | 'reason' | 'status' | 'approvedBy'
type PinFilterId = 'status'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
    { id: 'dateRange', label: 'Thời gian nghỉ', sortable: true, width: 'w-48' },
    { id: 'staff', label: 'Nhân viên', sortable: false, minWidth: 'min-w-[160px]' },
    { id: 'leaveType', label: 'Loại nghỉ', sortable: false, width: 'w-32' },
    { id: 'totalDays', label: 'Số ngày', sortable: true, width: 'w-24' },
    { id: 'reason', label: 'Lý do', sortable: false, minWidth: 'min-w-[200px]' },
    { id: 'status', label: 'Trạng thái', sortable: true, width: 'w-32' },
    { id: 'approvedBy', label: 'Người duyệt', sortable: false, width: 'w-32' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(
    COLUMN_OPTIONS.filter((c) => c.sortable).map((c) => c.id)
)

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    APPROVED: { label: 'Đã duyệt', cls: 'badge-success' },
    PENDING: { label: 'Chờ duyệt', cls: 'badge-warning' },
    REJECTED: { label: 'Từ chối', cls: 'badge-error' },
    CANCELLED: { label: 'Đã hủy', cls: 'badge-gray' },
}

const TYPE_BADGE: Record<string, string> = {
    ANNUAL: 'Phép năm',
    SICK: 'Nghỉ ốm',
    UNPAID: 'Không lương',
    MATERNITY: 'Thai sản',
    OTHER: 'Khác',
}

export function LeaveView() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState<LeaveStatus | ''>('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(15)

    const [isFormOpen, setIsFormOpen] = useState(false)

    // Standard Hook for Table View
    const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
        initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
        initialVisibleColumns: ['dateRange', 'staff', 'leaveType', 'totalDays', 'reason', 'status', 'approvedBy'],
        initialTopFilterVisibility: { status: true },
        storageKey: 'leave-list-columns-v1',
    })

    const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

    // Queries
    const { data: listData, isLoading } = useQuery({
        queryKey: ['leave', search, status, page, pageSize],
        queryFn: () => leaveApi.list({
            status: status || undefined,
            page,
            limit: pageSize,
        }),
    })

    // Mutations
    const reviewMutation = useMutation({
        mutationFn: async ({ ids, action }: { ids: string[], action: 'APPROVE' | 'REJECT' }) => {
            return Promise.all(ids.map(id => leaveApi.approve(id, { action })))
        },
        onSuccess: (_, variables) => {
            toast.success(`Đã ${variables.action === 'APPROVE' ? 'duyệt' : 'từ chối'} ${variables.ids.length} đơn nghỉ phép`)
            queryClient.invalidateQueries({ queryKey: ['leave'] })
            clearSelection()
        },
        onError: () => toast.error('Lỗi khi xử lý đơn nghỉ phép'),
    })

    const rawRecords = listData?.data ?? []
    const total = listData?.total ?? 0
    const totalPages = listData?.totalPages ?? 1

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

    return (
        <>
            <DataListShell>
                <DataListToolbar
                    searchValue={search}
                    onSearchChange={(v) => { setSearch(v); setPage(1) }}
                    searchPlaceholder="Tìm kiếm nhân viên..."
                    showColumnToggle={true}
                    showFilterToggle={true}
                    filterSlot={
                        <>
                            {topFilterVisibility.status && (
                                <select
                                    value={status}
                                    onChange={(e) => { setStatus(e.target.value as LeaveStatus); setPage(1) }}
                                    className={toolbarSelectClass}
                                >
                                    <option value="">Tất cả trạng thái</option>
                                    <option value="PENDING">Chờ duyệt</option>
                                    <option value="APPROVED">Đã duyệt</option>
                                    <option value="REJECTED">Từ chối</option>
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
                            onToggleSort={(id) => toggleColumnSort(id as DisplayColumnId)}
                            onDragStart={(id) => dataListState.setDraggingColumnId(id as DisplayColumnId)}
                            onDragEnd={() => dataListState.setDraggingColumnId(null)}
                        />
                    }
                    extraActions={
                        <button
                            type="button"
                            onClick={() => setIsFormOpen(true)}
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                        >
                            <Plus size={15} /> Tạo đơn xin phép
                        </button>
                    }
                />

                <DataListFilterPanel onClearAll={clearFilters}>
                    <label className="space-y-2">
                        <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
                            <span className="inline-flex items-center gap-2">
                                <AlertCircle size={14} className="text-primary-500" />
                                Trạng thái
                            </span>
                        </span>
                        <select
                            value={status}
                            onChange={(e) => { setStatus(e.target.value as LeaveStatus); setPage(1) }}
                            className={filterSelectClass}
                        >
                            <option value="">Tất cả</option>
                            <option value="PENDING">Chờ duyệt</option>
                            <option value="APPROVED">Đã duyệt</option>
                            <option value="REJECTED">Từ chối</option>
                        </select>
                    </label>
                </DataListFilterPanel>

                <DataListTable
                    columns={activeColumns}
                    isLoading={isLoading}
                    isEmpty={!isLoading && rawRecords.length === 0}
                    emptyText="Không có đơn xin phép nào."
                    allSelected={allVisibleSelected}
                    onSelectAll={toggleSelectAllVisible}
                    bulkBar={
                        selectedRowIds.size > 0 ? (
                            <DataListBulkBar selectedCount={selectedRowIds.size} onClear={clearSelection}>
                                <button
                                    type="button"
                                    className="flex h-8 items-center gap-1.5 rounded-lg border border-success-500/20 bg-success-500/10 px-3 text-xs font-semibold text-success-600 transition-colors hover:bg-success-500/20"
                                    onClick={() => {
                                        const ids = Array.from(selectedRowIds).map(id => id.replace('r:', ''))
                                        reviewMutation.mutate({ ids, action: 'APPROVE' })
                                    }}
                                >
                                    <CheckCircle size={13} /> Duyệt đơn ({selectedRowIds.size})
                                </button>
                                <button
                                    type="button"
                                    className="flex h-8 items-center gap-1.5 rounded-lg border border-error/20 bg-error/10 px-3 text-xs font-semibold text-error transition-colors hover:bg-error/20"
                                    onClick={() => {
                                        const ids = Array.from(selectedRowIds).map(id => id.replace('r:', ''))
                                        reviewMutation.mutate({ ids, action: 'REJECT' })
                                    }}
                                >
                                    <XCircle size={13} /> Từ chối ({selectedRowIds.size})
                                </button>
                            </DataListBulkBar>
                        ) : undefined
                    }
                >
                    {rawRecords.map((r: any) => {
                        const rowId = `r:${r.id}`
                        const isSelected = selectedRowIds.has(rowId)

                        return (
                            <tr key={r.id} className={`border-b border-border/50 hover:bg-background-secondary/40 ${isSelected ? 'bg-primary-500/5' : ''}`}>
                                <td className="w-10 px-3 py-3">
                                    <TableCheckbox
                                        checked={isSelected}
                                        onCheckedChange={(checked, shiftKey) => toggleRowSelection(rowId, shiftKey)}
                                    />
                                </td>
                                {orderedVisibleColumns.map(columnId => {
                                    switch (columnId) {
                                        case 'dateRange': return (
                                            <td key={columnId} className="px-3 py-3 w-48">
                                                <div className="flex flex-col text-sm">
                                                    <span className="font-medium">{new Date(r.startDate).toLocaleDateString('vi-VN')}</span>
                                                    <span className="text-foreground-muted">- đến -</span>
                                                    <span className="font-medium">{new Date(r.endDate).toLocaleDateString('vi-VN')}</span>
                                                </div>
                                            </td>
                                        )
                                        case 'staff': return (
                                            <td key={columnId} className="px-3 py-3 min-w-[160px]">
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-foreground-muted" />
                                                    <span className="text-sm font-medium">{r.user?.fullName || r.userId}</span>
                                                </div>
                                            </td>
                                        )
                                        case 'leaveType': return (
                                            <td key={columnId} className="px-3 py-3 w-32 text-sm font-medium">
                                                {TYPE_BADGE[r.leaveType] || r.leaveType}
                                            </td>
                                        )
                                        case 'totalDays': return (
                                            <td key={columnId} className="px-3 py-3 w-24">
                                                <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                                                    <CalendarDays size={12} /> {r.totalDays} ngày
                                                </div>
                                            </td>
                                        )
                                        case 'reason': return (
                                            <td key={columnId} className="px-3 py-3 min-w-[200px]">
                                                <div className="max-w-[300px] truncate pb-0.5 text-sm">
                                                    {r.reason}
                                                </div>
                                                {r.attachmentUrl && (
                                                    <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">
                                                        📎 Xem đính kèm
                                                    </a>
                                                )}
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
                                        case 'approvedBy': return (
                                            <td key={columnId} className="px-3 py-3 w-32">
                                                {r.approvedBy ? (
                                                    <div className="flex flex-col text-xs">
                                                        <span className="font-medium">{r.approver?.fullName || r.approvedBy}</span>
                                                        <span className="text-muted-foreground">{r.approvedAt && new Date(r.approvedAt).toLocaleDateString('vi-VN')}</span>
                                                    </div>
                                                ) : <span className="text-xs text-muted-foreground">--</span>}
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
                />
            </DataListShell>

            <LeaveRequestForm open={isFormOpen} onOpenChange={setIsFormOpen} />
        </>
    )
}
