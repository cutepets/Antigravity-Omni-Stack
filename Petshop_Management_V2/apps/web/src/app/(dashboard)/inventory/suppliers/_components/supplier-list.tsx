'use client'
import Image from 'next/image';

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Building2,
  CalendarClock,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  UserCircle2,
  Wallet,
  Trash2,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { stockApi } from '@/lib/api/stock.api'
import { useAuthorization } from '@/hooks/useAuthorization'
import {
  DataListShell,
  DataListToolbar,
  DataListColumnPanel,
  DataListTable,
  DataListPagination,
  DataListBulkBar,
  TableCheckbox,
  useDataListCore,
  useDataListSelection,
} from '@petshop/ui/data-list'
import { SupplierFormModal } from './supplier-form-modal'
import { SupplierDetailDrawer } from './supplier-detail-drawer'


type DisplayColumnId = 'name' | 'contact' | 'activity' | 'score' | 'debt'
type PinFilterId = never

type SupplierSummary = {
  totalSuppliers: number
  activeSuppliers: number
  suppliersWithDebt: number
  totalDebt: number
  spendLast30Days: number
  avgEvaluationScore: number
}

interface SupplierListProps {
  initialSupplierCode?: string
}

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; sortable?: boolean; width?: string; minWidth?: string }> = [
  { id: 'name', label: 'NhÃ  cung cáº¥p', sortable: true, minWidth: 'min-w-[220px]' },
  { id: 'contact', label: 'LiÃªn há»‡', width: 'w-56' },
  { id: 'activity', label: 'Hoáº¡t Ä‘á»™ng nháº­p', sortable: true, minWidth: 'min-w-[220px]' },
  { id: 'score', label: 'ÄÃ¡nh giÃ¡', sortable: true, width: 'w-44' },
  { id: 'debt', label: 'CÃ´ng ná»£', sortable: true, width: 'w-44' },
]

const SORTABLE_COLUMNS = new Set<DisplayColumnId>(COLUMN_OPTIONS.filter((column) => column.sortable).map((column) => column.id))

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value ?? 0)
  return Math.round(amount).toLocaleString('vi-VN')
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return 'ChÆ°a cÃ³'
  return new Date(value).toLocaleDateString('vi-VN')
}

function getSuppliers(response: any) {
  const data = response?.data?.data
  return Array.isArray(data) ? data : []
}

function buildFallbackSummary(suppliers: any[]): SupplierSummary {
  return {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter((supplier) => supplier.isActive !== false).length,
    suppliersWithDebt: suppliers.filter((supplier) => Number(supplier.stats?.totalDebt ?? supplier.debt ?? 0) > 0).length,
    totalDebt: suppliers.reduce((sum, supplier) => sum + Number(supplier.stats?.totalDebt ?? supplier.debt ?? 0), 0),
    spendLast30Days: suppliers.reduce((sum, supplier) => sum + Number(supplier.stats?.spendLast30Days ?? 0), 0),
    avgEvaluationScore:
      suppliers.length > 0
        ? Math.round(suppliers.reduce((sum, supplier) => sum + Number(supplier.evaluation?.score ?? 0), 0) / suppliers.length)
        : 0,
  }
}

function getScoreTone(score: number) {
  if (score >= 85) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  if (score >= 70) return 'border-sky-500/20 bg-sky-500/10 text-sky-400'
  if (score >= 55) return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
  return 'border-red-500/20 bg-red-500/10 text-red-400'
}

