'use client'

import { useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, Landmark, Plus, Smartphone, Trash2, X } from 'lucide-react'
import { getPaymentMethodColorClasses, PAYMENT_METHOD_TYPE_LABELS } from '@/lib/payment-methods'
import { POINTS_REDEMPTION_RATE } from '@petshop/shared'
import type { PaymentMethod } from '@/lib/api/settings.api'

type MultiPaymentDraft = {
  method: string
  amount: number
  paymentAccountId?: string
  paymentAccountLabel?: string
}

interface MultiPaymentRowState {
  key: string
  paymentMethodId: string
  amount: string
}

export interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  cartTotal: number
  customerPoints?: number
  paymentMethods: PaymentMethod[]
  initialPayments: MultiPaymentDraft[]
  minimumMethods?: number
  title?: string
  description?: string
  onConfirm: (payload: { payments: MultiPaymentDraft[] }) => void
  /** Gọi khi hình thức đầu tiên là BANK/EWALLET — để trigger QR modal */
  onRequestQr?: (paymentAccountId: string, amount: number) => void
  /** Tỷ lệ quy đổi: 1 điểm = N VND */
  loyaltyPointValue?: number
}

const ROW_LIMIT = 3

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

function parseMoney(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function formatMoneyInput(value: string) {
  const parsed = parseMoney(value)
  return parsed > 0 ? new Intl.NumberFormat('vi-VN').format(parsed) : ''
}

function createRow(methodId = '', amount = ''): MultiPaymentRowState {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    paymentMethodId: methodId,
    amount,
  }
}

