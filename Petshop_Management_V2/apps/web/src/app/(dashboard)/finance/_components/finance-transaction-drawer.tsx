'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, ReceiptText, X } from 'lucide-react'
import type { FinanceTransaction } from '@/lib/api/finance.api'

interface FinanceTransactionDrawerProps {
  transaction: FinanceTransaction | null
  onClose: () => void
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN')
}

function parseTraceTags(tags?: string | null) {
  return (tags ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== 'POS_ORDER' && item !== 'FINANCE_DEMO')
}

export function FinanceTransactionDrawer({ transaction, onClose }: FinanceTransactionDrawerProps) {
  const traceTags = parseTraceTags(transaction?.tags)

  return (
    <AnimatePresence>
      {transaction ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l border-white/10 bg-background-base shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary-500/10 p-2 text-primary-400">
                  <ReceiptText size={18} />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Chi tiết giao dịch</p>
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

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card/80 p-4">
                  <p className="text-xs uppercase tracking-wide text-foreground-muted">Số tiền</p>
                  <p className={`mt-2 text-xl font-semibold ${transaction.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {transaction.type === 'INCOME' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 p-4">
                  <p className="text-xs uppercase tracking-wide text-foreground-muted">Nguồn</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{transaction.source}</p>
                  <p className="mt-1 text-xs text-foreground-muted">{transaction.type === 'INCOME' ? 'Phiếu thu' : 'Phiếu chi'}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-sm font-semibold text-foreground">Thông tin cơ bản</p>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-foreground-muted">Ngày giao dịch</p>
                    <p className="mt-1 text-foreground">{formatDateTime(transaction.date)}</p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Ngày tạo</p>
                    <p className="mt-1 text-foreground">{formatDateTime(transaction.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Hình thức</p>
                    <p className="mt-1 text-foreground">{transaction.paymentMethod || '-'}</p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Người nộp/nhận</p>
                    <p className="mt-1 text-foreground">{transaction.payerName || 'Khách lẻ / Nội bộ'}</p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Chi nhánh</p>
                    <p className="mt-1 text-foreground">{transaction.branchName || transaction.branchId || 'Toàn hệ thống'}</p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Người tạo</p>
                    <p className="mt-1 text-foreground">{transaction.createdBy?.name || 'Hệ thống'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-sm font-semibold text-foreground">Mô tả và tham chiếu</p>
                <div>
                  <p className="text-foreground-muted">Mô tả</p>
                  <p className="mt-1 text-sm text-foreground">{transaction.description}</p>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-foreground-muted">Loại tham chiếu</p>
                    <p className="mt-1 text-foreground">{transaction.refType || '-'}</p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Mã tham chiếu</p>
                    <p className="mt-1 text-foreground">{transaction.refNumber || transaction.refId || '-'}</p>
                  </div>
                </div>
                {transaction.refType === 'ORDER' && transaction.refId ? (
                  <Link
                    href={`/orders/${transaction.refId}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary-400 transition-colors hover:text-primary-300"
                  >
                    Mở đơn hàng liên quan
                    <ExternalLink size={14} />
                  </Link>
                ) : null}
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-sm font-semibold text-foreground">POS Trace</p>
                {traceTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {traceTags.map((tag) => (
                      <span key={tag} className="inline-flex rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground-muted">Không có trace domain từ POS cho giao dịch này.</p>
                )}

                <div>
                  <p className="text-foreground-muted">Ghi chú</p>
                  <p className="mt-1 text-sm text-foreground">{transaction.notes || 'Không có ghi chú'}</p>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
