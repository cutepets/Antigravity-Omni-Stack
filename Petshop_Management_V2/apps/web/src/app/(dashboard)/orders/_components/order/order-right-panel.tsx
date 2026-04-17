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
  paymentIntents?: any[]
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
            Lịch sử
          </div>
          {orderStatus ? <OrderStatusBadge status={orderStatus} /> : null}
        </div>

        {timeline.length > 0 ? (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />
            <div className="space-y-0">
              {timeline.map((entry: any) => {
                const actorName = entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? null
                // Gộp ghi chú nhưng bỏ dòng "Xuất kho lúc..." vì timestamp đã hiện ở trên
                const rawNote: string = entry.note ?? ''
                const cleanNote = rawNote
                  .split(' · ')
                  .filter((part) => !part.startsWith('Xuất kho lúc'))
                  .join(' · ')
                  .trim()

                return (
                  <div key={entry.id} className="relative grid grid-cols-[16px_1fr] gap-x-3 pb-4 last:pb-0">
                    {/* Dot */}
                    <div className="flex justify-center pt-[5px]">
                      <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-primary-500 ring-2 ring-background-secondary" />
                    </div>

                    {/* Content — compact 2 dòng */}
                    <div>
                      {/* Dòng 1: Tên hành động + NV + thời gian */}
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground leading-snug">
                          {ORDER_ACTION_LABELS[entry.action] ?? entry.action}
                          {actorName ? (
                            <span className="ml-1.5 text-xs font-normal text-foreground-muted">{actorName}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-[11px] text-foreground-muted tabular-nums">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>

                      {/* Dòng 2: note súc tích (nếu có) */}
                      {cleanNote ? (
                        <div className="mt-0.5 text-xs text-foreground-muted leading-relaxed">
                          {cleanNote}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-foreground-muted">
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
  paymentIntents = [],
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

          {paymentIntents && paymentIntents.length > 0 ? (
            <div className="flex flex-col items-end gap-1">
              {paymentIntents
                .filter((intent: any) => intent.status === 'PAID')
                .map((intent: any, idx: number) => (
                  <div key={intent.id || idx} className="flex items-center gap-2 text-[13px] text-foreground-muted">
                    <span>{intent.paymentMethod?.name || 'Khác'}</span>
                    <span className="tabular-nums">- {formatCurrency(intent.amount)}</span>
                  </div>
                ))}
            </div>
          ) : null}

          <div className="mt-1 flex items-center justify-between pt-1">
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