export function PaymentModal({
  isOpen,
  onClose,
  cartTotal,
  customerPoints = 0,
  paymentMethods,
  initialPayments,
  minimumMethods = 1,
  title = 'Thanh toán nhiều hình thức',
  onConfirm,
  onRequestQr,
  loyaltyPointValue = POINTS_REDEMPTION_RATE,
}: PaymentModalProps) {
  const [rows, setRows] = useState<MultiPaymentRowState[]>([])
  const [isPrimaryManual, setIsPrimaryManual] = useState(false)

  const paymentMethodMap = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method])),
    [paymentMethods],
  )

  useEffect(() => {
    if (!isOpen) return

    if (initialPayments.length > 1) {
      setRows(
        initialPayments.map((payment) =>
          createRow(payment.paymentAccountId ?? '', payment.amount > 0 ? String(payment.amount) : ''),
        ),
      )
      setIsPrimaryManual(true)
      return
    }

    const initialMethodId = initialPayments[0]?.paymentAccountId ?? paymentMethods[0]?.id ?? ''
    setRows(minimumMethods > 1 ? [createRow(initialMethodId, String(cartTotal)), createRow('', '')] : [createRow(initialMethodId, String(cartTotal))])
    setIsPrimaryManual(false)
  }, [cartTotal, initialPayments, isOpen, minimumMethods, paymentMethods])

  const rowsWithMethods = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        method: paymentMethodMap.get(row.paymentMethodId) ?? null,
        parsedAmount: parseMoney(row.amount),
      })),
    [paymentMethodMap, rows],
  )

  const allocatedAmount = rowsWithMethods.reduce((sum, row) => sum + row.parsedAmount, 0)
  const remainingAmount = Math.max(0, cartTotal - allocatedAmount)
  const isOverAllocated = allocatedAmount > cartTotal
  const usableRows = rowsWithMethods.filter((row) => row.method && row.parsedAmount > 0)
  const hasDuplicateMethods = new Set(usableRows.map((row) => row.paymentMethodId)).size !== usableRows.length

  const syncPrimaryAmount = (draftRows: MultiPaymentRowState[]) => {
    if (isPrimaryManual || draftRows.length === 0) return draftRows

    const restAmount = draftRows.slice(1).reduce((sum, row) => sum + parseMoney(row.amount), 0)
    const nextPrimaryAmount = Math.max(0, cartTotal - restAmount)
    return draftRows.map((row, index) => (index === 0 ? { ...row, amount: nextPrimaryAmount > 0 ? String(nextPrimaryAmount) : '' } : row))
  }

  const updateRow = (targetKey: string, patch: Partial<MultiPaymentRowState>, manualPrimary = false) => {
    setRows((current) => {
      const nextRows = current.map((row) => (row.key === targetKey ? { ...row, ...patch } : row))
      return syncPrimaryAmount(nextRows)
    })

    if (manualPrimary) {
      setIsPrimaryManual(true)
    }
  }

  const removeRow = (targetKey: string) => {
    setRows((current) => {
      const nextRows = current.filter((row) => row.key !== targetKey)
      return syncPrimaryAmount(nextRows)
    })
  }

  const addRow = () => {
    if (rows.length >= ROW_LIMIT) return

    const usedIds = new Set(rows.map((row) => row.paymentMethodId).filter(Boolean))
    const nextMethod = paymentMethods.find((method) => !usedIds.has(method.id))
    setRows((current) => [...syncPrimaryAmount(current), createRow(nextMethod?.id ?? '', '')])
  }

  const canConfirm = usableRows.length >= minimumMethods && !isOverAllocated && !hasDuplicateMethods

  const handleConfirm = () => {
    if (!canConfirm) return
    const payments = usableRows.map((row) => ({
      method: row.method!.type,
      amount: row.parsedAmount,
      paymentAccountId: row.method!.id,
      paymentAccountLabel: row.method!.name,
    }))

    // Nếu hình thức đầu tiên là Bank/Ví và chỉ 1 hình thức → trigger QR
    const primaryMethod = usableRows[0]?.method
    if (
      onRequestQr &&
      primaryMethod &&
      (primaryMethod.type === 'BANK' || primaryMethod.type === 'EWALLET') &&
      usableRows.length === 1
    ) {
      onRequestQr(primaryMethod.id, usableRows[0].parsedAmount)
      return
    }

    onConfirm({ payments })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center app-modal-overlay p-4">
      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground-muted transition-colors hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-3 rounded-2xl border border-border bg-background-secondary/60 p-4 grid-cols-3 text-center divide-x divide-border">
            <div>
              <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-foreground-muted">CẦN THANH TOÁN</div>
              <div className="mt-1.5 text-lg sm:text-xl font-bold text-foreground">{formatMoney(cartTotal)}</div>
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-foreground-muted">TỔNG ĐÃ CHIA</div>
              <div className={`mt-1.5 text-lg sm:text-xl font-bold ${allocatedAmount >= cartTotal ? 'text-success' : 'text-sky-500'}`}>
                {formatMoney(allocatedAmount)}
              </div>
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {isOverAllocated ? 'VƯỢT MỨC' : remainingAmount > 0 ? 'CÒN THIẾU' : 'ĐÃ ĐỦ'}
              </div>
              <div className={`mt-1.5 text-lg sm:text-xl font-bold ${isOverAllocated ? 'text-error' : remainingAmount > 0 ? 'text-warning' : 'text-success'}`}>
                {formatMoney(isOverAllocated ? allocatedAmount - cartTotal : remainingAmount)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {rowsWithMethods.map((row, index) => {
              const availableMethods = paymentMethods.filter(
                (pm) => pm.id === row.paymentMethodId || !rows.some((r) => r.paymentMethodId === pm.id)
              )

              return (
                <div key={row.key} className="grid gap-3 items-center md:grid-cols-[minmax(0,1.25fr)_minmax(180px,0.75fr)_auto]">
                  <div>
                    <select
                      value={row.paymentMethodId}
                      onChange={(event) => updateRow(row.key, { paymentMethodId: event.target.value })}
                      className="w-full rounded-xl border border-border bg-background-secondary/60 px-4 py-2.5 text-[15px] font-medium text-foreground outline-none transition-colors focus:border-primary-500"
                    >
                      <option value="">Chọn phương thức</option>
                      {availableMethods.map((paymentMethod) => (
                        <option key={paymentMethod.id} value={paymentMethod.id}>
                          {paymentMethod.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(row.amount)}
                      onChange={(event) => {
                        let valStr = event.target.value.replace(/\D/g, '')
                        if (row.method?.type === 'POINTS') {
                          const maxPointsAmount = customerPoints * loyaltyPointValue
                          const val = Math.min(Number(valStr), maxPointsAmount)
                          valStr = val > 0 ? val.toString() : ''
                        }
                        updateRow(
                          row.key,
                          { amount: valStr },
                          index === 0,
                        )
                      }}
                      placeholder={index === 0 ? new Intl.NumberFormat('vi-VN').format(cartTotal) : 'Nhập số tiền'}
                      className="w-full rounded-xl border border-border bg-background-secondary/60 px-4 py-2.5 text-right text-[15px] font-semibold text-foreground outline-none transition-colors focus:border-primary-500"
                    />
                    {row.method?.type === 'POINTS' && customerPoints > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const maxAmount = customerPoints * loyaltyPointValue
                          updateRow(row.key, { amount: maxAmount.toString() }, index === 0)
                        }}
                        className="mt-1 text-xs text-primary-500 hover:underline text-right w-full"
                      >
                        Tối đa: {new Intl.NumberFormat('vi-VN').format(customerPoints * loyaltyPointValue)}đ ({customerPoints} điểm)
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length <= minimumMethods}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground-muted transition-colors hover:text-error hover:border-error/30 hover:bg-error/8 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col items-start gap-4 pt-2">
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= ROW_LIMIT || rows.length >= paymentMethods.length}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2 text-sm font-semibold text-foreground-muted transition-colors hover:border-primary-500/40 hover:bg-primary-500/5 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Thêm hình thức
            </button>
            <div className="space-y-1 text-[13px]">
              {hasDuplicateMethods ? <div className="font-medium text-error">Đã có phương thức trùng lặp.</div> : null}
              {isOverAllocated ? <div className="font-medium text-error">Tổng số tiền đang vượt quá số cần thanh toán.</div> : null}
              {!hasDuplicateMethods && !isOverAllocated && remainingAmount > 0 ? (
                <div className="font-medium text-warning">Bạn có thể lưu thanh toán chưa đủ nếu khách gửi trước một phần.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-background-secondary/40 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline h-9 px-5"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="btn-primary h-9 px-6 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lưu thanh toán
          </button>
        </div>
      </div>
    </div>
  )
}
