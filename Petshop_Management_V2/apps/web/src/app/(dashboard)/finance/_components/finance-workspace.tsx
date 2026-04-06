'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Landmark, PenSquare, Pin, PinOff, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageLayout'
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
} from '@/components/data-list'
import { financeApi, type FinanceTransaction } from '@/lib/api/finance.api'
import { settingsApi } from '@/lib/api'
import { toast } from 'sonner'
import { FinanceTransactionDrawer } from './finance-transaction-drawer'
import { CreateTransactionModal } from './create-transaction-modal'

type DisplayColumnId = 'voucher' | 'date' | 'type' | 'payer' | 'paymentMethod' | 'amount' | 'ref' | 'source'
type PinFilterId = 'type' | 'branch' | 'paymentMethod'

const COLUMN_OPTIONS: Array<{ id: DisplayColumnId; label: string; width?: string; minWidth?: string }> = [
  { id: 'voucher', label: 'Phiếu', minWidth: 'min-w-[160px]' },
  { id: 'date', label: 'Ngày', width: 'w-36' },
  { id: 'type', label: 'Loại', width: 'w-28' },
  { id: 'payer', label: 'Người nộp/nhận', minWidth: 'min-w-[220px]' },
  { id: 'paymentMethod', label: 'Thanh toán', width: 'w-32' },
  { id: 'amount', label: 'Số tiền', width: 'w-36' },
  { id: 'ref', label: 'Tham chiếu', minWidth: 'min-w-[180px]' },
  { id: 'source', label: 'Nguồn', width: 'w-32' },
]

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-01`
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN')
}

function TransactionBadge({ type }: { type: string }) {
  const className =
    type === 'INCOME'
      ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
      : 'bg-rose-500/12 text-rose-400 border-rose-500/20'

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{type === 'INCOME' ? 'Thu' : 'Chi'}</span>
}

function SourceBadge({ source }: { source: string }) {
  const palette: Record<string, string> = {
    MANUAL: 'bg-sky-500/12 text-sky-300 border-sky-500/20',
    ORDER_PAYMENT: 'bg-amber-500/12 text-amber-300 border-amber-500/20',
    STOCK_RECEIPT: 'bg-violet-500/12 text-violet-300 border-violet-500/20',
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${palette[source] ?? 'bg-white/5 text-foreground-muted border-border'}`}>
      {source}
    </span>
  )
}

