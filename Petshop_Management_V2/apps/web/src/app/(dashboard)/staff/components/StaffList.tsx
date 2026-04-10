'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, MapPin, Phone, UserX, User, Settings, Filter, ShieldAlert, Pin, PinOff } from 'lucide-react'
import dayjs from 'dayjs'
import { Staff } from '@/lib/api/staff.api'
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

interface StaffListProps {
  staffList: Staff[]
  roles: any[]
  canEdit: boolean
  canDeactivate: boolean
  onEdit: (staff: Staff) => void
  onDeactivate: (id: string, name: string) => void
}

type DisplayColumnId = 'avatar' | 'code' | 'staff' | 'role' | 'contact' | 'branch' | 'status' | 'actions'
type PinFilterId = 'role' | 'status'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'avatar', label: 'Ảnh', width: 'w-14' },
  { id: 'code', label: 'Mã NV', sortable: true, width: 'w-24' },
  { id: 'staff', label: 'Nhân viên', sortable: true, minWidth: 'min-w-[180px]' },
  { id: 'role', label: 'Vai trò', sortable: true, width: 'w-32' },
  { id: 'contact', label: 'Liên hệ', minWidth: 'min-w-[140px]' },
  { id: 'branch', label: 'Chi nhánh', minWidth: 'min-w-[120px]' },
  { id: 'status', label: 'Trạng thái', sortable: true, width: 'w-32' },
  { id: 'actions', label: 'Thao tác', width: 'w-24' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(
  COLUMN_OPTIONS.filter((c) => c.sortable).map((c) => c.id)
)

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: any }> = {
  WORKING: { label: 'Đang làm', badgeClass: 'badge-success', icon: CheckCircle2 },
  PROBATION: { label: 'Thử việc', badgeClass: 'badge-info', icon: Clock },
  LEAVE: { label: 'Nghỉ phép', badgeClass: 'badge-warning', icon: Clock },
  OFFICIAL: { label: 'Chính thức', badgeClass: 'badge-success', icon: CheckCircle2 },
  RESIGNED: { label: 'Đã nghỉ', badgeClass: 'badge-error', icon: UserX },
  QUIT: { label: 'Đã nghỉ', badgeClass: 'badge-error', icon: UserX },
}

