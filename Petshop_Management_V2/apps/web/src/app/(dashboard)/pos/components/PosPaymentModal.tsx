'use client'

import { useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, Landmark, Plus, Smartphone, Trash2, X } from 'lucide-react'
import { getPaymentMethodColorClasses, PAYMENT_METHOD_TYPE_LABELS } from '@/lib/payment-methods'
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

interface PosPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  cartTotal: number
  paymentMethods: PaymentMethod[]
  initialPayments: MultiPaymentDraft[]
  minimumMethods?: number
  title?: string
  description?: string
  onConfirm: (payload: { payments: MultiPaymentDraft[] }) => void
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

function getTypeIcon(type: PaymentMethod['type']) {
  if (type === 'CASH') return Banknote
  if (type === 'BANK') return Landmark
  if (type === 'EWALLET') return Smartphone
  return CreditCard
}

function createRow(methodId = '', amount = ''): MultiPaymentRowState {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    paymentMethodId: methodId,
    amount,
  }
}

export function PosPaymentModal({
  isOpen,
  onClose,
  cartTotal,
  paymentMethods,
  initialPayments,
  minimumMethods = 1,
  title = 'Thanh toán nhiều hình thức',
  onConfirm,
}: PosPaymentModalProps) {
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 grid-cols-3 text-center divide-x divide-gray-200">
            <div>
              <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">CẦN THANH TOÁN</div>
              <div className="mt-1.5 text-lg sm:text-xl font-bold text-gray-900">{formatMoney(cartTotal)}</div>
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">TỔNG ĐÃ CHIA</div>
              <div className={`mt-1.5 text-lg sm:text-xl font-bold ${allocatedAmount >= cartTotal ? 'text-emerald-600' : 'text-sky-600'}`}>
                {formatMoney(allocatedAmount)}
              </div>
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                {isOverAllocated ? 'VƯỢT MỨC' : remainingAmount > 0 ? 'CÒN THIẾU' : 'ĐÃ ĐỦ'}
              </div>
              <div className={`mt-1.5 text-lg sm:text-xl font-bold ${isOverAllocated ? 'text-rose-600' : remainingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatMoney(isOverAllocated ? allocatedAmount - cartTotal : remainingAmount)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {rowsWithMethods.map((row, index) => {
              const method = row.method
              
              const availableMethods = paymentMethods.filter(
                (pm) => pm.id === row.paymentMethodId || !rows.some((r) => r.paymentMethodId === pm.id)
              );

              return (
                <div key={row.key} className="grid gap-3 items-center md:grid-cols-[minmax(0,1.25fr)_minmax(180px,0.75fr)_auto]">
                  <div>
                    <select
                      value={row.paymentMethodId}
                      onChange={(event) => updateRow(row.key, { paymentMethodId: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[15px] font-medium text-gray-800 outline-none transition-colors focus:border-primary-500"
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
                      onChange={(event) =>
                        updateRow(
                          row.key,
                          { amount: event.target.value.replace(/\D/g, '') },
                          index === 0,
                        )
                      }
                      placeholder={index === 0 ? new Intl.NumberFormat('vi-VN').format(cartTotal) : 'Nhập số tiền'}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-right text-[15px] font-semibold text-gray-900 outline-none transition-colors focus:border-primary-500"
                    />
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length <= minimumMethods}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-100 bg-white text-gray-400 transition-colors hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Thêm hình thức
            </button>
            <div className="space-y-1 text-[13px]">
              {hasDuplicateMethods ? <div className="font-medium text-rose-600">Đã có phương thức trùng lặp.</div> : null}
              {isOverAllocated ? <div className="font-medium text-rose-600">Tổng số tiền đang vượt quá số cần thanh toán.</div> : null}
              {!hasDuplicateMethods && !isOverAllocated && remainingAmount > 0 ? (
                <div className="font-medium text-amber-600">Bạn có thể lưu thanh toán chưa đủ nếu khách gửi trước một phần.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() =>
              canConfirm
                ? onConfirm({
                    payments: usableRows.map((row) => ({
                      method: row.method!.type,
                      amount: row.parsedAmount,
                      paymentAccountId: row.method!.id,
                      paymentAccountLabel: row.method!.name,
                    })),
                  })
                : undefined
            }
            disabled={!canConfirm}
            className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lưu thanh toán
          </button>
        </div>
      </div>
    </div>
  )
}
