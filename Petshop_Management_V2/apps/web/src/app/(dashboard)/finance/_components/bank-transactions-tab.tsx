'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { settingsApi, type BankTransactionInboxItem } from '@/lib/api/settings.api'

function formatDateTime(value: string | null) {
  if (!value) return 'Chưa có'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function formatCurrency(value: number) {
  return value.toLocaleString('vi-VN')
}

function getDirectionLabel(direction: string) {
  return direction === 'OUT' ? 'Chi' : 'Thu'
}

function getBankTransactionStatusMeta(transaction: BankTransactionInboxItem) {
  switch (transaction.status) {
    case 'APPLIED':
    case 'SUGGESTED':
    case 'IGNORED':
      return {
        label: 'Đã khớp',
        className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
      }
    case 'REVIEW':
      return {
        label: 'Không thấy khớp',
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      }
    case 'DUPLICATE':
      return {
        label: 'Trùng webhook',
        className: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
      }
    case 'REJECTED':
      return {
        label: 'Lỗi xử lý',
        className: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
      }
    default:
      return {
        label: 'Đã nhận',
        className: 'border-border/60 bg-background-secondary text-foreground',
      }
  }
}

type Props = {
  canManagePayment: boolean
}

export function BankTransactionsTab({ canManagePayment }: Props) {
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<'all' | 'real' | 'test'>('all')
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')

  const bankTransactionsQuery = useQuery({
    queryKey: ['settings', 'bank-transactions', scope, status, search],
    queryFn: () => settingsApi.getBankTransactions({ scope, status, search: search.trim() || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteBankTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'bank-transactions'] })
      toast.success('Đã xoá dữ liệu test webhook')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? error?.message ?? 'Không thể xoá dữ liệu test webhook')
    },
  })

  const records = useMemo(() => bankTransactionsQuery.data ?? [], [bankTransactionsQuery.data])
  const summary = useMemo(
    () => ({
      total: records.length,
      real: records.filter((item) => !item.isTest).length,
      test: records.filter((item) => item.isTest).length,
    }),
    [records],
  )

  const handleDelete = (transaction: BankTransactionInboxItem) => {
    if (!transaction.isTest || !canManagePayment || deleteMutation.isPending) return
    const confirmed = window.confirm(`Xoá dữ liệu test ${transaction.id}?`)
    if (!confirmed) return
    deleteMutation.mutate(transaction.id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid shrink-0 gap-3 md:grid-cols-3">
        {[
          { label: 'Tổng giao dịch nhận', value: summary.total },
          { label: 'Giao dịch thật', value: summary.real },
          { label: 'Giao dịch test', value: summary.test },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-foreground-muted">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Lịch sử chuyển khoản</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm nội dung, số TK, mã đơn, intent..."
              className="h-11 rounded-xl border border-border/60 bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
            />
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as 'all' | 'real' | 'test')}
              className="h-11 rounded-xl border border-border/60 bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
            >
              <option value="all">Tất cả</option>
              <option value="real">Thật</option>
              <option value="test">Test</option>
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-xl border border-border/60 bg-background-secondary px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="RECEIVED">Đã nhận</option>
              <option value="SUGGESTED">Đã khớp</option>
              <option value="APPLIED">Đã khớp</option>
              <option value="REVIEW">Không thấy khớp</option>
              <option value="DUPLICATE">Trùng webhook</option>
              <option value="IGNORED">Đã khớp</option>
              <option value="REJECTED">Lỗi xử lý</option>
            </select>
          </div>
        </div>

        {bankTransactionsQuery.isError ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {(bankTransactionsQuery.error as any)?.response?.data?.message
              ?? (bankTransactionsQuery.error as any)?.message
              ?? 'Không tải được lịch sử chuyển khoản.'}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-border/70">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/70">
              <thead className="bg-background-secondary">
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-foreground-muted">
                  <th className="px-4 py-3">Nguồn</th>
                  <th className="px-4 py-3">Số tiền</th>
                  <th className="px-4 py-3">Tài khoản</th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3">Đối soát</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 bg-card text-sm">
                {bankTransactionsQuery.isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-foreground-muted">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Đang tải giao dịch ngân hàng...
                      </span>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-foreground-muted">
                      Chưa có giao dịch nào phù hợp bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  records.map((transaction) => {
                    const statusMeta = getBankTransactionStatusMeta(transaction)
                    return (
                    <tr key={transaction.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${transaction.isTest ? 'border-sky-500/25 bg-sky-500/10 text-sky-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'}`}>
                              {transaction.isTest ? 'TEST' : 'REAL'}
                            </span>
                            <span className="font-mono text-xs text-foreground">{transaction.provider}</span>
                          </div>
                          <div className="text-xs text-foreground-muted">Nhận {transaction.sourceCount} lần</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{formatCurrency(transaction.amount)} {transaction.currency}</div>
                        <div className="text-xs text-foreground-muted">{getDirectionLabel(transaction.direction)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-foreground">{transaction.accountNumber}</div>
                        <div className="text-xs text-foreground-muted">BIN {transaction.bankBin ?? '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[360px] whitespace-normal break-words text-foreground">{transaction.description}</div>
                        <div className="mt-1 font-mono text-xs text-foreground-muted">{transaction.normalizedDescription}</div>
                      </td>
                      <td className="px-4 py-3">
                        {transaction.matchedPaymentIntent ? (
                          <div className="space-y-1">
                            <div className="font-mono text-foreground">{transaction.matchedPaymentIntent.code}</div>
                            {transaction.matchedPaymentIntent.orderId ? (
                              <Link
                                href={`/orders/${transaction.matchedPaymentIntent.orderId}`}
                                className="text-xs text-primary-300 transition-colors hover:text-primary-200"
                              >
                                {transaction.matchedPaymentIntent.orderNumber ?? transaction.matchedPaymentIntent.orderId}
                              </Link>
                            ) : (
                              <div className="text-xs text-foreground-muted">{transaction.matchedPaymentIntent.orderNumber ?? 'Không có đơn'}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-foreground-muted">Không thấy khớp đơn hàng</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                          <span className="text-xs text-foreground-muted">{transaction.note ?? transaction.classification}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground-muted">
                        <div>Txn: {formatDateTime(transaction.txnAt)}</div>
                        <div className="mt-1">Tạo: {formatDateTime(transaction.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {transaction.isTest && canManagePayment ? (
                          <button
                            type="button"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(transaction)}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Xóa test"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
