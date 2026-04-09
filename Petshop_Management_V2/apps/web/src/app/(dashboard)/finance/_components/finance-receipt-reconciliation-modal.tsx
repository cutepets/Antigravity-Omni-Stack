'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightLeft, ExternalLink, FileText, ReceiptText, X } from 'lucide-react'
import dayjs from 'dayjs'
import { stockApi } from '@/lib/api/stock.api'
import type { FinanceTransaction } from '@/lib/api/finance.api'

interface FinanceReceiptReconciliationModalProps {
  transaction: FinanceTransaction | null
  onClose: () => void
}

function formatCurrency(value: number | null | undefined) {
  return `${Math.round(Number(value ?? 0)).toLocaleString('vi-VN')}đ`
}

function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-'
}

function ReconcileMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background-secondary/60 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</div>
      <div className="mt-2 text-lg font-bold text-foreground">{value}</div>
      {hint ? <div className="mt-1 text-xs text-foreground-muted">{hint}</div> : null}
    </div>
  )
}

export function FinanceReceiptReconciliationModal({ transaction, onClose }: FinanceReceiptReconciliationModalProps) {
  const receiptRef = transaction?.refNumber || transaction?.refId
  const linkedReceiptQuery = useQuery({
    queryKey: ['finance', 'linked-receipt', receiptRef],
    queryFn: async () => {
      if (!receiptRef) return null
      const response = await stockApi.getReceipt(receiptRef)
      return response.data?.data ?? null
    },
    enabled: transaction?.refType === 'STOCK_RECEIPT' && Boolean(receiptRef),
  })

  const receipt = linkedReceiptQuery.data

  const receiptPayments = useMemo(() => {
    const allocations = Array.isArray(receipt?.paymentAllocations) ? receipt.paymentAllocations : []
    return allocations
      .map((allocation: any) => ({
        id: allocation.id,
        amount: Number(allocation.amount ?? 0),
        paymentNumber: allocation.payment?.paymentNumber ?? allocation.payment?.transactionId ?? allocation.id,
        paymentMethod: allocation.payment?.paymentMethod ?? 'BANK',
        paidAt: allocation.payment?.paidAt ?? null,
        notes: allocation.payment?.notes ?? null,
      }))
      .sort((left: any, right: any) => new Date(right.paidAt ?? 0).getTime() - new Date(left.paidAt ?? 0).getTime())
  }, [receipt?.paymentAllocations])

  return (
    <AnimatePresence>
      {transaction ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed inset-4 z-[70] overflow-hidden rounded-[28px] border border-border bg-background-base shadow-2xl"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary-500/10 p-2 text-primary-400">
                    <ArrowRightLeft size={18} />
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Đối chiếu chứng từ</p>
                    <h2 className="text-lg font-semibold text-foreground">{transaction.voucherNumber}</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground-muted transition-colors hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="space-y-4 rounded-[24px] border border-border bg-card/95 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ReceiptText size={16} className="text-primary-500" />
                      Phiếu thu chi trên sổ quỹ
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <ReconcileMetric label="Số phiếu" value={transaction.voucherNumber} />
                      <ReconcileMetric label="Số tiền" value={formatCurrency(transaction.amount)} hint={transaction.type === 'INCOME' ? 'Phiếu thu' : 'Phiếu chi'} />
                      <ReconcileMetric label="Ngày giao dịch" value={formatDateTime(transaction.date)} />
                      <ReconcileMetric label="Hình thức" value={transaction.paymentMethod || '-'} />
                    </div>

                    <div className="rounded-2xl border border-border bg-background-secondary/60 p-4 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-foreground-muted">Loại tham chiếu</div>
                          <div className="mt-1 font-medium text-foreground">{transaction.refType || '-'}</div>
                        </div>
                        <div>
                          <div className="text-foreground-muted">Mã tham chiếu</div>
                          <div className="mt-1 font-medium text-foreground">{transaction.refNumber || transaction.refId || '-'}</div>
                        </div>
                        <div>
                          <div className="text-foreground-muted">Người nộp/nhận</div>
                          <div className="mt-1 font-medium text-foreground">{transaction.payerName || 'Nội bộ'}</div>
                        </div>
                        <div>
                          <div className="text-foreground-muted">Chi nhánh</div>
                          <div className="mt-1 font-medium text-foreground">{transaction.branchName || transaction.branchId || 'Toàn hệ thống'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background-secondary/60 p-4 text-sm">
                      <div className="text-foreground-muted">Mô tả</div>
                      <div className="mt-1 text-foreground">{transaction.description}</div>
                      <div className="mt-4 text-foreground-muted">Ghi chú</div>
                      <div className="mt-1 text-foreground">{transaction.notes || 'Không có ghi chú'}</div>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-[24px] border border-border bg-card/95 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText size={16} className="text-emerald-400" />
                        Phiếu nhập liên kết
                      </div>
                      {transaction.refType === 'STOCK_RECEIPT' && receiptRef ? (
                        <Link
                          href={`/inventory/receipts/${receiptRef}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground-muted transition-colors hover:border-primary-500/60 hover:text-foreground"
                        >
                          Mở phiếu nhập
                          <ExternalLink size={13} />
                        </Link>
                      ) : null}
                    </div>

                    {linkedReceiptQuery.isLoading ? (
                      <div className="rounded-2xl border border-border bg-background-secondary/60 p-4 text-sm text-foreground-muted">
                        Đang tải phiếu nhập liên kết...
                      </div>
                    ) : receipt ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ReconcileMetric label="Số phiếu nhập" value={receipt.receiptNumber} />
                          <ReconcileMetric label="Nhà cung cấp" value={receipt.supplier?.name || '-'} />
                          <ReconcileMetric label="Giá trị nhận" value={formatCurrency(receipt.totalReceivedAmount ?? receipt.totalAmount)} />
                          <ReconcileMetric label="Còn nợ" value={formatCurrency(receipt.debtAmount)} />
                        </div>

                        <div className="rounded-2xl border border-border bg-background-secondary/60 p-4 text-sm">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-foreground-muted">Trạng thái nhập</div>
                              <div className="mt-1 font-medium text-foreground">{receipt.receiptStatus || receipt.status || '-'}</div>
                            </div>
                            <div>
                              <div className="text-foreground-muted">Trạng thái thanh toán</div>
                              <div className="mt-1 font-medium text-foreground">{receipt.paymentStatus || '-'}</div>
                            </div>
                            <div>
                              <div className="text-foreground-muted">Tạo đơn</div>
                              <div className="mt-1 font-medium text-foreground">{formatDateTime(receipt.createdAt)}</div>
                            </div>
                            <div>
                              <div className="text-foreground-muted">Nhập gần nhất</div>
                              <div className="mt-1 font-medium text-foreground">{formatDateTime(receipt.receivedAt)}</div>
                            </div>
                            <div>
                              <div className="text-foreground-muted">Thanh toán gần nhất</div>
                              <div className="mt-1 font-medium text-foreground">{formatDateTime(receipt.paymentDate)}</div>
                            </div>
                            <div>
                              <div className="text-foreground-muted">Hoàn tất</div>
                              <div className="mt-1 font-medium text-foreground">{formatDateTime(receipt.completedAt)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background-secondary/60 p-4">
                          <div className="text-sm font-semibold text-foreground">Lịch sử thanh toán liên kết</div>
                          <div className="mt-3 space-y-2">
                            {receiptPayments.length > 0 ? (
                              receiptPayments.map((payment: any) => (
                                <div key={payment.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background-base px-3 py-2 text-sm">
                                  <div>
                                    <div className="font-medium text-foreground">{payment.paymentNumber}</div>
                                    <div className="text-xs text-foreground-muted">
                                      {formatDateTime(payment.paidAt)} • {payment.paymentMethod}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-rose-400">{formatCurrency(payment.amount)}</div>
                                    {payment.notes ? <div className="text-xs text-foreground-muted">{payment.notes}</div> : null}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-foreground-muted">Chưa có dòng thanh toán liên kết.</div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-border bg-background-secondary/60 p-4 text-sm text-foreground-muted">
                        Giao dịch này chưa gắn với phiếu nhập NCC hoặc không có dữ liệu liên kết để đối chiếu.
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