function toAmount(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildFilteredSupplierStats(supplier: any, branchId?: string, dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null
  const now = new Date()
  const last30Days = new Date(now)
  last30Days.setDate(last30Days.getDate() - 30)

  const receipts = Array.isArray(supplier.stockReceipts)
    ? supplier.stockReceipts.filter((receipt: any) => {
        if (receipt.status === 'CANCELLED') return false
        if (branchId && receipt.branchId !== branchId) return false
        const createdAt = new Date(receipt.createdAt)
        if (from && createdAt < from) return false
        if (to && createdAt > to) return false
        return true
      })
    : []

  const totalOrders = receipts.length
  const totalSpent = receipts.reduce((sum: number, receipt: any) => sum + toAmount(receipt.payableAmount ?? receipt.totalReceivedAmount ?? receipt.totalAmount), 0)
  const totalDebt = receipts.reduce((sum: number, receipt: any) => {
    const payableAmount = toAmount(receipt.payableAmount ?? receipt.totalReceivedAmount ?? receipt.totalAmount)
    const paidAmount = toAmount(receipt.paidAmount)
    return sum + Math.max(0, toAmount(receipt.debtAmount) || payableAmount - paidAmount)
  }, 0)
  const spendLast30Days = receipts
    .filter((receipt: any) => new Date(receipt.createdAt) >= last30Days)
    .reduce((sum: number, receipt: any) => sum + toAmount(receipt.payableAmount ?? receipt.totalReceivedAmount ?? receipt.totalAmount), 0)
  const lastOrderAt =
    receipts
      .map((receipt: any) => receipt.createdAt)
      .sort((left: string, right: string) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null

  return {
    ...supplier,
    stats: {
      ...(supplier.stats ?? {}),
      totalOrders,
      totalSpent,
      totalDebt,
      spendLast30Days,
      avgOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      lastOrderAt,
    },
  }
}

export function SupplierList({ initialSupplierCode }: SupplierListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: isAuthLoading, isSuperAdmin } = useAuthorization()
  const canReadSuppliers = hasPermission('supplier.read')
  const canCreateSupplier = hasPermission('supplier.create')
  const canUpdateSupplier = hasPermission('supplier.update')
  const reportSource = searchParams.get('from')
  const scopedBranchId = searchParams.get('branchId')?.trim() || undefined
  const scopedDateFrom = searchParams.get('dateFrom')?.trim() || undefined
  const scopedDateTo = searchParams.get('dateTo')?.trim() || undefined

  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null)
  const [drawerSupplierId, setDrawerSupplierId] = useState<string | null>(null)
  const [initialSupplierResolved, setInitialSupplierResolved] = useState(false)

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadSuppliers) {
      router.replace('/dashboard')
    }
  }, [canReadSuppliers, isAuthLoading, router])

  useEffect(() => {
    const nextSearch = searchParams.get('search') ?? ''
    const nextPage = Number(searchParams.get('page') ?? '1')
    const nextPageSize = Number(searchParams.get('limit') ?? '20')

    setSearch((current) => (current !== nextSearch ? nextSearch : current))
    setPage((current) => (Number.isFinite(nextPage) && nextPage > 0 ? (current !== nextPage ? nextPage : current) : current !== 1 ? 1 : current))
    setPageSize((current) =>
      Number.isFinite(nextPageSize) && nextPageSize > 0 ? (current !== nextPageSize ? nextPageSize : current) : current !== 20 ? 20 : current,
    )
  }, [searchParams])

  useEffect(() => {
    if (isAuthLoading || !canReadSuppliers) return

    const nextParams = new URLSearchParams(searchParams.toString())

    if (search.trim()) nextParams.set('search', search.trim())
    else nextParams.delete('search')

    if (page > 1) nextParams.set('page', String(page))
    else nextParams.delete('page')

    if (pageSize !== 20) nextParams.set('limit', String(pageSize))
    else nextParams.delete('limit')

    const currentQuery = searchParams.toString()
    const nextQuery = nextParams.toString()
    if (currentQuery !== nextQuery) {
      router.replace(nextQuery ? `/inventory/suppliers?${nextQuery}` : '/inventory/suppliers', { scroll: false })
    }
  }, [canReadSuppliers, isAuthLoading, page, pageSize, router, search, searchParams])

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['name', 'contact', 'activity', 'score', 'debt'],
    initialTopFilterVisibility: {},
  })

  const { columnSort, orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId } = dataListState

  const { data: suppliersResponse, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => stockApi.getSuppliers(),
  })

  const suppliers = useMemo(
    () => getSuppliers(suppliersResponse).map((supplier: any) => buildFilteredSupplierStats(supplier, scopedBranchId, scopedDateFrom, scopedDateTo)),
    [scopedBranchId, scopedDateFrom, scopedDateTo, suppliersResponse],
  )
  const summary = useMemo(
    () => buildFallbackSummary(suppliers),
    [suppliers],
  )

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return suppliers

    return suppliers.filter((supplier: any) => {
      return [
        supplier.code,
        supplier.name,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.evaluation?.label,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
  }, [suppliers, search])

  const sortedSuppliers = useMemo(() => {
    return [...filteredSuppliers].sort((left: any, right: any) => {
      const leftStats = left.stats ?? {}
      const rightStats = right.stats ?? {}

      let comparison = 0
      if (columnSort.columnId === 'name') {
        comparison = String(left.name ?? '').localeCompare(String(right.name ?? ''))
      } else if (columnSort.columnId === 'activity') {
        comparison = Number(leftStats.totalOrders ?? 0) - Number(rightStats.totalOrders ?? 0)
      } else if (columnSort.columnId === 'score') {
        comparison = Number(left.evaluation?.score ?? 0) - Number(right.evaluation?.score ?? 0)
      } else if (columnSort.columnId === 'debt') {
        comparison = Number(leftStats.totalDebt ?? left.debt ?? 0) - Number(rightStats.totalDebt ?? right.debt ?? 0)
      }

      return columnSort.direction === 'asc' ? comparison : -comparison
    })
  }, [filteredSuppliers, columnSort])

  const paginatedSuppliers = useMemo(
    () => sortedSuppliers.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, sortedSuppliers],
  )

  const total = sortedSuppliers.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const visibleRowIds = useMemo(() => paginatedSuppliers.map((supplier: any) => `supplier:${supplier.id}`), [paginatedSuppliers])
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, page * pageSize)

  const {
    selectedRowIds,
    toggleRowSelection,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
  } = useDataListSelection(visibleRowIds)
  const selectedSupplierIds = useMemo(() => Array.from(selectedRowIds).map((rowId) => rowId.replace(/^supplier:/, '')), [selectedRowIds])
  const bulkUpdateMutation = useMutation({
    mutationFn: (payload: { ids: string[]; updates: any }) => stockApi.bulkUpdateSuppliers(payload.ids, payload.updates),
    onSuccess: () => {
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => stockApi.bulkDeleteSuppliers(ids),
    onSuccess: () => {
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })

  const activeColumns = useMemo(() => {
    return orderedVisibleColumns.map((id) => {
      const column = COLUMN_OPTIONS.find((item) => item.id === id)!
      return { ...column, id }
    })
  }, [orderedVisibleColumns])

  const drawerSupplier = useMemo(
    () => suppliers.find((supplier: any) => supplier.id === drawerSupplierId) ?? null,
    [drawerSupplierId, suppliers],
  )

  useEffect(() => {
    if (!initialSupplierCode || initialSupplierResolved || suppliers.length === 0) return

    const matchedSupplier =
      suppliers.find((supplier: any) => supplier.code === initialSupplierCode) ??
      suppliers.find((supplier: any) => supplier.id === initialSupplierCode)

    if (matchedSupplier) {
      setDrawerSupplierId(matchedSupplier.id)
      if (matchedSupplier.code && matchedSupplier.code !== initialSupplierCode) {
        router.replace(`/inventory/suppliers/${matchedSupplier.code}`)
      }
    }

    setInitialSupplierResolved(true)
  }, [initialSupplierCode, initialSupplierResolved, router, suppliers])

  const handleCreate = () => {
    setSelectedSupplier(null)
    setIsModalOpen(true)
  }

  const handleOpenDetail = (supplier: any) => {
    setDrawerSupplierId(supplier.id)
  }

  const handleEdit = (supplier: any) => {
    if (!canUpdateSupplier) return
    setDrawerSupplierId(null)
    setSelectedSupplier(supplier)
    requestAnimationFrame(() => setIsModalOpen(true))
  }

  const toggleColumnSort = (columnId: DisplayColumnId) => {
    if (!SORTABLE_COLUMNS.has(columnId)) return
    dataListState.toggleColumnSort(columnId)
  }

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang kiem tra quyen truy cap...</div>
  }

  if (!canReadSuppliers) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang chuyen huong...</div>
  }

  return (
    <>
      <DataListShell>
        {reportSource === 'reports' ? (
          <div className="mx-4 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary-500/15 bg-primary-500/5 px-4 py-3 text-sm text-foreground">
            <span className="font-semibold text-primary-600">Dang mo tu bao cao</span>
            {scopedBranchId ? <span className="rounded-full bg-background px-3 py-1 text-xs">Chi nhanh: {scopedBranchId}</span> : null}
            {scopedDateFrom && scopedDateTo ? (
              <span className="rounded-full bg-background px-3 py-1 text-xs">
                Pham vi ngay: {scopedDateFrom} den {scopedDateTo}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 px-4 pt-1 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Tá»•ng nhÃ  cung cáº¥p',
              value: String(summary.totalSuppliers ?? 0),
              icon: Building2,
            },
            {
              label: 'Äiá»ƒm Ä‘Ã¡nh giÃ¡ TB',
              value: `${summary.avgEvaluationScore ?? 0}/100`,
              icon: ShieldCheck,
            },
            {
              label: 'CÃ³ cÃ´ng ná»£',
              value: String(summary.suppliersWithDebt ?? 0),
              icon: Wallet,
            },
            {
              label: 'Nháº­p 30 ngÃ y',
              value: formatCurrency(summary.spendLast30Days),
              icon: Activity,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-3xl border border-border bg-background-secondary px-5 py-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                <Icon size={14} />
                {label}
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <DataListToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder="TÃ¬m ID NCC, tÃªn, SÄT, email hoáº·c tráº¡ng thÃ¡i..."
          showColumnToggle={true}
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
            canCreateSupplier ? (
              <button type="button" onClick={handleCreate} className="btn-primary liquid-button h-11 rounded-xl px-4 text-sm">
                <Plus size={15} /> ThÃªm nhÃ  cung cáº¥p
              </button>
            ) : null
          }
        />

        <DataListTable
          columns={activeColumns}
          isLoading={isLoading}
          isEmpty={!isLoading && paginatedSuppliers.length === 0}
          emptyText="KhÃ´ng tÃ¬m tháº¥y nhÃ  cung cáº¥p nÃ o."
          allSelected={allVisibleSelected}
          onSelectAll={toggleSelectAllVisible}
          bulkBar={
            selectedRowIds.size > 0 ? (
              <DataListBulkBar selectedCount={selectedRowIds.size} onClear={clearSelection}>
                <select
                  className="h-8 rounded-lg border border-border bg-background-secondary px-3 text-xs font-semibold text-foreground"
                  defaultValue=""
                  disabled={bulkUpdateMutation.isPending}
                  onChange={(event) => {
                    const value = event.target.value
                    event.target.value = ''
                    if (value) bulkUpdateMutation.mutate({ ids: selectedSupplierIds, updates: { isActive: value === 'ACTIVE' } })
                  }}
                >
                  <option value="" disabled>Trang thai</option>
                  <option value="ACTIVE">Hoat dong</option>
                  <option value="INACTIVE">Ngung</option>
                </select>
                {isSuperAdmin() ? (
                  <button
                    type="button"
                    aria-label="Xoa DB"
                    title="Xoa DB"
                    onClick={() => {
                      if (window.confirm(`Xoa vinh vien ${selectedSupplierIds.length} nha cung cap da chon?`)) {
                        bulkDeleteMutation.mutate(selectedSupplierIds)
                      }
                    }}
                    disabled={bulkDeleteMutation.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-error/20 bg-error/10 text-error transition-colors hover:bg-error/15 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </DataListBulkBar>
            ) : undefined
          }
        >
          {paginatedSuppliers.map((supplier: any) => {
            const rowId = `supplier:${supplier.id}`
            const isSelected = selectedRowIds.has(rowId)
            const stats = supplier.stats ?? {}
            const score = Number(supplier.evaluation?.score ?? 0)

            return (
              <tr
                key={supplier.id}
                onClick={() => handleOpenDetail(supplier)}
                className={`border-b border-border/50 transition-colors hover:bg-background-secondary/50 ${isSelected ? 'bg-primary-500/5' : 'cursor-pointer'}`}
              >
                <td className="w-10 px-3 py-3" onClick={(event) => event.stopPropagation()}>
                  <TableCheckbox checked={isSelected} onCheckedChange={(_checked, shiftKey) => toggleRowSelection(rowId, shiftKey)} />
                </td>
                {orderedVisibleColumns.map((columnId) => {
                  switch (columnId) {
                    case 'name':
                      return (
                        <td key={columnId} className="min-w-[220px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-border bg-primary-500/10 text-primary-500">
                              {supplier.avatar ? (
                                <Image src={supplier.avatar} alt={supplier.name} className="h-full w-full object-cover" width={400} height={400} unoptimized />
                              ) : (
                                <UserCircle2 size={22} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate font-semibold text-foreground">{supplier.name}</div>
                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                    supplier.isActive !== false
                                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                      : 'border-border bg-background text-foreground-muted'
                                  }`}
                                >
                                  {supplier.isActive !== false ? 'Active' : 'Paused'}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                                {supplier.code ? <span>{supplier.code}</span> : null}
                                {supplier.code ? <span>â€¢</span> : null}
                                <span>{supplier.evaluation?.label ?? 'ChÆ°a xáº¿p háº¡ng'}</span>
                                {supplier.address ? (
                                  <>
                                    <span>â€¢</span>
                                    <span className="truncate">{supplier.address}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                      )
                    case 'contact':
                      return (
                        <td key={columnId} className="w-56 px-3 py-3">
                          <div className="space-y-1.5 text-sm">
                            {supplier.phone ? (
                              <div className="flex items-center gap-1.5 text-foreground-muted">
                                <Phone size={13} />
                                {supplier.phone}
                              </div>
                            ) : (
                              <div className="text-foreground-muted">ChÆ°a cÃ³ SÄT</div>
                            )}
                            {supplier.address ? (
                              <div className="flex items-start gap-1.5 text-foreground-muted">
                                <MapPin size={13} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{supplier.address}</span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      )
                    case 'activity':
                      return (
                        <td key={columnId} className="min-w-[220px] px-3 py-3">
                          <div className="space-y-1 text-sm">
                            <div className="font-semibold text-foreground">
                              {Number(stats.totalOrders ?? 0).toLocaleString('vi-VN')} phiáº¿u â€¢ {formatCurrency(stats.totalSpent)}
                            </div>
                            <div className="flex items-center gap-1.5 text-foreground-muted">
                              <CalendarClock size={13} />
                              Gáº§n nháº¥t {formatDate(stats.lastOrderAt)}
                            </div>
                            <div className="text-xs text-foreground-muted">
                              30 ngÃ y: {Number(stats.ordersLast30Days ?? 0)} phiáº¿u â€¢ {formatCurrency(stats.spendLast30Days)}
                            </div>
                          </div>
                        </td>
                      )
                    case 'score':
                      return (
                        <td key={columnId} className="w-44 px-3 py-3">
                          <div className="space-y-1.5">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getScoreTone(score)}`}>
                              {score}/100
                            </span>
                            <div className="text-sm font-medium text-foreground">{supplier.evaluation?.label ?? 'ChÆ°a Ä‘Ã¡nh giÃ¡'}</div>
                            <div className="text-xs text-foreground-muted">
                              CÃ´ng ná»£/tá»•ng nháº­p: {Math.round(Number(supplier.evaluation?.debtRatio ?? 0) * 100)}%
                            </div>
                          </div>
                        </td>
                      )
                    case 'debt':
                      return (
                        <td key={columnId} className="w-44 px-3 py-3">
                          <div className={`text-base font-bold ${Number(stats.totalDebt ?? supplier.debt ?? 0) > 0 ? 'text-error' : 'text-foreground'}`}>
                            {formatCurrency(stats.totalDebt ?? supplier.debt)}
                          </div>
                          <div className="mt-1 text-xs text-foreground-muted">
                            TB/phiáº¿u {formatCurrency(stats.avgOrderValue)}
                          </div>
                        </td>
                      )
                  }
                })}
              </tr>
            )
          })}
        </DataListTable>

        <div className="-mt-1">
          <div className="rounded-b-2xl border border-t-0 border-border bg-card/95">
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
                <span className="text-xs">
                  Tá»•ng <strong className="text-foreground">{total}</strong> nhÃ  cung cáº¥p
                </span>
              }
            />
          </div>
        </div>
      </DataListShell>

      <SupplierDetailDrawer
        isOpen={Boolean(drawerSupplierId)}
        supplierId={drawerSupplierId}
        supplierPreview={drawerSupplier}
        canUpdateSupplier={canUpdateSupplier}
        onClose={() => setDrawerSupplierId(null)}
        onEdit={(supplier) => handleEdit(supplier)}
      />

      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedSupplier}
      />
    </>
  )
}