export function StaffList({ staffList, roles, canEdit, canDeactivate, onEdit, onDeactivate }: StaffListProps) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((c) => c.id),
    initialVisibleColumns: ['avatar', 'code', 'staff', 'role', 'contact', 'branch', 'status', 'actions'],
    initialTopFilterVisibility: { role: true, status: true },
    storageKey: 'staff-list-columns-v1',
  })

  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  // Filter & Sort
  const processedStaff = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase()

    let filtered = staffList.filter((member) => {
      const matchesSearch =
        !normalizedQuery ||
        member.fullName.toLowerCase().includes(normalizedQuery) ||
        member.staffCode.toLowerCase().includes(normalizedQuery) ||
        member.phone?.includes(search) ||
        member.username.toLowerCase().includes(normalizedQuery)

      const matchesStatus = statusFilter === 'ALL' || member.status === statusFilter
      const matchesRole = roleFilter === 'ALL' || member.role?.id === roleFilter

      return matchesSearch && matchesStatus && matchesRole
    })

    if (columnSort.columnId && columnSort.direction) {
      const dir = columnSort.direction === 'asc' ? 1 : -1
      filtered.sort((a, b) => {
        let cmp = 0
        switch (columnSort.columnId) {
          case 'code':
            cmp = (a.staffCode || '').localeCompare(b.staffCode || '', 'vi')
            break
          case 'staff':
            cmp = (a.fullName || '').localeCompare(b.fullName || '', 'vi')
            break
          case 'role':
            cmp = (a.role?.name || '').localeCompare(b.role?.name || '', 'vi')
            break
          case 'status':
            cmp = (a.status || '').localeCompare(b.status || '', 'vi')
            break
          default:
            cmp = 0
        }
        return cmp * dir
      })
    }

    return filtered
  }, [staffList, search, statusFilter, roleFilter, columnSort])

  const total = processedStaff.length
  const totalPages = Math.ceil(total / pageSize) || 1
  const visibleStaff = processedStaff.slice((page - 1) * pageSize, page * pageSize)

  const visibleRowIds = useMemo(() => visibleStaff.map(s => `staff:${s.id}`), [visibleStaff])
  
  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visibleRowIds)

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('ALL')
    setStatusFilter('ALL')
    setPage(1)
  }

  const tableColumns = orderedVisibleColumns.map((colId) => {
    const c = COLUMN_OPTIONS.find((opt) => opt.id === colId)!
    return { ...c, id: colId as DisplayColumnId }
  })

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, page * pageSize)

  return (
    <DataListShell>
      <DataListToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Tìm kiếm nhân viên..."
        showColumnToggle={true}
        showFilterToggle={true}
        filterSlot={
          <>
            {topFilterVisibility.role && roles.length > 0 && (
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
                className={toolbarSelectClass}
              >
                <option value="ALL">Tất cả chức vụ</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}

            {topFilterVisibility.status && (
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className={toolbarSelectClass}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="WORKING">Đang làm việc</option>
                <option value="PROBATION">Thử việc</option>
                <option value="LEAVE">Nghỉ phép</option>
                <option value="RESIGNED">Đã nghỉ việc</option>
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
            onReorder={(src, tgt) => dataListState.reorderColumn(src as DisplayColumnId, tgt as DisplayColumnId)}
            onToggleSort={(id) => dataListState.toggleColumnSort(id as DisplayColumnId)}
            onDragStart={(id) => dataListState.setDraggingColumnId(id as DisplayColumnId)}
            onDragEnd={() => dataListState.setDraggingColumnId(null)}
          />
        }
      />

      <DataListFilterPanel onClearAll={clearFilters}>
        {roles.length > 0 && (
          <label className="space-y-2">
            <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
              <span className="inline-flex items-center gap-2">
                <ShieldAlert size={14} className="text-primary-500" />
                Vai trò
              </span>
              <button
                type="button"
                onClick={() => dataListState.toggleTopFilterVisibility('role')}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  topFilterVisibility.role ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {topFilterVisibility.role ? <Pin size={12} /> : <PinOff size={12} />}
              </button>
            </span>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
              className={filterSelectClass}
            >
              <option value="ALL">Tất cả chức vụ</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-2">
              <Filter size={14} className="text-primary-500" />
              Trạng thái
            </span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('status')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                topFilterVisibility.status ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {topFilterVisibility.status ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className={filterSelectClass}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="WORKING">Đang làm việc</option>
            <option value="PROBATION">Thử việc</option>
            <option value="LEAVE">Nghỉ phép</option>
            <option value="RESIGNED">Đã nghỉ việc</option>
          </select>
        </label>
      </DataListFilterPanel>

      <DataListTable
        columns={tableColumns}
        isLoading={false}
        isEmpty={visibleStaff.length === 0}
        emptyText="Không tìm thấy nhân viên nào phù hợp."
        allSelected={allVisibleSelected}
        onSelectAll={toggleSelectAllVisible}
        bulkBar={
          selectedRowIds.size > 0 ? (
            <DataListBulkBar
              selectedCount={selectedRowIds.size}
              onClear={clearSelection}
            >
              <span className="text-sm text-foreground-muted">Chọn thao tác hàng loạt (đang phát triển)</span>
            </DataListBulkBar>
          ) : undefined
        }
      >
        {visibleStaff.map((staff) => {
          const rowId = `staff:${staff.id}`
          const isSelected = selectedRowIds.has(rowId)
          const statusConf = STATUS_CONFIG[staff.status] || STATUS_CONFIG.WORKING
          const StatusIcon = statusConf.icon
          const canShowDeactivate = canDeactivate && staff.status !== 'RESIGNED' && staff.status !== 'QUIT'
          
          return (
            <tr
              key={staff.id}
              className={`group cursor-pointer border-b border-border/50 hover:bg-background-secondary/40 transition-colors ${isSelected ? 'bg-primary-500/5' : ''}`}
              onClick={() => router.push(`/staff/${staff.username}`)}
            >
              <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                <TableCheckbox 
                  checked={isSelected}
                  onCheckedChange={(c, s) => toggleRowSelection(rowId, s)}
                />
              </td>

              {orderedVisibleColumns.map(colId => {
                switch (colId) {
                  case 'avatar': return (
                    <td key={colId} className="px-3 py-2.5 w-14" onClick={e => e.stopPropagation()}>
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-background-tertiary flex items-center justify-center shrink-0 border border-border">
                        {staff.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={staff.avatar} alt={staff.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-foreground-muted uppercase">
                            {staff.fullName.split(' ').map(p => p[0]).slice(-2).join('')}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                  case 'code': return (
                    <td key={colId} className="px-3 py-2.5 w-24">
                      <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md">
                        {staff.staffCode || '--'}
                      </span>
                    </td>
                  )
                  case 'staff': return (
                    <td key={colId} className="px-3 py-2.5 min-w-[180px]">
                      <div className="font-semibold text-foreground">{staff.fullName}</div>
                      <div className="text-xs text-foreground-muted mt-0.5">@{staff.username}</div>
                    </td>
                  )
                  case 'role': return (
                    <td key={colId} className="px-3 py-2.5 w-32">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-foreground/5 text-foreground-secondary border border-foreground/10">
                        {staff.role?.name || 'Nhân viên'}
                      </span>
                    </td>
                  )
                  case 'contact': return (
                    <td key={colId} className="px-3 py-2.5 min-w-[140px]">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Phone size={13} className="text-foreground-muted" />
                        <span>{staff.phone || '--'}</span>
                      </div>
                      {staff.email && <div className="text-xs text-foreground-muted mt-0.5 truncate">{staff.email}</div>}
                    </td>
                  )
                  case 'branch': return (
                    <td key={colId} className="px-3 py-2.5 min-w-[120px]">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-foreground-muted shrink-0" />
                        <span className="text-xs text-foreground-muted line-clamp-1">{staff.branch?.name || 'Tất cả'}</span>
                      </div>
                    </td>
                  )
                  case 'status': return (
                    <td key={colId} className="px-3 py-2.5 w-32">
                      <span className={statusConf.badgeClass}>
                        <StatusIcon size={11} />
                        {statusConf.label}
                      </span>
                    </td>
                  )
                  case 'actions': return (
                    <td key={colId} className="px-3 py-2.5 w-24 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(staff)}
                            className="p-1.5 text-foreground-muted hover:text-primary-500 rounded-lg hover:bg-primary-500/10 transition-colors"
                            title="Sửa"
                          >
                            <Settings size={15} />
                          </button>
                        )}
                        {canShowDeactivate && (
                          <button
                            type="button"
                            onClick={() => onDeactivate(staff.id, staff.fullName)}
                            className="p-1.5 text-foreground-muted hover:text-error rounded-lg hover:bg-error/10 transition-colors"
                            title="Nghỉ việc"
                          >
                            <UserX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  )
                  default: return <td key={colId} />
                }
              })}
            </tr>
          )
        })}
      </DataListTable>

      <div className="-mt-1 border-t-0">
        <div className="rounded-b-2xl border border-border bg-card/95">
          <DataListPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
            pageSizeOptions={[20, 50, 100]}
            totalItemText={
              <p className="shrink-0 text-xs text-foreground-muted">
                Tổng <strong className="text-foreground">{total}</strong> nhân viên
                {search && <span> · tìm kiếm &quot;{search}&quot;</span>}
              </p>
            }
          />
        </div>
      </div>
    </DataListShell>
  )
}
