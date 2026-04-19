'use client'

import { Calendar, MessageSquare } from 'lucide-react'
import { getPaymentMethodColorClasses } from '@/lib/payment-methods'
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
  payments?: any[]
  paymentIntents?: any[]
}

function inferPaymentMethodFromLabel(label?: string | null) {
  const normalized = String(label ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized.includes('tien mat') || normalized.includes('tiền mặt') || normalized.includes('cash')) return 'CASH'
  if (normalized.includes('quet the') || normalized.includes('quẹt thẻ') || normalized.includes('the') || normalized.includes('card')) return 'CARD'
  if (
    normalized.includes('vi dien tu') ||
    normalized.includes('ví điện tử') ||
    normalized.includes('wallet') ||
    normalized.includes('momo') ||
    normalized.includes('zalo')
  ) return 'EWALLET'
  if (normalized.includes('ket hop') || normalized.includes('kết hợp') || normalized.includes('mixed')) return 'MIXED'
  if (normalized.includes('cong no') || normalized.includes('công nợ') || normalized.includes('credit')) return 'ORDER_CREDIT'
  return 'BANK'
}

function getPaymentTextClass(method?: string | null, colorKey?: string | null, label?: string | null) {
  const resolvedMethod = (method ?? inferPaymentMethodFromLabel(label) ?? '').trim().toUpperCase()

  switch (resolvedMethod) {
    case 'BANK':
      return getPaymentMethodColorClasses('BANK', colorKey).text
    case 'CARD':
      return getPaymentMethodColorClasses('CARD', colorKey).text
    case 'EWALLET':
      return getPaymentMethodColorClasses('EWALLET', colorKey).text
    case 'CASH':
      return getPaymentMethodColorClasses('CASH', colorKey).text
    case 'MIXED':
      return 'text-amber-500'
    case 'ORDER_CREDIT':
      return 'text-slate-400'
    default:
      return 'text-foreground-secondary'
  }
}

function getPaymentDisplayLabel(method?: string | null, fallbackLabel?: string | null) {
  const resolvedMethod = String(method ?? '').trim().toUpperCase()
  if (resolvedMethod === 'CASH') return 'Tiền mặt'
  if (resolvedMethod === 'BANK') return fallbackLabel?.trim() || 'Chuyển khoản'
  if (resolvedMethod === 'CARD') return 'Quẹt thẻ'
  if (resolvedMethod === 'EWALLET') return fallbackLabel?.trim() || 'Ví điện tử'
  if (resolvedMethod === 'MIXED') return 'Kết hợp'
  if (resolvedMethod === 'ORDER_CREDIT') return 'Công nợ'
  return fallbackLabel?.trim() || method?.trim() || 'Khác'
}

function getPaidPaymentRows(payments: any[] = [], paymentIntents: any[] = []) {
  const normalizedPayments = Array.isArray(payments)
    ? payments
      .filter((payment: any) => Number(payment?.amount) > 0)
      .map((payment: any, index: number) => ({
        id: payment.id ?? `payment-${index}`,
        label: getPaymentDisplayLabel(payment.method, payment.paymentAccountLabel),
        amount: Number(payment.amount) || 0,
        method: payment.method ?? null,
        colorKey: null,
      }))
    : []

  if (normalizedPayments.length > 0) {
    return normalizedPayments
  }

  return paymentIntents
    .filter((intent: any) => intent?.status === 'PAID')
    .map((intent: any) => ({
      id: intent.id,
      label: intent.paymentMethod?.name || 'Khác',
      amount: Number(intent.amount) || 0,
      method: intent.paymentMethod?.type ?? null,
      colorKey: intent.paymentMethod?.colorKey ?? null,
    }))
}

function splitHistoryNote(note?: string | null) {
  return String(note ?? '')
    .split(/\s(?:•|·|â€¢|Â·|Ã‚Â·|Ã¢â‚¬Â¢)\s/g)
    .map((part) => part.trim())
    .filter(Boolean)
}

function isPaymentHistoryAction(action?: string | null) {
  return action === 'PAYMENT_ADDED' || action === 'PAID' || action === 'PAYMENT_CONFIRMED'
}

function getHistoryLink(entry: any) {
  const label = String(entry?.metadata?.historyLink?.label ?? '').trim()
  const href = String(entry?.metadata?.historyLink?.href ?? '').trim()
  if (!label || !href) return null
  return { label, href }
}

