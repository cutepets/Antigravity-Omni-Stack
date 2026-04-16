'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  RotateCcw,
  Smartphone,
  Star,
  X,
} from 'lucide-react'
import type { CompleteOrderPayload } from '@/lib/api/order.api'
import { settingsApi, type PaymentMethod } from '@/lib/api/settings.api'
import { filterVisiblePaymentMethods, PAYMENT_METHOD_TYPE_LABELS } from '@/lib/payment-methods'
import { cn, formatCurrency } from '@/lib/utils'

interface OrderSettlementModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: CompleteOrderPayload) => void
  orderNumber?: string
  total: number
  amountPaid: number
  canKeepCredit: boolean
  isPending?: boolean
  branchId?: string | null
}

function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function getTypeIcon(type: PaymentMethod['type']) {
  if (type === 'CASH') return Banknote
  if (type === 'BANK') return Landmark
  if (type === 'EWALLET') return Smartphone
  if (type === 'CARD') return CreditCard
  return Star
}

export function OrderSettlementModal({
  isOpen,
  onClose,
  onConfirm,
  orderNumber,
  total,
  amountPaid,
  canKeepCredit,
  isPending = false,
  branchId,
}: OrderSettlementModalProps) {
  const outstandingAmount = Math.max(0, total - amountPaid)
  const existingOverpaidAmount = Math.max(0, amountPaid - total)
  const settlementAmount = outstandingAmount > 0 ? outstandingAmount : total

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [overpaymentAction, setOverpaymentAction] = useState<NonNullable<CompleteOrderPayload['overpaymentAction']> | undefined>(undefined)
  const [refundMethodId, setRefundMethodId] = useState('')
  const [settlementNote, setSettlementNote] = useState('')

  const {
    data: paymentMethods = [],
    isError,
    error,
  } = useQuery({
    queryKey: ['settings', 'payment-methods'],
    queryFn: () => settingsApi.getPaymentMethods(),
    staleTime: 30_000,
  })

  const visiblePaymentMethods = useMemo(
    () =>
      filterVisiblePaymentMethods(paymentMethods, {
        branchId,
        amount: settlementAmount,
        selectedId: selectedPaymentMethodId || refundMethodId || undefined,
      }),
    [branchId, paymentMethods, refundMethodId, selectedPaymentMethodId, settlementAmount],
  )

  const paymentOptions = useMemo(() => visiblePaymentMethods, [visiblePaymentMethods])

  const selectedPaymentMethod = paymentOptions.find((method) => method.id === selectedPaymentMethodId) ?? null
  const selectedRefundMethod = paymentOptions.find((method) => method.id === refundMethodId) ?? null

  useEffect(() => {
    if (!isOpen) return

    const preferredMethod =
      paymentOptions.find((method) => method.isDefault) ??
      paymentOptions.find((method) => method.type === 'CASH') ??
      paymentOptions[0] ??
      null

    setSelectedPaymentMethodId(preferredMethod?.id ?? '')
    setRefundMethodId(preferredMethod?.id ?? '')
    setCashReceived(outstandingAmount > 0 ? String(outstandingAmount) : '')
    setSettlementNote('')
    setOverpaymentAction(existingOverpaidAmount > 0 ? (canKeepCredit ? 'KEEP_CREDIT' : 'REFUND') : undefined)
  }, [canKeepCredit, existingOverpaidAmount, isOpen, outstandingAmount, paymentOptions])

  useEffect(() => {
    if (!isOpen || outstandingAmount <= 0 || selectedPaymentMethod?.type === 'CASH') return
    setCashReceived(String(outstandingAmount))
  }, [isOpen, outstandingAmount, selectedPaymentMethod?.type])

  if (!isOpen) return null

  const extraPaymentAmount =
    outstandingAmount > 0
      ? selectedPaymentMethod?.type === 'CASH'
        ? parseMoneyInput(cashReceived)
        : outstandingAmount
      : 0
  const projectedPaidAmount = amountPaid + extraPaymentAmount
  const projectedOverpaidAmount = Math.max(0, projectedPaidAmount - total)
  const overpaidAmount = existingOverpaidAmount > 0 ? existingOverpaidAmount : projectedOverpaidAmount
  const isUnderpaid = outstandingAmount > 0 && extraPaymentAmount < outstandingAmount
  const needsOverpaymentAction = overpaidAmount > 0
  const disableConfirm =
    isPending ||
    isUnderpaid ||
    !selectedPaymentMethod ||
    (needsOverpaymentAction && !overpaymentAction) ||
    (overpaymentAction === 'KEEP_CREDIT' && !canKeepCredit) ||
    (overpaymentAction === 'REFUND' && !selectedRefundMethod)

  const handleConfirm = () => {
    if (disableConfirm || !selectedPaymentMethod) return

    const payload: CompleteOrderPayload = {}

    if (extraPaymentAmount > 0) {
      payload.payments = [
        {
          method: selectedPaymentMethod.type,
          amount: extraPaymentAmount,
          paymentAccountId: selectedPaymentMethod.id,
          paymentAccountLabel: selectedPaymentMethod.name,
        },
      ]
    }

    if (needsOverpaymentAction && overpaymentAction) {
      payload.overpaymentAction = overpaymentAction
      if (overpaymentAction === 'REFUND' && selectedRefundMethod) {
        payload.refundMethod = selectedRefundMethod.type
        payload.refundPaymentAccountId = selectedRefundMethod.id
        payload.refundPaymentAccountLabel = selectedRefundMethod.name
      }
    }

    if (settlementNote.trim()) {
      payload.settlementNote = settlementNote.trim()
    }

    onConfirm(payload)
  }

  const confirmLabel =
    needsOverpaymentAction && overpaymentAction === 'REFUND'
      ? 'Hoan tat va hoan tien'
      : needsOverpaymentAction && overpaymentAction === 'KEEP_CREDIT'
        ? 'Hoan tat va giu credit'
        : outstandingAmount > 0
          ? 'Thu them va hoan tat'
          : 'Hoan tat don'

  const networkErrorMessage = (error as any)?.response?.data?.message ?? (error as any)?.message ?? 'Khong tai duoc cau hinh thanh toan'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
              Quyet toan cuoi
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">
              {orderNumber ? `Don ${orderNumber}` : 'Hoan tat don hang'}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Thu du tien, xu ly tien du neu co va chot don theo dung nghiep vu.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background-secondary text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Tong don</span>
                <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Da thu</span>
                <span className="font-semibold text-success">{formatCurrency(amountPaid)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-foreground-muted">
                  {existingOverpaidAmount > 0 ? 'Dang du' : 'Con can thu'}
                </span>
                <span
                  className={cn(
                    'font-semibold',
                    existingOverpaidAmount > 0
                      ? 'text-primary-500'
                      : outstandingAmount > 0
                        ? 'text-warning'
                        : 'text-foreground',
                  )}
                >
                  {formatCurrency(existingOverpaidAmount > 0 ? existingOverpaidAmount : outstandingAmount)}
                </span>
              </div>
            </div>

            {isError ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {networkErrorMessage}
              </div>
            ) : null}

            {outstandingAmount > 0 ? (
              <div className="space-y-4 rounded-2xl border border-border bg-card/80 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Thu them truoc khi hoan tat</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Chon truc tiep phuong thuc hien thi trong cau hinh Thanh toan.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {paymentOptions.map((method) => {
                    const Icon = getTypeIcon(method.type)
                    const isSelected = selectedPaymentMethodId === method.id

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedPaymentMethodId(method.id)}
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-center transition-colors',
                          isSelected
                            ? 'border-primary-500 bg-primary-500/10 text-primary-600'
                            : 'border-border bg-background-secondary text-foreground-muted hover:text-foreground',
                        )}
                      >
                        <Icon size={18} className="mx-auto mb-2" />
                        <div className="text-xs font-semibold">{method.name}</div>
                        <div className="mt-1 text-[11px] opacity-70">{PAYMENT_METHOD_TYPE_LABELS[method.type]}</div>
                      </button>
                    )
                  })}
                </div>

                {paymentOptions.length === 0 && !isError ? (
                  <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    Khong co phuong thuc thanh toan nao dang hien cho chi nhanh hoac so tien nay.
                  </div>
                ) : null}

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    {selectedPaymentMethod?.type === 'CASH' ? 'Khach dua' : 'So tien thu them'}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    readOnly={selectedPaymentMethod?.type !== 'CASH'}
                    value={cashReceived ? new Intl.NumberFormat('vi-VN').format(parseMoneyInput(cashReceived)) : ''}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder={new Intl.NumberFormat('vi-VN').format(outstandingAmount)}
                    className={cn(
                      'h-12 w-full rounded-2xl border border-border px-4 text-base font-semibold text-foreground outline-none transition-colors',
                      selectedPaymentMethod?.type === 'CASH'
                        ? 'bg-background focus:border-primary-500'
                        : 'cursor-not-allowed bg-background-secondary text-foreground-muted',
                    )}
                  />
                </label>

                {isUnderpaid ? (
                  <p className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    Can thu it nhat {formatCurrency(outstandingAmount)} de hoan tat don.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {existingOverpaidAmount > 0 ? 'Don dang du tien' : 'Don da du tien'}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {existingOverpaidAmount > 0
                    ? 'Chon cach xu ly phan du truoc khi chot don.'
                    : 'Co the hoan tat ngay neu toan bo dich vu da hoan thanh.'}
                </p>
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Ghi chu quyet toan
              </span>
              <textarea
                rows={4}
                value={settlementNote}
                onChange={(event) => setSettlementNote(event.target.value)}
                placeholder="Vi du: thu them luc checkout hotel, hoan tien phan chenh lech..."
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
              />
            </label>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <p className="text-sm font-semibold text-foreground">Sau khi quyet toan</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">Tong da thu du kien</span>
                  <span className="font-semibold text-foreground">{formatCurrency(projectedPaidAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">Phan du can xu ly</span>
                  <span className={cn('font-semibold', overpaidAmount > 0 ? 'text-primary-500' : 'text-foreground')}>
                    {formatCurrency(overpaidAmount)}
                  </span>
                </div>
              </div>
            </div>

            {needsOverpaymentAction ? (
              <div className="space-y-4 rounded-2xl border border-primary-500/20 bg-primary-500/5 p-4">
                <div className="flex items-start gap-3">
                  <RotateCcw size={18} className="mt-0.5 shrink-0 text-primary-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Xu ly tien du</p>
                    <p className="mt-1 text-xs text-foreground-muted">
                      Don se du {formatCurrency(overpaidAmount)} sau quyet toan.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOverpaymentAction('REFUND')}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                    overpaymentAction === 'REFUND'
                      ? 'border-primary-500 bg-background text-foreground'
                      : 'border-transparent bg-white/70 text-foreground-muted hover:border-primary-500/40 hover:text-foreground',
                  )}
                >
                  <p className="text-sm font-semibold">Hoan tien ngay</p>
                  <p className="mt-1 text-xs">Sinh phieu chi va dua lai phan chenh lech cho khach.</p>
                </button>

                <button
                  type="button"
                  onClick={() => canKeepCredit && setOverpaymentAction('KEEP_CREDIT')}
                  disabled={!canKeepCredit}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                    overpaymentAction === 'KEEP_CREDIT'
                      ? 'border-primary-500 bg-background text-foreground'
                      : 'border-transparent bg-white/70 text-foreground-muted hover:border-primary-500/40 hover:text-foreground',
                    !canKeepCredit && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <p className="text-sm font-semibold">Giu vao cong no am</p>
                  <p className="mt-1 text-xs">
                    {canKeepCredit
                      ? 'Giu tien du tren ho so khach de tru cho lan sau.'
                      : 'Can co khach hang gan voi don moi dung duoc lua chon nay.'}
                  </p>
                </button>

                {overpaymentAction === 'REFUND' ? (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                      Phuong thuc hoan tien
                    </span>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {paymentOptions.map((method) => {
                        const Icon = getTypeIcon(method.type)
                        const isSelected = refundMethodId === method.id

                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setRefundMethodId(method.id)}
                            className={cn(
                              'rounded-2xl border px-3 py-3 text-center transition-colors',
                              isSelected
                                ? 'border-primary-500 bg-primary-500/10 text-primary-600'
                                : 'border-border bg-background-secondary text-foreground-muted hover:text-foreground',
                            )}
                          >
                            <Icon size={18} className="mx-auto mb-2" />
                            <div className="text-xs font-semibold">{method.name}</div>
                            <div className="mt-1 text-[11px] opacity-70">{PAYMENT_METHOD_TYPE_LABELS[method.type]}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-success/20 bg-success/10 p-4">
                <p className="text-sm font-semibold text-success">Khong co tien du can xu ly</p>
                <p className="mt-1 text-xs text-success/80">
                  He thong se hoan tat don ngay sau khi thu du va kiem tra dieu kien backend.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-background-secondary/70 p-4 text-sm text-foreground-muted">
              Backend se tu chan neu phien spa chua hoan tat, hotel chua checkout hoac so tien thu them van chua du.
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-background-secondary px-5 text-sm font-medium text-foreground transition-colors hover:border-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Dong
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disableConfirm}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {isPending ? 'Dang xu ly...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
