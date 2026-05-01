'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  AlertCircle,
  BadgeCheck,
  Plus,
  Trash2,
  Pin,
  PinOff,
  MapPin,
  CalendarDays,
} from 'lucide-react'
import { useAuthorization } from '@/hooks/useAuthorization'
import { customerApi } from '@/lib/api/customer.api'
import { CustomerFormModal } from './customer-form-modal'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { CrmImportExportDropdown } from '@/components/crm/CrmImportExportDropdown'
import type { Customer } from '@petshop/shared'
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
import { confirmDialog } from '@/components/ui/confirmation-provider'

// ── Types & Constants ────────────────────────────────────────────────────────
type DisplayColumnId = 'code' | 'name' | 'contact' | 'group' | 'address' | 'petCount' | 'petNames' | 'debt' | 'spaCount' | 'hotelCount' | 'tier' | 'points' | 'spent' | 'orders' | 'created' | 'status'
type PinFilterId = 'tier' | 'status'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'code', label: 'Mã KH', sortable: true, width: 'w-24' },
  { id: 'name', label: 'Khách hàng', sortable: true, minWidth: 'min-w-[180px]' },
  { id: 'contact', label: 'Liên hệ', minWidth: 'min-w-[140px]' },
  { id: 'group', label: 'Nhóm KH', minWidth: 'min-w-[120px]' },
  { id: 'address', label: 'Địa chỉ', minWidth: 'min-w-[160px]' },
  { id: 'petCount', label: 'Số thú cưng', sortable: false, width: 'w-24' },
  { id: 'petNames', label: 'Tên thú cưng', sortable: false, minWidth: 'min-w-[140px]' },
  { id: 'debt', label: 'Công nợ', sortable: true, width: 'w-28' },
  { id: 'spaCount', label: 'Lượt Spa', sortable: false, width: 'w-24' },
  { id: 'hotelCount', label: 'Lượt Hotel', sortable: false, width: 'w-24' },
  { id: 'tier', label: 'Hạng', sortable: true, width: 'w-28' },
  { id: 'points', label: 'Điểm', sortable: true, width: 'w-28' },
  { id: 'spent', label: 'Chi tiêu', sortable: true, width: 'w-32' },
  { id: 'orders', label: 'Đơn hàng', sortable: false, width: 'w-24' },
  { id: 'created', label: 'Ngày tạo', sortable: true, width: 'w-28' },
  { id: 'status', label: 'Trạng thái', sortable: true, width: 'w-32' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(
  COLUMN_OPTIONS.filter((c) => c.sortable).map((c) => c.id)
)

const TIER_BADGE: Record<string, string> = {
  BRONZE: 'badge badge-warning',
  SILVER: 'badge badge-gray',
  GOLD: 'badge badge-accent',
  DIAMOND: 'badge badge-info',
}

const TIER_LABEL: Record<string, { label: string; icon: string }> = {
  BRONZE: { label: 'Đồng', icon: '🥉' },
  SILVER: { label: 'Bạc', icon: '🥈' },
  GOLD: { label: 'Vàng', icon: '🥇' },
  DIAMOND: { label: 'Kim cương', icon: '💎' },
}

function TierBadge({ tier }: { tier: string }) {
  const t = TIER_LABEL[tier] ?? TIER_LABEL.BRONZE
  const cls = TIER_BADGE[tier] ?? TIER_BADGE.BRONZE
  return <span className={cls}>{t.icon} {t.label}</span>
}

function compareText(left?: string | null, right?: string | null) {
  return `${left ?? ''}`.localeCompare(`${right ?? ''}`, 'vi', { sensitivity: 'base' })
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CustomerList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasAnyPermission, hasPermission, isLoading: isAuthLoading, isSuperAdmin } = useAuthorization()

  const canReadCustomers = hasAnyPermission(['customer.read.all', 'customer.read.assigned'])
  const canCreateCustomer = hasPermission('customer.create')
  const canDeleteCustomer = hasPermission('customer.delete')
  const canImportCrm = hasAnyPermission(['customer.create', 'customer.update', 'pet.create', 'pet.update'])

  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState('')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const reportSource = searchParams.get('from')
  const reportTab = searchParams.get('tab')
  const scopedBranchId = searchParams.get('branchId')?.trim() || undefined
  const scopedDateFrom = searchParams.get('dateFrom')?.trim() || undefined
  const scopedDateTo = searchParams.get('dateTo')?.trim() || undefined
  const shouldApplyReportActivityRange =
    reportSource === 'reports' &&
    reportTab === 'customers' &&
    Boolean(scopedDateFrom && scopedDateTo)

  // System hook for data-list standard
  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'name', 'contact', 'group', 'petCount', 'debt', 'tier', 'spent', 'status'],
    initialTopFilterVisibility: { tier: true, status: false },
    storageKey: 'customer-list-columns-v4',
  })

  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadCustomers) {
      router.replace('/dashboard')
    }
  }, [canReadCustomers, isAuthLoading, router])

  useEffect(() => {
    const nextSearch = searchParams.get('search') ?? ''
    const nextTier = searchParams.get('tier') ?? ''
    const nextStatus = searchParams.get('status') ?? ''
    const nextPage = Number(searchParams.get('page') ?? '1')
    const nextPageSize = Number(searchParams.get('limit') ?? '15')

    setSearch((current) => (current !== nextSearch ? nextSearch : current))
    setTier((current) => (current !== nextTier ? nextTier : current))
    setIsActiveFilter((current) => (current !== nextStatus ? nextStatus : current))
    setPage((current) => (Number.isFinite(nextPage) && nextPage > 0 ? (current !== nextPage ? nextPage : current) : current !== 1 ? 1 : current))
    setPageSize((current) =>
      Number.isFinite(nextPageSize) && nextPageSize > 0 ? (current !== nextPageSize ? nextPageSize : current) : current !== 15 ? 15 : current,
    )
  }, [searchParams])

  useEffect(() => {
    if (isAuthLoading || !canReadCustomers) return

    const nextParams = new URLSearchParams(searchParams.toString())

    if (search.trim()) nextParams.set('search', search.trim())
    else nextParams.delete('search')

    if (tier) nextParams.set('tier', tier)
    else nextParams.delete('tier')

    if (isActiveFilter) nextParams.set('status', isActiveFilter)
    else nextParams.delete('status')

    if (page > 1) nextParams.set('page', String(page))
    else nextParams.delete('page')

    if (pageSize !== 15) nextParams.set('limit', String(pageSize))
    else nextParams.delete('limit')

    const currentQuery = searchParams.toString()
    const nextQuery = nextParams.toString()
    if (currentQuery !== nextQuery) {
      router.replace(nextQuery ? `/customers?${nextQuery}` : '/customers', { scroll: false })
    }
  }, [canReadCustomers, isActiveFilter, isAuthLoading, page, pageSize, router, search, searchParams, tier])

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: groupsData } = useQuery({
    queryKey: ['settings', 'customer-groups'],
    queryFn: async () => {
      const res = await api.get('/customer-groups')
      return (res.data.data ?? []) as Array<{ id: string; name: string; color?: string }>
    },
  })

  const groupMap = useMemo(() => {
    const map: Record<string, { name: string; color?: string }> = {}
    for (const g of groupsData ?? []) map[g.id] = { name: g.name, color: g.color }
    return map
  }, [groupsData])

  const { data, isLoading } = useQuery({
    queryKey: [
      'customers',
      search,
      tier,
      isActiveFilter,
      scopedBranchId ?? 'all',
      shouldApplyReportActivityRange ? scopedDateFrom : '',
      shouldApplyReportActivityRange ? scopedDateTo : '',
      page,
      pageSize,
      columnSort.columnId,
      columnSort.direction,
    ],
    queryFn: () => customerApi.getCustomers({
      search,
      tier: tier || undefined,
      isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      branchId: scopedBranchId,
      dateFrom: shouldApplyReportActivityRange ? scopedDateFrom : undefined,
      dateTo: shouldApplyReportActivityRange ? scopedDateTo : undefined,
      page,
      limit: pageSize,
      sortBy: columnSort.columnId || undefined,
      sortOrder: (columnSort.direction as 'asc' | 'desc') || undefined,
    }),
  })

  // ── Computation ──────────────────────────────────────────────────────────────
  const rawCustomers = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const processedCustomers = rawCustomers

  const visibleRowIds = useMemo(
    () => processedCustomers.map((c: any) => `c:${c.id}`),
    [processedCustomers]
  )

  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visibleRowIds)
  const selectedCustomerIds = useMemo(
    () => Array.from(selectedRowIds).map((id) => id.replace(/^c:/, '')),
    [selectedRowIds],
  )

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => customerApi.bulkDeleteCustomers(ids),
    onSuccess: (result) => {
      if (result.deletedIds.length > 0) toast.success(`Đã xóa ${result.deletedIds.length} khách hàng`)
      if (result.blocked.length > 0) toast.error(`${result.blocked.length} khách hàng không thể xóa`)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      clearSelection()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Không thể xóa hàng loạt khách hàng')
    },
  })

  const toggleColumnSort = (columnId: DisplayColumnId) => {
    if (!SORTABLE_COLUMNS.has(columnId)) return
    dataListState.toggleColumnSort(columnId)
  }

  const clearFilters = () => {
    setTier('')
    setIsActiveFilter('')
    setSearch('')
    setPage(1)
  }

  // ── Layout Components ─────────────────────────────────────────────────────────

  const activeColumns = useMemo(() => {
    return orderedVisibleColumns.map((id) => {
      const col = COLUMN_OPTIONS.find((c) => c.id === id)!
      return { ...col, id: id as DisplayColumnId }
    })
  }, [orderedVisibleColumns])

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rawCustomers.length)

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Đang kiểm tra quyền truy cập...</div>
  }

  if (!canReadCustomers) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Đang chuyển hướng...</div>
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <DataListShell>
      {reportSource === 'reports' ? (
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary-500/15 bg-primary-500/5 px-4 py-3 text-sm text-foreground">
          <span className="font-semibold text-primary-600">Đang mở từ báo cáo</span>
          {scopedBranchId ? <span className="rounded-full bg-background px-3 py-1 text-xs">Chi nhánh: {scopedBranchId}</span> : null}
          {scopedDateFrom && scopedDateTo ? (
            <span className="rounded-full bg-background px-3 py-1 text-xs">
              Phạm vi ngày: {scopedDateFrom} đến {scopedDateTo}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Toolbar */}
      <DataListToolbar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Tìm kiếm khách hàng..."
        showColumnToggle={true}
        showFilterToggle={true}
        filterSlot={
          <>
            {/* Top filter: Tier */}
            {topFilterVisibility.tier && (
              <select
                value={tier}
                onChange={(e) => { setTier(e.target.value); setPage(1) }}
                className={toolbarSelectClass}
              >
                <option value="">Tất cả hạng</option>
                <option value="BRONZE">🥉 Đồng</option>
                <option value="SILVER">🥈 Bạc</option>
                <option value="GOLD">🥇 Vàng</option>
                <option value="DIAMOND">💎 Kim cương</option>
              </select>
            )}

            {/* Top filter: Status */}
            {topFilterVisibility.status && (
              <select
                value={isActiveFilter}
                onChange={(e) => { setIsActiveFilter(e.target.value); setPage(1) }}
                className={toolbarSelectClass}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">✅ Hoạt động</option>
                <option value="false">🚫 Vô hiệu hoá</option>
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
            <CrmImportExportDropdown
              canImport={canImportCrm}
              onImported={() => {
                queryClient.invalidateQueries({ queryKey: ['customers'] })
                queryClient.invalidateQueries({ queryKey: ['pets'] })
              }}
            />
            {canCreateCustomer ? (
              <button
                type="button"
                onClick={async () => { setEditingCustomer(null); setIsModalOpen(true) }}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Plus size={15} /> Thêm khách hàng
              </button>
            ) : null}
          </div>
        }
      />

      {/* ── Filter Panel ────────────────────────────────── */}
      <DataListFilterPanel onClearAll={clearFilters}>
        <label className="space-y-2">
          <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-2">
              <BadgeCheck size={14} className="text-primary-500" />
              Hạng thành viên
            </span>
            <button
              type="button"
              onClick={() => dataListState.toggleTopFilterVisibility('tier')}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${topFilterVisibility.tier ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              {topFilterVisibility.tier ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </span>
          <select
            value={tier}
            onChange={(e) => { setTier(e.target.value); setPage(1) }}
            className={filterSelectClass}
          >
            <option value="">Tất cả hạng</option>
            <option value="BRONZE">🥉 Đồng</option>
            <option value="SILVER">🥈 Bạc</option>
            <option value="GOLD">🥇 Vàng</option>
            <option value="DIAMOND">💎 Kim cương</option>
          </select>
        </label>

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
            value={isActiveFilter}
            onChange={(e) => { setIsActiveFilter(e.target.value); setPage(1) }}
            className={filterSelectClass}
          >
            <option value="">Tất cả</option>
            <option value="true">✅ Hoạt động</option>
            <option value="false">🚫 Vô hiệu hoá</option>
          </select>
        </label>
      </DataListFilterPanel>


      {/* Table */}
      <DataListTable
        columns={activeColumns}
        isLoading={isLoading}
        isEmpty={!isLoading && processedCustomers.length === 0}
        emptyText="Không tìm thấy khách hàng nào phù hợp."
        allSelected={allVisibleSelected}
        onSelectAll={toggleSelectAllVisible}
        bulkBar={
          selectedRowIds.size > 0 ? (
            <DataListBulkBar
              selectedCount={selectedRowIds.size}
              onClear={clearSelection}
            >
              {canDeleteCustomer && isSuperAdmin() && (
                <button
                  type="button"
                  aria-label="Xóa khách hàng đã chọn"
                  title="Xóa khách hàng đã chọn"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-error/20 bg-error/10 text-error transition-colors hover:bg-error/20"
                  onClick={async () => {
                    if (await confirmDialog(`Xóa ${selectedCustomerIds.length} khách hàng đã chọn?`)) {
                      bulkDeleteMutation.mutate(selectedCustomerIds)
                    }
                  }}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </DataListBulkBar>
          ) : undefined
        }
      >
        {processedCustomers.map((c: any) => {
          const rowId = `c:${c.id}`
          const isSelected = selectedRowIds.has(rowId)

          return (
            <tr
              key={c.id}
              className={`border-b border-border/50 transition-colors hover:bg-background-secondary/40 ${isSelected ? 'bg-primary-500/5' : ''}`}
            >
              <td className="w-10 px-3 py-3">
                <TableCheckbox
                  checked={isSelected}
                  onCheckedChange={(checked, shiftKey) => toggleRowSelection(rowId, shiftKey)}
                />
              </td>
              {orderedVisibleColumns.map(columnId => {
                switch (columnId) {
                  case 'code': return (
                    <td key={columnId} className="px-3 py-3 w-24">
                      <span className="font-mono text-xs font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-md">
                        {c.customerCode || '--'}
                      </span>
                    </td>
                  );
                  case 'name': return (
                    <td key={columnId} className="px-3 py-3 min-w-[180px]">
                      <div
                        onClick={() => router.push(`/customers/${c.id}`)}
                        className="flex items-center gap-1.5 font-semibold text-foreground cursor-pointer hover:text-primary-500 transition-colors"
                      >
                        {c.fullName}
                      </div>
                      {c.notes && <div className="text-xs text-foreground-muted mt-0.5 truncate max-w-[180px]">{c.notes}</div>}
                    </td>
                  );
                  case 'contact': return (
                    <td key={columnId} className="px-3 py-3 min-w-[140px]">
                      <div className="text-sm font-medium text-foreground">{c.phone || '--'}</div>
                      {c.email && <div className="text-xs text-foreground-muted mt-0.5">{c.email}</div>}
                    </td>
                  );
                  case 'group': return (
                    <td key={columnId} className="px-3 py-3 min-w-[120px]">
                      {c.groupId && groupMap[c.groupId] ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground">
                          {groupMap[c.groupId].color && (
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: groupMap[c.groupId].color }} />
                          )}
                          {groupMap[c.groupId].name}
                        </span>
                      ) : <span className="text-[11px] text-foreground-muted">--</span>}
                    </td>
                  );
                  case 'address': return (
                    <td key={columnId} className="px-3 py-3 min-w-[160px]">
                      <div className="flex items-start gap-1">
                        <MapPin size={12} className="text-foreground-muted mt-0.5 shrink-0" />
                        <span className="text-xs text-foreground-muted line-clamp-2">{c.address || '--'}</span>
                      </div>
                    </td>
                  );
                  case 'petCount': return (
                    <td key={columnId} className="px-3 py-3 w-20">
                      <div className="text-sm font-medium">{c.pets?.length || 0}</div>
                    </td>
                  );
                  case 'petNames': return (
                    <td key={columnId} className="px-3 py-3 min-w-[120px]">
                      <div className="text-sm text-foreground-muted line-clamp-2" title={c.pets?.map((p: any) => p.name).join(', ')}>
                        {c.pets?.map((p: any) => p.name).join(', ') || '--'}
                      </div>
                    </td>
                  );
                  case 'debt': return (
                    <td key={columnId} className="px-3 py-3 w-28">
                      <div className={`text-sm font-semibold ${(c.debt ?? 0) > 0 ? 'text-error' : 'text-foreground'}`}>
                        {(c.debt ?? 0).toLocaleString('vi-VN')} đ
                      </div>
                    </td>
                  );
                  case 'spaCount': return (
                    <td key={columnId} className="px-3 py-3 w-24">
                      <div className="text-sm text-foreground-muted">{c.pets?.reduce((sum: number, p: any) => sum + (p._count?.groomingSessions || 0), 0) || 0}</div>
                    </td>
                  );
                  case 'hotelCount': return (
                    <td key={columnId} className="px-3 py-3 w-24">
                      <div className="text-sm text-foreground-muted">{c._count?.hotelStays || 0}</div>
                    </td>
                  );
                  case 'tier': return (
                    <td key={columnId} className="px-3 py-3 w-28">
                      <TierBadge tier={c.tier} />
                    </td>
                  );
                  case 'points': return (
                    <td key={columnId} className="px-3 py-3 w-28">
                      <div className="text-sm font-semibold">{(c.points ?? 0).toLocaleString()} điểm</div>
                    </td>
                  );
                  case 'spent': return (
                    <td key={columnId} className="px-3 py-3 w-32">
                      <div className="text-sm font-semibold text-foreground">
                        {(c.totalSpent ?? 0).toLocaleString('vi-VN')} đ
                      </div>
                    </td>
                  );
                  case 'orders': return (
                    <td key={columnId} className="px-3 py-3 w-24">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background-tertiary text-xs text-foreground-muted font-medium">
                        {c.totalOrders ?? 0} đơn
                      </div>
                    </td>
                  );
                  case 'created': return (
                    <td key={columnId} className="px-3 py-3 w-28 text-xs text-foreground-muted">
                      <div className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('vi-VN') : '--'}
                      </div>
                    </td>
                  );
                  case 'status': return (
                    <td key={columnId} className="px-3 py-3 w-32">
                      {c.isActive !== false ? (
                        <span className="badge-success"><BadgeCheck size={11} /> Hoạt động</span>
                      ) : (
                        <span className="badge-error"><AlertCircle size={11} /> Vô hiệu</span>
                      )}
                    </td>
                  );
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
            Tổng <strong className="text-foreground">{total}</strong> khách hàng
            {search && <span> · tìm kiếm &quot;{search}&quot;</span>}
          </p>
        }
      />

      <CustomerFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialData={editingCustomer} />
    </DataListShell>
  )
}