function normalizeSearchText(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function shouldHideHistoryPart(part: string) {
  return normalizeSearchText(part).startsWith('xuat kho luc')
}

function renderHistoryNote(entry: any, note: string) {
  if (!note) return null

  const parts = splitHistoryNote(note)
  if (parts.length === 0) return null

  const historyLink = getHistoryLink(entry)
  const paymentLabelIndex = isPaymentHistoryAction(entry?.action)
    ? historyLink && parts[0] === historyLink.label
      ? 1
      : 0
    : -1

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-foreground-muted">
      {parts.map((part, index) => {
        const content = index > 0 ? `• ${part}` : part

        if (historyLink && index === 0 && part === historyLink.label) {
          return (
            <a
              key={`${part}-${index}`}
              href={historyLink.href}
              className="font-semibold text-primary-500 transition-colors hover:text-primary-400"
            >
              {content}
            </a>
          )
        }

        if (index === paymentLabelIndex) {
          return (
            <span
              key={`${part}-${index}`}
              className={`font-medium ${getPaymentTextClass(undefined, null, part)}`}
            >
              {content}
            </span>
          )
        }

        return <span key={`${part}-${index}`}>{content}</span>
      })}
    </div>
  )
}

function HistorySection({ timeline, orderStatus }: { timeline: any[]; orderStatus?: string }) {
  return (
    <div className="min-h-0 flex-1 px-4 py-4">
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-background-secondary p-4">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
            Lịch sử
          </div>
          {orderStatus ? <OrderStatusBadge status={orderStatus} /> : null}
        </div>

        {timeline.length > 0 ? (
          <div className="relative min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-border/60" />
            <div className="space-y-0">
              {timeline.map((entry: any) => {
                const actorName = entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? null
                const cleanNote = splitHistoryNote(String(entry.note ?? ''))
                  .filter((part) => !shouldHideHistoryPart(part))
                  .join(' • ')
                  .trim()

                return (
                  <div key={entry.id} className="relative grid grid-cols-[16px_1fr] gap-x-3 pb-4 last:pb-0">
                    <div className="flex justify-center pt-[5px]">
                      <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-primary-500 ring-2 ring-background-secondary" />
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold leading-snug text-foreground">
                          {ORDER_ACTION_LABELS[entry.action] ?? entry.action}
                          {actorName ? (
                            <span className="ml-1.5 text-xs font-normal text-foreground-muted">{actorName}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-[11px] text-foreground-muted tabular-nums">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>

                      {cleanNote ? renderHistoryNote(entry, cleanNote) : null}
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
  itemsCount,
  orderStatus,
  payments = [],
  paymentIntents = [],
}: OrderRightPanelProps) {
  const paidPaymentRows = getPaidPaymentRows(payments, paymentIntents)

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
          <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(subtotal)}</span>
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
          <span className="text-[28px] font-black text-primary-500 tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>

      {mode === 'detail' ? (
        <div className="space-y-2.5 border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground-muted">Trạng thái thanh toán</span>
            <PaymentStatusBadge status={paymentStatus} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-sm text-foreground-muted">Đã thu</span>
            </div>
            <span className="text-sm font-semibold text-success tabular-nums">{formatCurrency(amountPaid)}</span>
          </div>

          {paidPaymentRows.length > 0 ? (
            <div className="flex flex-col gap-1">
              {paidPaymentRows.map((payment, idx) => (
                <div key={payment.id || idx} className="flex items-center justify-between gap-4 text-[13px] leading-relaxed">
                  <span className={`font-medium ${getPaymentTextClass(payment.method, payment.colorKey, payment.label)}`}>
                    {payment.label}
                  </span>
                  <span className="shrink-0 text-foreground-muted tabular-nums">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-1 flex items-center justify-between pt-1">
            <span className="text-sm text-foreground-muted">Còn lại</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(remainingAmount)}</span>
          </div>
        </div>
      ) : null}

      <div className="border-b border-border px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
          <MessageSquare size={13} />
          Ghi chú
        </div>
        <input
          type="text"
          value={notes}
          disabled={!isEditing && mode === 'detail'}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Ghi chú cho đơn hàng..."
          className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-default disabled:bg-background-secondary disabled:text-foreground-muted"
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
