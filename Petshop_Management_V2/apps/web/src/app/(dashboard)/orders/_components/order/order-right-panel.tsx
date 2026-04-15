'use client'

import { Calendar, MessageSquare } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { PaymentStatusBadge, OrderStatusBadge } from './order-badges'
import { ORDER_ACTION_LABELS } from './order.constants'
import type { OrderWorkspaceMode } from './order.types'

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
  itemsCount: number
  orderStatus?: string
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
          <div className="mt-4 space-y-4">
            {timeline.map((entry: any, index: number) => {
              const actorName =
                entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? 'Chưa xác định'

              return (
                <div key={entry.id} className="grid grid-cols-[18px_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-500" />
                    {index < timeline.length - 1 ? <span className="mt-1 h-full w-px bg-border" /> : null}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-primary-400">
                        {ORDER_ACTION_LABELS[entry.action] ?? entry.action}
                      </div>
                      <div className="whitespace-nowrap text-[11px] text-foreground-muted">
                        {formatDateTime(entry.createdAt)}
                      </div>
                    </div>

                    <div className="mt-1 text-sm text-foreground">
                      {actorName}
                    </div>

                    {entry.note ? (
                      <div className="mt-1 text-xs text-foreground-muted">{entry.note}</div>
                    ) : null}

                    {entry.fromStatus || entry.toStatus ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {entry.fromStatus ? <OrderStatusBadge status={entry.fromStatus} /> : null}
                        {entry.toStatus ? <OrderStatusBadge status={entry.toStatus} /> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
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
  itemsCount,
  orderStatus,
}: OrderRightPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4 space-y-3">
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
        <div className="border-b border-border px-4 py-4 space-y-2.5">
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

      {mode === 'detail' ? <HistorySection timeline={timeline} orderStatus={orderStatus} /> : null}

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
