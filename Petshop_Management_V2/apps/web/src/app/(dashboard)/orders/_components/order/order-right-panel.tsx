'use client'

import { Calendar, ExternalLink, FileText, MessageSquare } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PaymentStatusBadge, OrderStatusBadge } from './order-badges'
import { ORDER_ACTION_LABELS, ORDER_STATUS_LABEL } from './order.constants'
import type { OrderWorkspaceMode } from './order.types'

interface RelatedDocument {
  id: string
  label: string
  href: string
  tone?: string
}

interface OrderRightPanelProps {
  mode: OrderWorkspaceMode
  subtotal: number
  discount: number
  shippingFee: number
  total: number
  isEditing: boolean
  onDiscountChange: (v: string) => void
  onShippingFeeChange: (v: string) => void
  paymentStatus?: string
  amountPaid: number
  remainingAmount: number
  notes: string
  onNotesChange: (v: string) => void
  timeline: any[]
  relatedDocuments: RelatedDocument[]
  itemsCount: number
  orderStatus?: string
}

function buildHistorySummary(entry: any) {
  const actorName =
    entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? 'Chưa xác định'
  const statusLabel =
    entry.fromStatus || entry.toStatus
      ? [
          entry.fromStatus ? ORDER_STATUS_LABEL[entry.fromStatus] ?? entry.fromStatus : null,
          entry.toStatus ? `→ ${ORDER_STATUS_LABEL[entry.toStatus] ?? entry.toStatus}` : null,
        ]
          .filter(Boolean)
          .join(' ')
      : null

  return [actorName, statusLabel, entry.note].filter(Boolean).join(' • ')
}

function getDocumentToneClass(tone?: string) {
  if (tone === 'income') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
  if (tone === 'expense') return 'border-rose-500/20 bg-rose-500/10 text-rose-300'
  if (tone === 'grooming') return 'border-sky-500/20 bg-sky-500/10 text-sky-300'
  if (tone === 'hotel') return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
  return 'border-border bg-background text-foreground'
}

function RelatedDocumentsSection({ relatedDocuments }: { relatedDocuments: RelatedDocument[] }) {
  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl border border-border bg-background-secondary p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
          <FileText size={13} />
          Phiếu liên quan
        </div>

        {relatedDocuments.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {relatedDocuments.map((document) => (
              <a
                key={document.id}
                href={document.href}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:border-primary-500/35 hover:text-primary-500 ${getDocumentToneClass(document.tone)}`}
              >
                <span>{document.label}</span>
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-4 text-sm text-foreground-muted">
            Đơn hàng này chưa có phiếu liên kết.
          </div>
        )}
      </div>
    </div>
  )
}

function HistorySection({ timeline, orderStatus }: { timeline: any[]; orderStatus?: string }) {
  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl border border-border bg-background-secondary p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
            Lịch sử
          </div>
          {orderStatus ? <OrderStatusBadge status={orderStatus} /> : null}
        </div>

        {timeline.length > 0 ? (
          <div className="mt-4 space-y-3">
            {timeline.map((entry: any, index: number) => (
              <div key={entry.id} className="grid grid-cols-[16px_1fr] gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-500" />
                  {index < timeline.length - 1 ? <span className="mt-1 h-full w-px bg-border" /> : null}
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-primary-400">
                      {ORDER_ACTION_LABELS[entry.action] ?? entry.action}
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-[11px] text-foreground-muted">
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-muted">
                    {buildHistorySummary(entry) || 'Không có thêm thông tin'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-foreground-muted">
            Chưa có lịch sử thao tác cho đơn hàng này.
          </div>
        )}
      </div>
    </div>
  )
}

export function OrderRightPanel({
  mode,
  subtotal,
  discount,
  shippingFee,
  total,
  isEditing,
  onDiscountChange,
  onShippingFeeChange,
  paymentStatus,
  amountPaid,
  remainingAmount,
  notes,
  onNotesChange,
  timeline,
  relatedDocuments,
  itemsCount,
  orderStatus,
}: OrderRightPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-foreground-muted">
            Tổng tiền hàng
            {itemsCount > 0 ? (
              <span className="badge badge-primary px-1.5 py-0 text-[10px]">{itemsCount}</span>
            ) : null}
          </span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(subtotal)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-sm text-foreground-muted">Chiết khấu</span>
          {isEditing ? (
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(event) => onDiscountChange(event.target.value)}
              className="h-8 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm text-foreground outline-none transition-colors"
            />
          ) : (
            <span className="text-sm font-semibold text-foreground">{formatCurrency(discount)}</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 text-sm text-foreground-muted">Phí ship</span>
          {isEditing ? (
            <input
              type="number"
              min={0}
              value={shippingFee}
              onChange={(event) => onShippingFeeChange(event.target.value)}
              className="h-8 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm text-foreground outline-none transition-colors"
            />
          ) : (
            <span className="text-sm font-semibold text-foreground">{formatCurrency(shippingFee)}</span>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-background-secondary px-3 py-3">
          <span className="text-base font-semibold text-foreground">Cần thanh toán</span>
          <span className="text-[28px] font-black text-primary-500 tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {mode === 'detail' ? (
        <div className="space-y-2.5 border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground-muted">Trạng thái thanh toán</span>
            <PaymentStatusBadge status={paymentStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground-muted">Đã thu</span>
            <span className="text-sm font-semibold text-success tabular-nums">
              {formatCurrency(amountPaid)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground-muted">Còn lại</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {formatCurrency(remainingAmount)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="border-b border-border px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
          <MessageSquare size={13} />
          Ghi chú
        </div>
        <textarea
          rows={3}
          value={notes}
          disabled={!isEditing && mode === 'detail'}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Ghi chú cho đơn hàng..."
          className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors disabled:cursor-default disabled:bg-background-secondary disabled:text-foreground-muted"
        />
      </div>

      {mode === 'detail' ? (
        <>
          <RelatedDocumentsSection relatedDocuments={relatedDocuments} />
          <HistorySection timeline={timeline} orderStatus={orderStatus} />
        </>
      ) : null}

      {mode !== 'detail' ? (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm text-foreground-muted">
            <Calendar size={16} />
            Lịch sử đơn hàng sẽ hiển thị sau khi đơn được tạo.
          </div>
        </div>
      ) : null}
    </div>
  )
}
