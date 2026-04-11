'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Printer, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { shiftApi, type CashDenomination, type ShiftDenominations, type ShiftSession, type ShiftSummary } from '@/lib/api/shift.api'
import { useAuthStore } from '@/stores/auth.store'

const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value || 0))
}

function normalizeDenominations(value?: CashDenomination[] | ShiftDenominations | null) {
  const result: ShiftDenominations = {}
  if (Array.isArray(value)) {
    for (const item of value) {
      result[String(item.value)] = Math.max(0, Number(item.quantity) || 0)
    }
  }
  for (const denomination of DENOMINATIONS) {
    if (result[String(denomination)] === undefined) {
      result[String(denomination)] = Math.max(
        0,
        Number(!Array.isArray(value) ? value?.[String(denomination)] : 0) || 0,
      )
    }
  }
  return result
}

function sumDenominations(value: ShiftDenominations) {
  return DENOMINATIONS.reduce((total, denomination) => {
    return total + denomination * (Number(value[String(denomination)]) || 0)
  }, 0)
}

function getModeLabel(shift: ShiftSession | null | undefined) {
  if (!shift) return 'Mở sổ đầu ca'
  if (shift.status === 'CLOSED') return 'Chốt lại cuối ca'
  return 'Chốt sổ cuối ca'
}

interface PosShiftClosingModalProps {
  isOpen: boolean
  currentShift?: ShiftSession | null
  onClose: () => void
  onSaved?: () => void
}

