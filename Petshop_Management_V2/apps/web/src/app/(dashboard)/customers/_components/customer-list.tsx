'use client'

import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  BadgeCheck,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Pin,
  PinOff,
  MapPin,
  CalendarDays,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { customerApi, type ImportCustomerRow } from '@/lib/api/customer.api'
import { CustomerFormModal } from './customer-form-modal'
import { customToast as toast } from '@/components/ui/toast-with-copy'
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
} from '@/components/data-list'

// ── Types & Constants ────────────────────────────────────────────────────────
type DisplayColumnId = 'code' | 'name' | 'contact' | 'address' | 'tier' | 'points' | 'spent' | 'orders' | 'created' | 'status' | 'actions'
type PinFilterId = 'tier' | 'status'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'code',    label: 'Mã KH',       sortable: true, width: 'w-24' },
  { id: 'name',    label: 'Khách hàng',  sortable: true, minWidth: 'min-w-[180px]' },
  { id: 'contact', label: 'Liên hệ',                   minWidth: 'min-w-[140px]' },
  { id: 'address', label: 'Địa chỉ',                   minWidth: 'min-w-[160px]' },
  { id: 'tier',    label: 'Hạng',        sortable: true, width: 'w-28' },
  { id: 'points',  label: 'Điểm',        sortable: true, width: 'w-28' },
  { id: 'spent',   label: 'Chi tiêu',    sortable: true, width: 'w-32' },
  { id: 'orders',  label: 'Đơn hàng',    sortable: true, width: 'w-24' },
  { id: 'created', label: 'Ngày tạo',    sortable: true, width: 'w-28' },
  { id: 'status',  label: 'Trạng thái',  sortable: true, width: 'w-32' },
  { id: 'actions', label: 'Thao tác',                  width: 'w-20' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(
  COLUMN_OPTIONS.filter((c) => c.sortable).map((c) => c.id)
)

const TIER_BADGE: Record<string, string> = {
  BRONZE:  'badge badge-warning',
  SILVER:  'badge badge-gray',
  GOLD:    'badge badge-accent',
  DIAMOND: 'badge badge-info',
}

const TIER_LABEL: Record<string, { label: string; icon: string }> = {
  BRONZE:  { label: 'Đồng',      icon: '🥉' },
  SILVER:  { label: 'Bạc',       icon: '🥈' },
  GOLD:    { label: 'Vàng',      icon: '🥇' },
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

// ── Export helper ────────────────────────────────────────────────────────────
function downloadCSV(data: any[], filename: string) {
  const headers = ['Mã KH', 'Họ tên', 'SĐT', 'Email', 'Địa chỉ', 'Hạng', 'Điểm', 'Tổng chi tiêu', 'Số đơn', 'Ngày tạo']
  const rows = data.map(c => [
    c.customerCode, c.fullName, c.phone, c.email ?? '',
    c.address ?? '', c.tier, c.points ?? 0, c.totalSpent ?? 0,
    c.totalOrders ?? 0,
    c.createdAt ? new Date(c.createdAt).toLocaleDateString('vi-VN') : '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CustomerList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState('')
  
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // System hook for data-list standard
  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['code', 'name', 'contact', 'tier', 'points', 'spent', 'status', 'actions'],
    initialTopFilterVisibility: { tier: true, status: false }
  })
  
  const { topFilterVisibility, columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, tier, isActiveFilter, page, pageSize, columnSort.columnId, columnSort.direction],
    queryFn: () => customerApi.getCustomers({
      search,
      tier: tier || undefined,
      isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      page,
      limit: pageSize,
      sortBy: columnSort.columnId || undefined,
      sortOrder: (columnSort.direction as 'asc' | 'desc') || undefined,
    }),
  })

  const deleteMutation = useMutation({
    mutationFn: customerApi.deleteCustomer,
    onSuccess: () => {
      toast.success('Đã xoá khách hàng')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể xoá khách hàng này'
      toast.error(msg)
    },
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

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await customerApi.exportCustomers({
        tier: tier || undefined,
        isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      })
      downloadCSV(res.data, `khach-hang-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`Đã export ${res.data.length} khách hàng`)
    } catch {
      toast.error('Lỗi export dữ liệu')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Import ───────────────────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const text = await file.text()
      const lines = text.replace(/\r/g, '').split('\n').filter(Boolean)
      const rows: ImportCustomerRow[] = lines.slice(1).map(line => {
        const cols = line.match(/(\".*?\"|[^,]+)/g)?.map(c => c.replace(/^\"|\"$/g, '').trim()) ?? []
        return { customerCode: cols[0] || '', fullName: cols[1] || '', phone: cols[2] || '', email: cols[3] || '', address: cols[4] || '', tier: cols[5] || 'BRONZE' }
      }).filter(r => r.fullName)

      if (!rows.length) { toast.error('File không có dữ liệu hợp lệ'); return }
      const res = await customerApi.importCustomers(rows)
      const { created, updated, errors } = res.data
      toast.success(`Import xong: ${created} tạo mới, ${updated} cập nhật${errors.length ? ` (${errors.length} lỗi)` : ''}`)
      if (errors.length) console.warn('Import errors:', errors)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi import file')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = (c: Customer) => {
    if (window.confirm(`Xoá khách hàng "${c.fullName}"?\n\nHệ thống sẽ kiểm tra trước khi xoá.`)) {
      deleteMutation.mutate(c.id)
    }
  }

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
  const rangeEnd   = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + rawCustomers.length)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <DataListShell>
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
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background-secondary px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/60 disabled:opacity-50"
            >
              <Download size={15} /> Export
            </button>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background-secondary px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/60">
              <Upload size={15} /> Import
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} disabled={isImporting} />
            </label>
            <button
              type="button"
              onClick={() => { setEditingCustomer(null); setIsModalOpen(true) }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus size={15} /> Thêm khách hàng
            </button>
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
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                topFilterVisibility.tier ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
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
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                topFilterVisibility.status ? 'bg-primary-500/12 text-primary-500' : 'text-foreground-muted hover:text-foreground'
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

      <p className="shrink-0 text-xs text-foreground-muted px-1">
        Tổng <strong className="text-foreground">{total}</strong> khách hàng
        {search && <span> · tìm kiếm "<em>{search}</em>"</span>}
      </p>

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
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-error/20 bg-error/10 px-3 text-xs font-semibold text-error transition-colors hover:bg-error/20"
                onClick={() => {
                   if (window.confirm(`Xoá ${selectedRowIds.size} khách hàng đã chọn?`)) {
                      toast.success('Giao diện cho phép chọn để thực hiện xoá hàng loạt.')
                   }
                }}
              >
                <Trash2 size={13} /> Khách hàng
              </button>
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
                      <ExternalLink size={11} className="text-foreground-muted" />
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
                case 'address': return (
                  <td key={columnId} className="px-3 py-3 min-w-[160px]">
                    <div className="flex items-start gap-1">
                      <MapPin size={12} className="text-foreground-muted mt-0.5 shrink-0" />
                      <span className="text-xs text-foreground-muted line-clamp-2">{c.address || '--'}</span>
                    </div>
                  </td>
                );
                case 'tier': return (
                  <td key={columnId} className="px-3 py-3 w-28">
                    <TierBadge tier={c.tier} />
                  </td>
                );
                case 'points': return (
                  <td key={columnId} className="px-3 py-3 w-28">
                    <div className="text-sm font-semibold">{(c.points ?? 0).toLocaleString()} pts</div>
                  </td>
                );
                case 'spent': return (
                  <td key={columnId} className="px-3 py-3 w-32">
                    <div className="text-sm font-semibold text-foreground">
                      {(c.totalSpent ?? 0).toLocaleString('vi-VN')}₫
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
                      <CalendarDays size={12}/>
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
                case 'actions': return (
                  <td key={columnId} className="px-3 py-3 w-20">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setEditingCustomer(c); setIsModalOpen(true) }} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary text-primary-500 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(c)} disabled={deleteMutation.isPending} className="w-8 h-8 flex items-center justify-center rounded-lg border border-error/30 bg-error/10 hover:bg-error/20 text-error transition-colors">
                        <Trash2 size={13} />
                      </button>
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
        pageSizeOptions={[15, 30, 50]}
      />

      <CustomerFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialData={editingCustomer} />
    </DataListShell>
  )
}