export function FinanceWorkspace() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [type, setType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [branchId, setBranchId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth())
  const [dateTo, setDateTo] = useState(todayString())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<FinanceTransaction | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceTransaction | null>(null)

  const dataListState = useDataListCore<DisplayColumnId, PinFilterId>({
    initialColumnOrder: COLUMN_OPTIONS.map((column) => column.id),
    initialVisibleColumns: ['voucher', 'date', 'type', 'payer', 'paymentMethod', 'amount', 'ref', 'source'],
    initialTopFilterVisibility: { type: true, branch: true, paymentMethod: true },
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
    },
    onError: () => {
      toast.error('Không thể xóa phiếu thu chi')
    },
  })

  const financeData = financeQuery.data
  const transactions = useMemo(() => financeData?.transactions ?? [], [financeData?.transactions])
  const meta = financeData?.meta
  const total = financeData?.total ?? 0
  const totalPages = financeData?.totalPages ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, rangeStart + transactions.length - 1)

  const rowIds = useMemo(() => transactions.map((transaction: FinanceTransaction) => transaction.id), [transactions])
  const selection = useDataListSelection(rowIds)

  const visibleColumnsForTable = orderedVisibleColumns.map((columnId) => COLUMN_OPTIONS.find((column) => column.id === columnId)!).filter(Boolean)

  const clearFilters = () => {
    setSearch('')
    setType('ALL')
    setBranchId('')
    setPaymentMethod('')
    setDateFrom(firstDayOfMonth())
    setDateTo(todayString())
    setPage(1)
  }

  const handleCreateClick = () => {
    setEditingTransaction(null)
    setShowCreateModal(true)
  }

  const handleCloseModal = () => {
    setEditingTransaction(null)
    setShowCreateModal(false)
  }

  const handleEditClick = (transaction: FinanceTransaction) => {
    setEditingTransaction(transaction)
    setShowCreateModal(true)
  }

  const handleDeleteClick = (transaction: FinanceTransaction) => {
    if (!transaction.isManual || deleteTransaction.isPending) {
      return
    }

    const confirmed = window.confirm(`Xóa phiếu ${transaction.voucherNumber}?`)
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

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PageHeader
          title="Sổ quỹ"
          description="Theo dõi thu chi, số dư đầu kỳ và dòng tiền phát sinh theo thời gian thực."
          icon={Landmark}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => financeQuery.refetch()}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-background-secondary px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/60"
              >
                <RefreshCw size={16} />
                Làm mới
              </button>
              <button
                type="button"
                onClick={handleCreateClick}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
              >
                <Plus size={16} />
                Tạo phiếu
              </button>
            </div>
          }
        />

        <div className="grid shrink-0 gap-3 lg:grid-cols-4">
          {[
            { label: 'Số dư đầu kỳ', value: financeData?.openingBalance ?? 0 },
            { label: 'Tổng thu', value: financeData?.totalIncome ?? 0, tone: 'text-emerald-400' },
            { label: 'Tổng chi', value: financeData?.totalExpense ?? 0, tone: 'text-rose-400' },
            { label: 'Tồn cuối kỳ', value: financeData?.closingBalance ?? 0, tone: 'text-primary-400' },
          ].map((card: { label: string; value: number; tone?: string }) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm">
              <p className="text-sm text-foreground-muted">{card.label}</p>
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
            }}            searchPlaceholder="Tìm mã phiếu, tham chiếu, tên người nộp/nhận..."
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
                    {(meta?.branches ?? []).map((branch: { id: string; name: string }) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {topFilterVisibility.paymentMethod ? (
                  <select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPage(1) }} className={toolbarSelectClass}>
                    <option value="">Mọi hình thức</option>
                    {(meta?.paymentMethods ?? []).map((method: string) => (
                      <option key={method} value={method}>
                        {method}
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
                {(meta?.branches ?? []).map((branch: { id: string; name: string }) => (
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
                {(meta?.paymentMethods ?? []).map((method: string) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-foreground-muted">Khoảng ngày</span>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className={filterInputClass} />
                <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className={filterInputClass} />
              </div>
            </label>
          </DataListFilterPanel>

          <div className="shrink-0 px-1 text-xs text-foreground-muted">
            Hiển thị <strong className="text-foreground">{total}</strong> giao dịch.
          </div>

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
                  <div className="px-4 text-sm text-foreground-muted">Tính năng xuất/nhập hàng loạt dữ liệu sẽ được hỗ trợ trong thời gian tới.</div>
                </DataListBulkBar>
              ) : null
            }
          >
            {transactions.map((transaction: FinanceTransaction) => (
              <tr key={transaction.id} className="border-b border-border/70 last:border-0 hover:bg-background-secondary/40">
                <td className="px-4 py-3">
                  <TableCheckbox
                    checked={selection.selectedRowIds.has(transaction.id)}
                    onCheckedChange={() => selection.toggleRowSelection(transaction.id)}
                  />
                </td>

                {orderedVisibleColumns.map((columnId) => (
                  <td key={`${transaction.id}:${columnId}`} className="px-3 py-3 align-top text-sm text-foreground">
                    {columnId === 'voucher' ? (
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold text-foreground">{transaction.voucherNumber}</div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedTransaction(transaction)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:border-primary-500/60 hover:text-foreground"
                              aria-label={`Xem chi tiết ${transaction.voucherNumber}`}
                            >
                              <Eye size={14} />
                            </button>
                            {transaction.isManual ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(transaction)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:border-primary-500/60 hover:text-foreground"
                                  aria-label={`Chỉnh sửa ${transaction.voucherNumber}`}
                                >
                                  <PenSquare size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(transaction)}
                                  disabled={deleteTransaction.isPending}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:border-rose-500/60 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label={`Xóa ${transaction.voucherNumber}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {transaction.isManual ? <div className="text-xs text-sky-300">Manual</div> : <div className="text-xs text-foreground-muted">System</div>}
                        {extractTraceTags(transaction).length > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {extractTraceTags(transaction).slice(0, 2).map((tag) => (
                              <span key={tag} className="inline-flex rounded-full border border-primary-500/20 bg-primary-500/10 px-2 py-0.5 text-[11px] font-medium text-primary-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {columnId === 'date' ? (
                      <div className="space-y-1">
                        <div>{formatDate(transaction.date)}</div>
                        <div className="text-xs text-foreground-muted">{new Date(transaction.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    ) : null}
                    {columnId === 'type' ? <TransactionBadge type={transaction.type} /> : null}
                    {columnId === 'payer' ? (
                      <div className="space-y-1">
                        <div className="font-medium">{transaction.payerName || 'Khách lẻ / Nội bộ'}</div>
                        {transaction.createdBy ? <div className="text-xs text-foreground-muted">Tạo bởi {transaction.createdBy.name}</div> : null}
                      </div>
                    ) : null}
                    {columnId === 'paymentMethod' ? <span>{transaction.paymentMethod || '-'}</span> : null}
                    {columnId === 'amount' ? (
                      <span className={transaction.type === 'INCOME' ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>
                        {transaction.type === 'INCOME' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </span>
                    ) : null}
                    {columnId === 'ref' ? (
                      transaction.refType === 'ORDER' && transaction.refId ? (
                        <Link href={`/orders/${transaction.refId}`} className="text-primary-400 transition-colors hover:text-primary-300">
                          {transaction.refNumber || transaction.refId}
                        </Link>
                      ) : (
                        <span>{transaction.refNumber || transaction.refType || '-'}</span>
                      )
                    ) : null}
                    {columnId === 'source' ? <SourceBadge source={transaction.source} /> : null}
                  </td>
                ))}
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
          />
        </DataListShell>
      </div>

      {showCreateModal ? (
        <CreateTransactionModal
          branches={branchesQuery.data ?? []}
          transaction={editingTransaction}
          onClose={handleCloseModal}
        />
      ) : null}

      <FinanceTransactionDrawer transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
    </>
  )
}
