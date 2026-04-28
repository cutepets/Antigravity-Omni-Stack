'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pin, PinOff, Paperclip, Settings, Trash2 } from 'lucide-react'
import {
  DataListShell,
  DataListToolbar,
  DataListFilterPanel,
  DataListColumnPanel,
  DataListTable,
  DataListPagination,
  DataListBulkBar,
  TableCheckbox,
  filterInputClass,
  filterSelectClass,
  toolbarSelectClass,
  useDataListCore,
  useDataListSelection,
} from '@petshop/ui/data-list'
import { financeApi, type FinanceTransaction } from '@/lib/api/finance.api'
import { settingsApi } from '@/lib/api/settings.api'
import { buildFinanceVoucherHref } from '@/lib/finance-routes'
import { toast } from 'sonner'
import { CreateTransactionModal } from './create-transaction-modal'
import { FinanceReceiptReconciliationModal } from './finance-receipt-reconciliation-modal'
import { useAuthorization } from '@/hooks/useAuthorization'
import { BankTransactionsTab } from './bank-transactions-tab'
import { CashShiftsTab } from './cash-shifts-tab'
import { CashVaultTab } from './cash-vault-tab'
import { SourceBadge, TransactionBadge } from './finance-badges'

type DisplayColumnId = 'voucher' | 'tags' | 'date' | 'createdAt' | 'updatedAt' | 'type' | 'payer' | 'creator' | 'branch' | 'paymentMethod' | 'amount' | 'category' | 'description' | 'ref' | 'notes' | 'source'
type PinFilterId = 'type' | 'branch' | 'paymentMethod'
type TransactionWindowMode = 'create' | 'view' | 'edit'
type TransactionWindowState = {
  mode: TransactionWindowMode
  transaction: FinanceTransaction | null
  initialType?: 'INCOME' | 'EXPENSE'
}
type FinanceViewTab = 'cashbook' | 'bank-transactions' | 'cash-shifts' | 'cash-vault'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; width?: string; minWidth?: string; align?: 'left' | 'center' | 'right' }> = [
  { id: 'voucher', label: 'Mã phiếu', minWidth: 'min-w-[110px]' },
  { id: 'tags', label: 'Thông tin thêm', width: 'w-40' },
  { id: 'date', label: 'Thời gian giao dịch', minWidth: 'min-w-[140px]' },
  { id: 'createdAt', label: 'Thời gian tạo', minWidth: 'min-w-[140px]' },
  { id: 'updatedAt', label: 'Cập nhật', width: 'w-36' },
  { id: 'type', label: 'Loại', width: 'w-24' },
  { id: 'payer', label: 'Người nộp/nhận', minWidth: 'min-w-[180px]' },
  { id: 'creator', label: 'Người tạo', minWidth: 'min-w-[160px]' },
  { id: 'branch', label: 'Chi nhánh', minWidth: 'min-w-[140px]' },
  { id: 'paymentMethod', label: 'Thanh toán', width: 'w-32' },
  { id: 'amount', label: 'Số tiền', width: 'w-36', align: 'right' },
  { id: 'category', label: 'Danh mục', minWidth: 'min-w-[160px]' },
  { id: 'description', label: 'Mô tả', minWidth: 'min-w-[200px]' },
  { id: 'ref', label: 'Mã liên quan', minWidth: 'min-w-[140px]' },
  { id: 'notes', label: 'Tham chiếu CK', minWidth: 'min-w-[160px]' },
  { id: 'source', label: 'Nguồn', width: 'w-36' },
]

function todayString() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function firstDayOfMonth() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

function isValidDateInput(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function formatCurrency(value: number) {
  return value.toLocaleString('vi-VN')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN')
}

function getVoucherFromLocation() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('voucher')
}

function getLocationSearchParam(key: string, fallback = '') {
  if (typeof window === 'undefined') return fallback
  return new URLSearchParams(window.location.search).get(key) ?? fallback
}