export function PosShiftClosingModal({ isOpen, currentShift, onClose, onSaved }: PosShiftClosingModalProps) {
  const queryClient = useQueryClient()
  const activeBranchId = useAuthStore((state) => state.activeBranchId)
  const [denominations, setDenominations] = useState<ShiftDenominations>(() => normalizeDenominations())
  const [employeeNote, setEmployeeNote] = useState('')
  // activeRow dùng cho keyboard navigation (↑↓)
  const [activeRow, setActiveRow] = useState<number>(0)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const summaryQuery = useQuery({
    queryKey: ['shifts', 'summary', currentShift?.id],
    queryFn: () => shiftApi.summary(currentShift!.id),
    enabled: isOpen && Boolean(currentShift?.id),
    staleTime: 5_000,
  })

  const shift = summaryQuery.data ?? currentShift ?? null
  const summary: ShiftSummary | null = shift?.summary ?? null
  const countedTotal = useMemo(() => sumDenominations(denominations), [denominations])
  const modeLabel = getModeLabel(shift)
  const isOpening = !shift
  const expectedCloseAmount = summary?.expectedCloseAmount ?? 0
  const differenceAmount = isOpening ? null : countedTotal - expectedCloseAmount
  const diffAbs = Math.abs(differenceAmount ?? 0)
  const isBalanced = (differenceAmount ?? 0) === 0
  const isSurplus = (differenceAmount ?? 0) > 0
  const diffColor = isBalanced ? 'text-emerald-600' : isSurplus ? 'text-amber-600' : 'text-rose-600'
  const diffBg = isBalanced
    ? 'bg-emerald-50 border-emerald-200'
    : isSurplus
      ? 'bg-amber-50 border-amber-200'
      : 'bg-rose-50 border-rose-200'

  useEffect(() => {
    if (!isOpen) return
    const source =
      !currentShift ? null : currentShift.closeDenominations
    setDenominations(normalizeDenominations(source))
    setEmployeeNote(currentShift?.employeeNote ?? '')
    setActiveRow(0)
  }, [currentShift, isOpen])

  // Keyboard handler: ←→ tăng/giảm, ↑↓ chuyển mệnh giá
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      const denomination = DENOMINATIONS[index]
      if (!denomination) return

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setDenominations((prev) => ({
          ...prev,
          [String(denomination)]: Math.max(0, (Number(prev[String(denomination)]) || 0) + 1),
        }))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setDenominations((prev) => ({
          ...prev,
          [String(denomination)]: Math.max(0, (Number(prev[String(denomination)]) || 0) - 1),
        }))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        const prevIdx = Math.max(0, index - 1)
        setActiveRow(prevIdx)
        inputRefs.current[prevIdx]?.focus()
      } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault()
        const nextIdx = Math.min(DENOMINATIONS.length - 1, index + 1)
        setActiveRow(nextIdx)
        inputRefs.current[nextIdx]?.focus()
      }
    },
    [],
  )

  const startShift = useMutation({
    mutationFn: () =>
      shiftApi.start({
        branchId: activeBranchId ?? undefined,
        openAmount: countedTotal,
        openDenominations: denominations,
        employeeNote,
      }),
    onSuccess: () => {
      toast.success('Đã mở sổ đầu ca')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      onSaved?.()
      onClose()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? 'Không thể mở sổ đầu ca'),
  })

  const endShift = useMutation({
    mutationFn: () =>
      shiftApi.end(shift!.id, {
        closeAmount: countedTotal,
        closeDenominations: denominations,
        employeeNote,
      }),
    onSuccess: () => {
      toast.success(shift?.status === 'CLOSED' ? 'Đã chốt lại ca' : 'Đã chốt sổ cuối ca')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      onSaved?.()
      onClose()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? 'Không thể chốt sổ'),
  })

  if (!isOpen) return null

  const isSaving = startShift.isPending || endShift.isPending

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[96vh] w-full max-w-[840px] flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-slate-900">{modeLabel}</h2>
          <div className="flex items-center gap-3">
            {shift ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{shift.branchName ?? 'Chi nhánh'}</span>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-500">{shift.staffName ?? 'Nhân viên'}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${shift.status === 'CLOSED' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                  {shift.status === 'CLOSED' ? 'Đã chốt' : 'Đang mở'}
                </span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* ── Body: 2 cột ── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[400px_400px] lg:overflow-hidden">

          {/* === CỘT TRÁI: Báo cáo ca + Ghi chú === */}
          <div className="flex flex-col gap-3 overflow-y-auto border-r border-slate-200 p-5 lg:max-h-full">

            {/* Báo cáo ca */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-base font-bold text-slate-800">Báo cáo ca</h3>
              </div>

              <div className="p-4">
                {isOpening ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-base text-slate-500 text-center">
                    Chưa có ca đang mở. Kiểm đếm tiền thực tế trong két, nhập số lượng theo mệnh giá và nhấn <strong>Mở sổ đầu ca</strong>.
                  </div>
                ) : summary ? (
                  <div className="space-y-3">

                    {/* ─ Tiền mặt ─ */}
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Tiền mặt</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        <SummaryRow
                          icon={<Wallet size={15} />}
                          label="Đầu ca"
                          subLabel={shift?.openedAt ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(shift.openedAt)) : undefined}
                          value={summary.openAmount}
                        />
                        {shift?.closedAt ? (
                          <SummaryRow
                            icon={<CheckCircle2 size={15} />}
                            label="Chốt ca"
                            subLabel={new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(shift.closedAt))}
                            value={shift.closeAmount ?? 0}
                          />
                        ) : null}
                        <SummaryRow icon={<TrendingUp size={15} />} label="Thu phần mềm" value={(summary.orderCashIncome ?? 0) + (summary.manualCashIncome ?? 0)} tone="emerald" />
                        <SummaryRow icon={<TrendingDown size={15} />} label="Chi phần mềm" value={(summary.orderCashExpense ?? 0) + (summary.manualCashExpense ?? 0)} tone="rose" />
                        <SummaryRow icon={<CheckCircle2 size={15} />} label="Cần thu được" value={summary.expectedCloseAmount} tone="cyan" highlight />
                      </div>
                    </div>

                    {/* ─ Không tiền mặt ─ */}
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Không tiền mặt</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        <SummaryRow icon={<CreditCard size={15} />} label="Thu CK/Thẻ" value={summary.nonCashIncome} />
                        <SummaryRow icon={<CreditCard size={15} />} label="Chi CK/Thẻ" value={summary.nonCashExpense} tone="rose" />
                      </div>
                    </div>

                    {/* ─ Giao dịch ─ */}
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Giao dịch</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        <SummaryRow icon={<Clock size={15} />} label="Số đơn giao dịch" value={summary.orderCount} isCount />
                        <SummaryRow icon={<AlertTriangle size={15} />} label="Số đơn trả/hoàn" value={summary.refundCount} isCount />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-center text-base text-slate-400">
                    <span className="animate-pulse">Đang tải báo cáo ca...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hình thức thanh toán khác */}
            {summary?.otherPayments?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-base font-bold text-slate-800">Các hình thức thanh toán khác</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {summary.otherPayments.map((payment) => (
                    <div key={payment.label} className="flex items-center justify-between px-4 py-2.5 text-base">
                      <span className="font-medium text-slate-700">{payment.label}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-600">↑ {formatCurrency(payment.income)}</span>
                        <span className="text-rose-600">↓ {formatCurrency(payment.expense)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Ghi chú nhân viên */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="px-4 pt-3 pb-2">
                <label htmlFor="shift-note" className="text-base font-bold text-slate-800">Ghi chú nhân viên</label>
              </div>
              <div className="px-4 pb-4">
                <textarea
                  id="shift-note"
                  rows={1}
                  value={employeeNote}
                  onChange={(event) => {
                    setEmployeeNote(event.target.value)
                    const el = event.target
                    el.style.height = 'auto'
                    el.style.height = `${el.scrollHeight}px`
                  }}
                  className="w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-800 outline-none focus:border-cyan-400 focus:bg-white transition-colors placeholder:text-slate-400"
                  placeholder="Nhập ghi chú thua/thiếu, lý do, bàn giao..."
                />
              </div>
            </div>
          </div>

          {/* === CỘT PHẢI: Kiểm đếm tiền mặt === */}
          <div className="flex flex-col gap-3 overflow-y-auto bg-white p-4 lg:max-h-full">

            {/* Tiêu đề cột phải */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">
                {isOpening ? 'Tiền mặt đầu ca' : 'Kiểm đếm tiền cuối ca'}
              </h3>
            </div>

            {/* Bảng mệnh giá */}
            <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 overflow-hidden">
              {/* Header bảng */}
              <div className="grid grid-cols-[1fr_110px_100px] gap-2 border-b border-cyan-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cyan-600">
                <span>Mệnh giá</span>
                <span className="text-right">SL</span>
                <span className="text-right">Thành tiền</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-cyan-100/60">
                {DENOMINATIONS.map((denomination, index) => {
                  const qty = Number(denominations[String(denomination)]) || 0
                  const subtotal = denomination * qty
                  const isActive = activeRow === index
                  return (
                    <div
                      key={denomination}
                      className={`grid grid-cols-[1fr_110px_100px] items-center gap-2 px-3 py-1.5 transition-colors ${isActive ? 'bg-cyan-100/80' : qty > 0 ? 'bg-white/70' : 'bg-transparent'}`}
                    >
                      <span className={`text-right text-base font-semibold tabular-nums ${qty > 0 ? 'text-slate-800' : 'text-slate-500'}`}>
                        {formatCurrency(denomination)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setDenominations((prev) => ({ ...prev, [String(denomination)]: Math.max(0, (Number(prev[String(denomination)]) || 0) - 1) }))}
                          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-200/70 bg-cyan-50 text-cyan-400 transition-colors hover:bg-cyan-100 hover:text-cyan-600 active:scale-95 select-none text-sm font-bold"
                        >−</button>
                        <input
                          ref={(el) => { inputRefs.current[index] = el }}
                          type="number"
                          min={0}
                          value={denominations[String(denomination)] || ''}
                          onChange={(event) => {
                            const quantity = Math.max(0, Number(event.target.value) || 0)
                            setDenominations((current) => ({ ...current, [String(denomination)]: quantity }))
                          }}
                          onFocus={() => setActiveRow(index)}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          className="w-10 rounded-md border border-cyan-200 bg-white px-1 py-1.5 text-center text-base font-bold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setDenominations((prev) => ({ ...prev, [String(denomination)]: (Number(prev[String(denomination)]) || 0) + 1 }))}
                          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-200/70 bg-cyan-50 text-cyan-400 transition-colors hover:bg-cyan-100 hover:text-cyan-600 active:scale-95 select-none text-sm font-bold"
                        >+</button>
                      </div>
                      <span className={`text-right text-base font-bold ${qty > 0 ? 'text-cyan-700' : 'text-slate-300'}`}>
                        {qty > 0 ? formatCurrency(subtotal) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Tổng đếm được */}
              <div className="flex items-center justify-between border-t-2 border-cyan-200 bg-cyan-100/60 px-4 py-3">
                <span className="text-base font-semibold text-cyan-800">Tổng đếm được</span>
                <span className="text-2xl font-black text-cyan-900">{formatCurrency(countedTotal)}</span>
              </div>
            </div>

            {/* Đối chiếu cuối ca */}
            {!isOpening ? (
              <div className={`rounded-2xl border p-4 ${diffBg}`}>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Đối chiếu cuối ca</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-base">
                    <span className="text-slate-600">Cần thu được</span>
                    <span className="font-bold text-slate-800">{formatCurrency(expectedCloseAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base">
                    <span className="text-slate-600">Chốt cuối ca</span>
                    <span className="font-bold text-slate-800">{formatCurrency(countedTotal)}</span>
                  </div>
                  <div className="mt-1 border-t border-slate-200/60 pt-2 flex items-center justify-between">
                    <span className={`text-base font-bold ${diffColor}`}>
                      {isBalanced ? '✓ Cân bằng' : isSurplus ? `↑ Thừa` : `↓ Thiếu`}
                    </span>
                    <span className={`text-2xl font-black ${diffColor}`}>
                      {(differenceAmount ?? 0) > 0 ? '+' : ''}{formatCurrency(differenceAmount ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Printer size={16} />
              In báo cáo ca
            </button>
            <button
              type="button"
              onClick={() => window.open('/finance?tab=cash-shifts', '_blank')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Sổ tiền mặt
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-base font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            {/* Nút Sửa đầu ca — chỉ hiện khi có ca và chưa chốt */}
            {shift && shift.status !== 'CLOSED' ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => startShift.mutate()}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                Sửa đầu ca
              </button>
            ) : null}
            {/* Nút Đăng xuất — chỉ hiện sau khi đã chốt ca */}
            {shift?.status === 'CLOSED' ? (
              <button
                type="button"
                onClick={() => { void useAuthStore.getState().logout().then(() => { window.location.href = '/login' }) }}
                className="rounded-xl border border-rose-200 px-5 py-2.5 text-base font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                Đăng xuất
              </button>
            ) : null}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (isOpening) startShift.mutate()
                else endShift.mutate()
              }}
              className="rounded-xl bg-[#0089A1] px-7 py-2.5 text-base font-bold text-white hover:bg-[#006E82] disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {isSaving ? 'Đang lưu...' : modeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-component: SummaryRow ──────────────────────────────────────────────────

function SummaryRow({
  icon,
  label,
  subLabel,
  value,
  tone,
  highlight,
  isCount,
  isTime,
  raw,
}: {
  icon?: React.ReactNode
  label: string
  /** Thời gian nhỏ hiện trong ngoặc sau label, VD: "Đầu ca (10:51 11/04/2026)" */
  subLabel?: string
  value: number
  tone?: 'emerald' | 'rose' | 'cyan'
  highlight?: boolean
  isCount?: boolean
  /** Nếu true, right side hiển thị raw/subLabel thay vì formatCurrency */
  isTime?: boolean
  raw?: string
}) {
  const toneMap = {
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    cyan: 'text-cyan-700',
  }
  const valueColor = tone ? toneMap[tone] : 'text-slate-800'
  const bgClass = highlight ? 'bg-cyan-50 border-cyan-200' : 'bg-slate-50 border-slate-200'

  // Giá trị hiển thị bên phải
  let rightContent: React.ReactNode
  if (isTime) {
    rightContent = <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{raw ?? subLabel ?? '—'}</span>
  } else {
    rightContent = (
      <span className={`shrink-0 text-base font-bold tabular-nums ${valueColor}`}>
        {isCount ? value : formatCurrency(value)}
      </span>
    )
  }

  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${bgClass}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        {icon ? <span className="shrink-0 text-slate-400">{icon}</span> : null}
        <span className="truncate text-sm text-slate-600">
          {label}
          {subLabel ? <span className="ml-1.5 text-xs font-normal text-slate-400">({subLabel})</span> : null}
        </span>
      </div>
      {rightContent}
    </div>
  )
}