export function FinanceWorkspace() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: isAuthLoading, isSuperAdmin } = useAuthorization()
  const canReadCashbook = hasPermission('report.cashbook')
  const canManagePayment = hasPermission('settings.payment.manage')
  const canReadBankTransactions = canReadCashbook || canManagePayment

  const [voucherParam, setVoucherParam] = useState<string | null>(() => getVoucherFromLocation())

  const [search, setSearch] = useState(() => getLocationSearchParam('search'))
  const [activeTab, setActiveTab] = useState<FinanceViewTab>(() => {
    const tab = getLocationSearchParam('tab')
    if (!canReadCashbook && canReadBankTransactions) return 'bank-transactions'
    if (tab === 'bank-transactions' || tab === 'cash-shifts' || tab === 'cash-vault' || tab === 'cashbook') return tab
    return 'cashbook'
  })
  const deferredSearch = useDeferredValue(search)
  const [type, setType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>(() => {
    const t = getLocationSearchParam('type')
    return t === 'INCOME' || t === 'EXPENSE' ? t : 'ALL'
  })
  const [branchId, setBranchId] = useState(() => getLocationSearchParam('branchId'))
  const [paymentMethod, setPaymentMethod] = useState(() => getLocationSearchParam('paymentMethod'))
  const [dateFrom, setDateFrom] = useState(() => {
    const v = getLocationSearchParam('dateFrom')
    return isValidDateInput(v) ? v : firstDayOfMonth()
  })
  const [dateTo, setDateTo] = useState(() => {
    const v = getLocationSearchParam('dateTo')
    return isValidDateInput(v) ? v : todayString()
  })
  const [page, setPage] = useState(() => {
    const v = Number(getLocationSearchParam('page', '1'))
    return Number.isFinite(v) && v > 0 ? v : 1
  })
  const [pageSize, setPageSize] = useState(() => {
    const v = Number(getLocationSearchParam('limit', '20'))
    return Number.isFinite(v) && v > 0 ? v : 20
  })
  const [transactionWindow, setTransactionWindow] = useState<TransactionWindowState | null>(null)
  const [compareTransaction, setCompareTransaction] = useState<FinanceTransaction | null>(null)

  useEffect(() => {
    const syncVoucherFromUrl = () => setVoucherParam(getVoucherFromLocation())
    window.addEventListener('popstate', syncVoucherFromUrl)
    return () => window.removeEventListener('popstate', syncVoucherFromUrl)
  }, [])

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadCashbook && !canReadBankTransactions) {
      window.location.replace('/dashboard')
    }
  }, [canReadBankTransactions, canReadCashbook, isAuthLoading])



  useEffect(() => {
    if (isAuthLoading) return
    // Khi đang xem voucher cụ thể (route /finance/[voucher]), không đồng bộ URL
    if (voucherParam) return

    const nextParams = new URLSearchParams()

    if (activeTab === 'cashbook') nextParams.delete('tab')
    else nextParams.set('tab', activeTab)

    if (search.trim()) nextParams.set('search', search.trim())
    else nextParams.delete('search')

    if (type !== 'ALL') nextParams.set('type', type)
    else nextParams.delete('type')

    if (branchId) nextParams.set('branchId', branchId)
    else nextParams.delete('branchId')

    if (paymentMethod) nextParams.set('paymentMethod', paymentMethod)
    else nextParams.delete('paymentMethod')

    nextParams.set('dateFrom', dateFrom)
    nextParams.set('dateTo', dateTo)

    if (page > 1) nextParams.set('page', String(page))
    else nextParams.delete('page')

    if (pageSize !== 20) nextParams.set('limit', String(pageSize))
    else nextParams.delete('limit')

    const nextQuery = nextParams.toString()
    const currentQuery = window.location.search.slice(1)
    if (currentQuery !== nextQuery) {
      const nextUrl = nextQuery ? `/finance?${nextQuery}` : '/finance'
      router.replace(nextUrl)
    }
  }, [activeTab, branchId, dateFrom, dateTo, isAuthLoading, page, pageSize, paymentMethod, router, search, type, voucherParam])


  useEffect(() => {
    if (!transactionWindow?.transaction) {
      setCompareTransaction(null)
    }
  }, [transactionWindow])

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['voucher', 'amount', 'createdAt', 'date', 'type', 'payer', 'creator', 'branch', 'paymentMethod', 'category', 'description', 'ref', 'notes'],
    initialTopFilterVisibility: { type: true, branch: true, paymentMethod: true },
    storageKey: 'finance-workspace-list-v6',
  })

  const { orderedVisibleColumns, visibleColumns, columnOrder, draggingColumnId, columnSort, topFilterVisibility } = dataListState

  const financeQuery = useQuery({
    queryKey: ['finance', 'transactions', deferredSearch, type, branchId, paymentMethod, dateFrom, dateTo, page, pageSize],
    queryFn: () =>
      financeApi.list({
        search: deferredSearch || undefined,
        type,
        branchId: branchId || undefined,
        paymentMethod: paymentMethod || undefined,
        dateFrom,
        dateTo,
        page,
        limit: pageSize,
        includeMeta: true,
      }),
  })

  const voucherTransactionQuery = useQuery({
    queryKey: ['finance', 'transaction', voucherParam],
    queryFn: () => financeApi.getByVoucher(voucherParam!),
    enabled: Boolean(voucherParam),
    retry: false,
    staleTime: 10_000,
  })

  const branchesQuery = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: settingsApi.getBranches,
    staleTime: 5 * 60 * 1000,
  })

  const deleteTransaction = useMutation({
    mutationFn: (id: string) => financeApi.remove(id),
    onSuccess: () => {
      toast.success('Đã xóa phiếu thu chi')
      queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] })
      setTransactionWindow(null)
      setCompareTransaction(null)
      setVoucherParam(null)
      router.push('/finance')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể xóa phiếu thu chi')
    },
  })

  const bulkDeleteTransactions = useMutation({
    mutationFn: (ids: string[]) => financeApi.bulkRemove(ids),
    onSuccess: (result) => {
      if (result.deletedIds.length > 0) toast.success(`Da xoa ${result.deletedIds.length} phieu thu chi`)
      if (result.blocked.length > 0) toast.error(`${result.blocked.length} phieu thu chi khong the xoa`)
      queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] })
      selection.clearSelection()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Khong the xoa hang loat phieu thu chi')
    },
  })

  const financeData = financeQuery.data
  const transactions = useMemo(() => financeData?.transactions ?? [], [financeData?.transactions])
  const meta = financeData?.meta
  const total = financeData?.total ?? 0
  const totalPages = financeData?.totalPages ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, rangeStart + transactions.length - 1)
  const rowIds = useMemo(() => transactions.map((transaction) => transaction.id), [transactions])
  const selection = useDataListSelection(rowIds)
  const visibleColumnsForTable = orderedVisibleColumns.map((columnId) => COLUMN_OPTIONS.find((column) => column.id === columnId)!).filter(Boolean)

  const handleChangeTab = (nextTab: FinanceViewTab) => {
    setActiveTab(nextTab)
    const nextParams = new URLSearchParams()
    if (nextTab !== 'cashbook') nextParams.set('tab', nextTab)
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `/finance?${nextQuery}` : '/finance')
  }

  const clearFilters = () => {
    setSearch('')
    setType('ALL')
    setBranchId('')
    setPaymentMethod('')
    setDateFrom(firstDayOfMonth())
    setDateTo(todayString())
    setPage(1)
  }

  const closeTransactionWindow = () => {
    setTransactionWindow(null)
    setCompareTransaction(null)
    setVoucherParam(null)

    router.push('/finance')
  }

  const handleCreateClick = (initialType: 'INCOME' | 'EXPENSE') => {
    setTransactionWindow({ mode: 'create', transaction: null, initialType })
  }

  const handleSavedTransaction = (savedTransaction: FinanceTransaction) => {
    setTransactionWindow((current) => (current ? { mode: 'view', transaction: savedTransaction } : current))
    setCompareTransaction((current) => (current?.id === savedTransaction.id ? savedTransaction : current))
  }

  const handleOpenTransaction = (transaction: FinanceTransaction) => {
    router.push(`/finance?voucher=${encodeURIComponent(transaction.voucherNumber)}`)
    setVoucherParam(transaction.voucherNumber)
    setTransactionWindow({ mode: 'view', transaction })
  }

  const handleOpenCompare = () => {
    if (!transactionWindow?.transaction) return
    setCompareTransaction(transactionWindow.transaction)
  }

  const handleDeleteClick = (transaction: FinanceTransaction) => {
    if (!transaction.canDelete || deleteTransaction.isPending) {
      return
    }

    const confirmed = window.confirm(`Xoa phieu ${transaction.voucherNumber}?`)
    if (!confirmed) {
      return
    }

    deleteTransaction.mutate(transaction.id)
  }

  const extractTraceTags = (transaction: FinanceTransaction) =>
    (transaction.tags ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item !== 'POS_ORDER' && item !== 'FINANCE_DEMO')

  useEffect(() => {
    if (!voucherParam || !voucherTransactionQuery.data) return

    setTransactionWindow((current) => {
      if (current?.mode === 'edit' && current.transaction?.id === voucherTransactionQuery.data.id) {
        return current
      }

      return {
        mode: 'view',
        transaction: voucherTransactionQuery.data,
      }
    })
  }, [voucherParam, voucherTransactionQuery.data])

  useEffect(() => {
    if (!voucherParam || !voucherTransactionQuery.error) return

    toast.error('Không tìm thấy phiếu thu chi theo số chứng từ')
    setTransactionWindow(null)
    setCompareTransaction(null)
    setVoucherParam(null)

    router.push('/finance')
  }, [voucherParam, voucherTransactionQuery.error, router])

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang kiem tra quyen truy cap...</div>
  }

  if (!canReadCashbook && !canReadBankTransactions) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang chuyen huong...</div>
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex shrink-0 flex-wrap gap-2">
          {([
            canReadCashbook ? (['cashbook', 'Sổ quỹ'] as const) : null,
            canReadBankTransactions ? (['bank-transactions', 'Sổ chuyển khoản'] as const) : null,
            canReadCashbook ? (['cash-shifts', 'Sổ Tiền mặt'] as const) : null,
            canReadCashbook ? (['cash-vault', 'Két tiền'] as const) : null,
          ].filter(Boolean) as ReadonlyArray<readonly [FinanceViewTab, string]>).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              onClick={() => handleChangeTab(tabId)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tabId
                ? 'border-primary-500/70 bg-primary-500/18 text-primary-700 shadow-sm'
                : 'border-border/60 bg-background-secondary text-foreground-muted hover:border-border hover:text-foreground'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'bank-transactions' && canReadBankTransactions ? <BankTransactionsTab canManagePayment={canManagePayment} /> : null}
        {activeTab === 'cash-shifts' && canReadCashbook ? <CashShiftsTab /> : null}
        {activeTab === 'cash-vault' && canReadCashbook ? <CashVaultTab /> : null}
        {activeTab === 'cashbook' && canReadCashbook ? (
          <>
            <div className="grid shrink-0 gap-3 lg:grid-cols-4">
              {[
                { label: 'Số dư đầu kỳ', value: financeData?.openingBalance ?? 0 },
                { label: 'Tổng thu', value: financeData?.totalIncome ?? 0, tone: 'text-emerald-600' },
                { label: 'Tổng chi', value: financeData?.totalExpense ?? 0, tone: 'text-rose-600' },
                { label: 'Tồn cuối kỳ', value: financeData?.closingBalance ?? 0, tone: 'text-sky-600' },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <p className="text-sm font-medium text-foreground-secondary">{card.label}</p>
                  <p className={`mt-3 text-2xl font-semibold ${card.tone ?? 'text-foreground'}`}>{formatCurrency(card.value)}</p>
                </div>
              ))}
            </div>

            <DataListShell className="flex-1">
              <DataListToolbar
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
                searchPlaceholder="Tìm mã phiếu, tham chiếu, tên người nộp/nhận..."
                showFilterToggle={true}
                showColumnToggle={true}
                filterSlot={
                  <>
                    {topFilterVisibility.type ? (
                      <select value={type} onChange={(event) => { setType(event.target.value as 'ALL' | 'INCOME' | 'EXPENSE'); setPage(1) }} className={toolbarSelectClass}>
                        <option value="ALL">Tất cả</option>
                        <option value="INCOME">Phiếu thu</option>
                        <option value="EXPENSE">Phiếu chi</option>
                      </select>
                    ) : null}
                    {topFilterVisibility.branch ? (
                      <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }} className={toolbarSelectClass}>
                        <option value="">Tất cả chi nhánh</option>
                        {(meta?.branches ?? []).map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {topFilterVisibility.paymentMethod ? (
                      <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPage(1) }} className={toolbarSelectClass}>
                        <option value="">Mọi hình thức</option>
                        {(meta?.paymentMethods ?? []).map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </>
                }
                columnPanelContent={
                  <DataListColumnPanel
                    columns={COLUMN_OPTIONS}
                    columnOrder={columnOrder}
                    visibleColumns={visibleColumns}
                    sortInfo={columnSort}
                    draggingColumnId={draggingColumnId}
                    onToggle={(columnId) => dataListState.toggleColumn(columnId as DisplayColumnId)}
                    onReorder={(sourceId, targetId) => dataListState.reorderColumn(sourceId as DisplayColumnId, targetId as DisplayColumnId)}
                    onDragStart={(columnId) => dataListState.setDraggingColumnId(columnId as DisplayColumnId)}
                    onDragEnd={() => dataListState.setDraggingColumnId(null)}
                  />
                }
                extraActions={
                  <>
                    <button
                      type="button"
                      onClick={() => handleCreateClick('INCOME')}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 text-sm font-semibold text-sky-700 shadow-sm transition-colors hover:border-sky-400 hover:bg-sky-100"
                    >
                      + Phiếu Thu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreateClick('EXPENSE')}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:border-rose-400 hover:bg-rose-100"
                    >
                      + Phiếu Chi
                    </button>
                  </>
                }
              />

              <DataListFilterPanel onClearAll={clearFilters}>
                <label className="space-y-2">
                  <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
                    <span>Loại phiếu</span>
                    <button type="button" onClick={() => dataListState.toggleTopFilterVisibility('type')} className="text-foreground-muted hover:text-foreground">
                      {topFilterVisibility.type ? <Pin size={14} /> : <PinOff size={14} />}
                    </button>
                  </span>
                  <select value={type} onChange={(event) => { setType(event.target.value as 'ALL' | 'INCOME' | 'EXPENSE'); setPage(1) }} className={filterSelectClass}>
                    <option value="ALL">Tất cả</option>
                    <option value="INCOME">Phiếu thu</option>
                    <option value="EXPENSE">Phiếu chi</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
                    <span>Chi nhánh</span>
                    <button type="button" onClick={() => dataListState.toggleTopFilterVisibility('branch')} className="text-foreground-muted hover:text-foreground">
                      {topFilterVisibility.branch ? <Pin size={14} /> : <PinOff size={14} />}
                    </button>
                  </span>
                  <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1) }} className={filterSelectClass}>
                    <option value="">Tất cả chi nhánh</option>
                    {(meta?.branches ?? []).map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
                    <span>Thanh toán</span>
                    <button type="button" onClick={() => dataListState.toggleTopFilterVisibility('paymentMethod')} className="text-foreground-muted hover:text-foreground">
                      {topFilterVisibility.paymentMethod ? <Pin size={14} /> : <PinOff size={14} />}
                    </button>
                  </span>
                  <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPage(1) }} className={filterSelectClass}>
                    <option value="">Mọi hình thức</option>
                    {(meta?.paymentMethods ?? []).map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-foreground-muted">Khoảng ngày</span>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className={filterInputClass} />
                    <span className="text-foreground-muted">-</span>
                    <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className={filterInputClass} />
                  </div>
                </label>
              </DataListFilterPanel>

              <DataListTable
                columns={visibleColumnsForTable}
                isLoading={financeQuery.isLoading}
                isEmpty={!financeQuery.isLoading && transactions.length === 0}
                emptyText="Chưa có giao dịch phù hợp trong kỳ này."
                allSelected={selection.allVisibleSelected}
                onSelectAll={selection.toggleSelectAllVisible}
                bulkBar={
                  selection.selectedRowIds.size > 0 ? (
                    <DataListBulkBar selectedCount={selection.selectedRowIds.size} onClear={selection.clearSelection}>
                      {isSuperAdmin() ? (
                        <button
                          type="button"
                          onClick={() => {
                            const ids = Array.from(selection.selectedRowIds)
                            if (window.confirm(`Xoa ${ids.length} phieu thu chi da chon?`)) {
                              bulkDeleteTransactions.mutate(ids)
                            }
                          }}
                          disabled={bulkDeleteTransactions.isPending}
                          className="inline-flex h-8 items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-3 text-xs font-semibold text-error transition-colors hover:bg-error/20 disabled:opacity-50"
                        >
                          <Trash2 size={13} /> Xoa
                        </button>
                      ) : (
                        <div className="px-4 text-sm text-foreground-muted">Chon thao tac hang loat</div>
                      )}
                    </DataListBulkBar>
                  ) : null
                }
              >
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    onClick={() => handleOpenTransaction(transaction)}
                    className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-background-secondary/40"
                  >
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <TableCheckbox
                        checked={selection.selectedRowIds.has(transaction.id)}
                        onCheckedChange={() => selection.toggleRowSelection(transaction.id)}
                      />
                    </td>

                    {orderedVisibleColumns.map((columnId) => {
                      const colDef = COLUMN_OPTIONS.find((c) => c.id === columnId)
                      return (
                        <td key={`${transaction.id}:${columnId}`} className={`px-3 py-3 align-top text-sm text-foreground ${colDef?.align === 'right' ? 'text-right' : colDef?.align === 'center' ? 'text-center' : ''}`}>
                          {columnId === 'voucher' ? (
                            <a
                              href={buildFinanceVoucherHref(transaction.voucherNumber)}
                              onClick={(event) => {
                                event.preventDefault()
                                handleOpenTransaction(transaction)
                                event.stopPropagation()
                              }}
                              className="inline-flex font-semibold text-foreground transition-colors hover:text-primary-300"
                            >
                              {transaction.voucherNumber}
                            </a>
                          ) : null}
                          {columnId === 'tags' ? (
                            <div className="flex flex-wrap gap-1">
                              {transaction.attachmentUrl && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                                  <Paperclip size={10} /> Đính kèm
                                </span>
                              )}
                              {extractTraceTags(transaction).length > 0 ? (
                                <>
                                  {extractTraceTags(transaction).slice(0, 2).map((tag) => (
                                    <span key={tag} className="inline-flex rounded-full border border-primary-500/20 bg-primary-500/10 px-2 py-0.5 text-[11px] font-medium text-primary-300">
                                      {tag}
                                    </span>
                                  ))}
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          {columnId === 'date' ? (
                            <div>{new Date(transaction.date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                          ) : null}
                          {columnId === 'createdAt' ? (
                            <div className="text-foreground-muted">{new Date(transaction.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                          ) : null}
                          {columnId === 'updatedAt' ? (
                            <div className="text-foreground-muted">{new Date(transaction.updatedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                          ) : null}
                          {columnId === 'type' ? <TransactionBadge type={transaction.type} /> : null}
                          {columnId === 'payer' ? (
                            <span className="font-medium">{transaction.payerName || 'Khách lẻ / Nội bộ'}</span>
                          ) : null}
                          {columnId === 'creator' ? (
                            <span className="text-foreground-muted">{transaction.createdBy?.name || '-'}</span>
                          ) : null}
                          {columnId === 'branch' ? (
                            <span className="text-foreground-muted">{transaction.branchName || 'Toàn hệ thống'}</span>
                          ) : null}
                          {columnId === 'paymentMethod' ? <span>{transaction.paymentAccountLabel || transaction.paymentMethod || '-'}</span> : null}
                          {columnId === 'amount' ? (
                            <span className={transaction.type === 'INCOME' ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                              {transaction.type === 'INCOME' ? '+' : '-'}
                              {formatCurrency(transaction.amount)}
                            </span>
                          ) : null}
                          {columnId === 'category' ? (
                            <span className="text-foreground">{transaction.category || '-'}</span>
                          ) : null}
                          {columnId === 'description' ? (
                            <div className="max-w-[250px] truncate text-foreground/80" title={transaction.description}>
                              {transaction.description || '-'}
                            </div>
                          ) : null}
                          {columnId === 'ref' ? (
                            transaction.refType === 'ORDER' && transaction.refId ? (
                              <Link
                                href={`/orders/${transaction.refId}`}
                                onClick={(e: any) => e.stopPropagation()}
                                className="text-primary-400 transition-colors hover:text-primary-300"
                              >
                                {transaction.refNumber || transaction.refId}
                              </Link>
                            ) : transaction.refType === 'STOCK_RECEIPT' && transaction.refId ? (
                              <Link
                                href={`/inventory/receipts/${transaction.refId}`}
                                onClick={(e: any) => e.stopPropagation()}
                                className="text-primary-400 transition-colors hover:text-primary-300"
                              >
                                {transaction.refNumber || transaction.refId}
                              </Link>
                            ) : (
                              <span>{transaction.refNumber || transaction.refType || '-'}</span>
                            )
                          ) : null}
                          {columnId === 'notes' ? (
                            <div className="max-w-[200px] truncate text-foreground-muted" title={transaction.notes ?? ''}>
                              {transaction.notes || '-'}
                            </div>
                          ) : null}
                          {columnId === 'source' ? <SourceBadge source={transaction.source} /> : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </DataListTable>

              <DataListPagination
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                total={total}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                totalItemText={
                  <>
                    Hiển thị <strong className="px-1 text-foreground">{total}</strong> giao dịch.
                  </>
                }
              />
            </DataListShell>
          </>
        ) : null}
      </div>

      {transactionWindow ? (
        <CreateTransactionModal
          branches={branchesQuery.data ?? []}
          mode={transactionWindow.mode}
          transaction={transactionWindow.transaction}
          initialType={transactionWindow.initialType}
          onClose={closeTransactionWindow}
          onDeleteRequest={() => {
            if (!transactionWindow.transaction) return
            handleDeleteClick(transactionWindow.transaction)
          }}
          onEditRequest={() => {
            if (!transactionWindow.transaction) return
            setTransactionWindow({ mode: 'edit', transaction: transactionWindow.transaction })
          }}
          onOpenCompare={handleOpenCompare}
          onSaved={handleSavedTransaction}
        />
      ) : null}
      <FinanceReceiptReconciliationModal transaction={compareTransaction} onClose={() => setCompareTransaction(null)} />
    </>
  )
}
