'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Printer, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { shiftApi, type CashDenomination, type ShiftDenominations, type ShiftSession, type ShiftSummary } from '@/lib/api/shift.api'
import { useAuthStore } from '@/stores/auth.store'

const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000]
const K80_PAGE_WIDTH = '80mm'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value || 0))
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function escapeHtml(value?: string | null) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
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

function buildShiftReportPrintHtml({
  modeLabel,
  branchName,
  branchAddress,
  staffName,
  openedAt,
  closedAt,
  summary,
}: {
  modeLabel: string
  branchName: string
  branchAddress?: string | null
  staffName: string
  openedAt?: string | null
  closedAt?: string | null
  summary: ShiftSummary | null
}) {
  const reportRows = summary
    ? [
      ['Tiền mặt đầu ca', summary.openAmount, false],
      ['Thu phần mềm', (summary.orderCashIncome ?? 0) + (summary.manualCashIncome ?? 0), false],
      ['Chi phần mềm', (summary.orderCashExpense ?? 0) + (summary.manualCashExpense ?? 0), false],
      ['Bán được', summary.netCashAmount ?? 0, false],
      ['Thiếu két đầu ca', summary.reserveShortageAtOpen ?? 0, false],
      ['Bù két', summary.reserveTopUpAmount ?? 0, false],
      ['Thực rút', summary.withdrawableAmount ?? 0, false],
      ['Cần thu được', summary.expectedCloseAmount ?? 0, false],
      ['Thu CK/Thẻ', summary.nonCashIncome ?? 0, false],
      ['Chi CK/Thẻ', summary.nonCashExpense ?? 0, false],
      ['Số đơn giao dịch', summary.orderCount ?? 0, true],
      ['Số đơn trả/hoàn', summary.refundCount ?? 0, true],
    ]
    : []

  const rowsHtml = reportRows
    .map(
      ([label, value, isCount]) => `
        <div class="line">
          <span>${escapeHtml(String(label))}</span>
          <strong>${isCount ? Number(value ?? 0) : formatCurrency(Number(value ?? 0))}</strong>
        </div>
      `,
    )
    .join('')

  const paymentRows = summary?.otherPayments?.length
    ? summary.otherPayments
      .map(
        (payment) => `
            <div class="line compact">
              <span>${escapeHtml(payment.label)}</span>
              <span>+${formatCurrency(payment.income)} / -${formatCurrency(payment.expense)}</span>
            </div>
          `,
      )
      .join('')
    : ''

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>In báo cáo</title>
    <style>
      @page { size: ${K80_PAGE_WIDTH} auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body {
        width: ${K80_PAGE_WIDTH};
        margin: 0 auto;
        padding: 0;
        font-family: Arial, sans-serif;
        font-size: 11px;
        line-height: 1.35;
        color: #111827;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .wrap { width: 100%; }
      .center { text-align: center; }
      .title { font-size: 15px; font-weight: 700; margin-bottom: 2px; text-transform: uppercase; }
      .sub { font-size: 10px; color: #475569; }
      .section { border-top: 1px dashed #94a3b8; margin-top: 8px; padding-top: 8px; }
      .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
      .line { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 2px 0; }
      .line.compact { font-size: 10px; color: #475569; }
      .line span:first-child { flex: 1; }
      .line strong { font-weight: 700; }
      .footer { border-top: 1px dashed #94a3b8; margin-top: 10px; padding-top: 8px; text-align: center; font-size: 10px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="center">
        <div class="title">${escapeHtml(modeLabel)}</div>
        <div class="sub">${escapeHtml(branchName)}</div>
        ${branchAddress ? `<div class="sub">${escapeHtml(branchAddress)}</div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">Thông tin ca</div>
        <div class="line"><span>Chi nhánh</span><strong>${escapeHtml(branchName)}</strong></div>
        <div class="line"><span>Nhân viên</span><strong>${escapeHtml(staffName)}</strong></div>
        <div class="line"><span>Mở ca</span><strong>${escapeHtml(formatDateTime(openedAt))}</strong></div>
        ${closedAt ? `<div class="line"><span>Chốt ca</span><strong>${escapeHtml(formatDateTime(closedAt))}</strong></div>` : ''}
      </div>
      <div class="section">
        <div class="section-title">Báo cáo ca</div>
        ${rowsHtml || '<div class="sub">Chưa có dữ liệu báo cáo ca.</div>'}
        ${paymentRows ? `<div class="section"><div class="section-title">Thanh toán khác</div>${paymentRows}</div>` : ''}
      </div>
      <div class="footer">Báo cáo ca POS</div>
    </div>
  </body>
</html>`
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
  const allowedBranches = useAuthStore((state) => state.allowedBranches)
  const currentUser = useAuthStore((state) => state.user)
  const [denominations, setDenominations] = useState<ShiftDenominations>(() => normalizeDenominations())
  const [employeeNote, setEmployeeNote] = useState('')
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
  const isBalanced = (differenceAmount ?? 0) === 0
  const isSurplus = (differenceAmount ?? 0) > 0
  const currentBranch = useMemo(
    () => allowedBranches.find((branch) => branch.id === (shift?.branchId ?? activeBranchId)) ?? null,
    [activeBranchId, allowedBranches, shift?.branchId],
  )
  const diffColor = isBalanced ? 'text-emerald-600' : isSurplus ? 'text-amber-600' : 'text-rose-600'
  const diffBg = isBalanced
    ? 'bg-emerald-50 border-emerald-200'
    : isSurplus
      ? 'bg-amber-50 border-amber-200'
      : 'bg-rose-50 border-rose-200'

  useEffect(() => {
    if (!isOpen) return
    const source = !currentShift
      ? null
      : currentShift.closeDenominations ?? currentShift.openDenominations
    setDenominations(normalizeDenominations(source))
    setEmployeeNote(currentShift?.employeeNote ?? '')
    setActiveRow(0)
  }, [currentShift, isOpen])

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

  const handlePrintReport = useCallback(async () => {
    let resolvedShift = shift

    if (shift?.id) {
      try {
        resolvedShift = await shiftApi.summary(shift.id)
      } catch {
        resolvedShift = shift
      }
    }

    const resolvedSummary = resolvedShift?.summary ?? summary
    const printWindow = window.open('', 'shift-report-print', 'width=420,height=720')
    if (!printWindow) {
      toast.error('Không mở được cửa sổ in báo cáo')
      return
    }

    const html = buildShiftReportPrintHtml({
      modeLabel,
      branchName: resolvedShift?.branchName ?? currentBranch?.name ?? 'Chi nhánh',
      branchAddress: currentBranch?.address ?? null,
      staffName: resolvedShift?.staffName ?? currentUser?.fullName ?? 'Nhân viên',
      openedAt: resolvedShift?.openedAt ?? null,
      closedAt: resolvedShift?.closedAt ?? null,
      summary: resolvedSummary,
    })

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()

    const triggerPrint = () => {
      printWindow.focus()
      printWindow.print()
    }

    printWindow.onafterprint = () => {
      printWindow.close()
    }

    window.setTimeout(triggerPrint, 300)
  }, [currentBranch?.address, currentBranch?.name, currentUser?.fullName, modeLabel, shift, summary])

  if (!isOpen) return null

  const isSaving = startShift.isPending || endShift.isPending

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[96vh] w-full max-w-[840px] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-4">
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
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[400px_400px] lg:overflow-hidden">
          <div className="flex flex-col gap-3 overflow-y-auto border-r border-slate-200 p-5 lg:max-h-full">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-base font-bold text-slate-800">Báo cáo ca</h3>
              </div>

              <div className="p-4">
                {isOpening ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-base text-slate-500">
                    Chưa có ca đang mở. Kiểm đếm tiền thực tế trong két, nhập số lượng theo mệnh giá và nhấn <strong>Mở sổ đầu ca</strong>.
                  </div>
                ) : summary ? (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Tiền mặt</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        <SummaryRow
                          icon={<Wallet size={15} />}
                          label="Đầu ca"
                          subLabel={shift?.openedAt ? formatDateTime(shift.openedAt) : undefined}
                          value={summary.openAmount}
                        />
                        {shift?.closedAt ? (
                          <SummaryRow
                            icon={<CheckCircle2 size={15} />}
                            label="Chốt ca"
                            subLabel={formatDateTime(shift.closedAt)}
                            value={shift.closeAmount ?? 0}
                          />
                        ) : null}
                        <SummaryRow icon={<TrendingUp size={15} />} label="Thu phần mềm" value={(summary.orderCashIncome ?? 0) + (summary.manualCashIncome ?? 0)} tone="emerald" />
                        <SummaryRow icon={<TrendingDown size={15} />} label="Chi phần mềm" value={(summary.orderCashExpense ?? 0) + (summary.manualCashExpense ?? 0)} tone="rose" />
                        <SummaryRow icon={<TrendingUp size={15} />} label="Bán được" value={summary.netCashAmount ?? 0} tone={(summary.netCashAmount ?? 0) >= 0 ? 'emerald' : 'rose'} />
                        <SummaryRow icon={<Wallet size={15} />} label="Thiếu két đầu ca" value={summary.reserveShortageAtOpen ?? 0} tone="amber" />
                        <SummaryRow icon={<Wallet size={15} />} label="Bù két" value={summary.reserveTopUpAmount ?? 0} tone="amber" />
                        <SummaryRow icon={<CheckCircle2 size={15} />} label="Thực rút" value={summary.withdrawableAmount ?? 0} tone="emerald" />
                        <SummaryRow icon={<CheckCircle2 size={15} />} label="Cần thu được" value={summary.expectedCloseAmount} tone="cyan" highlight />
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Không tiền mặt</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        <SummaryRow icon={<CreditCard size={15} />} label="Thu CK/Thẻ" value={summary.nonCashIncome} />
                        <SummaryRow icon={<CreditCard size={15} />} label="Chi CK/Thẻ" value={summary.nonCashExpense} tone="rose" />
                      </div>
                    </div>

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
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto bg-surface p-4 lg:max-h-full">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">
                {isOpening ? 'Tiền mặt đầu ca' : 'Kiểm đếm tiền cuối ca'}
              </h3>
            </div>

            <div className="overflow-hidden rounded-2xl border-2 border-cyan-200 bg-cyan-50">
              <div className="grid grid-cols-[1fr_110px_100px] gap-2 border-b border-cyan-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cyan-600">
                <span>Mệnh giá</span>
                <span className="text-center">SL</span>
                <span className="text-right">Thành tiền</span>
              </div>

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
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() =>
                            setDenominations((prev) => ({
                              ...prev,
                              [String(denomination)]: Math.max(0, (Number(prev[String(denomination)]) || 0) - 1),
                            }))
                          }
                          className="flex h-8 w-7 shrink-0 select-none items-center justify-center rounded-md border border-cyan-200/70 bg-cyan-50 text-sm font-bold text-cyan-400 transition-colors hover:bg-cyan-100 hover:text-cyan-600 active:scale-95"
                        >
                          −
                        </button>
                        <input
                          ref={(el) => {
                            inputRefs.current[index] = el
                          }}
                          type="number"
                          min={0}
                          value={denominations[String(denomination)] || ''}
                          onChange={(event) => {
                            const quantity = Math.max(0, Number(event.target.value) || 0)
                            setDenominations((current) => ({ ...current, [String(denomination)]: quantity }))
                          }}
                          onFocus={() => setActiveRow(index)}
                          onKeyDown={(event) => handleKeyDown(event, index)}
                          className="w-10 rounded-md border border-cyan-200 bg-white px-1 py-1.5 text-center text-base font-bold outline-none transition-all [appearance:textfield] focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          placeholder="0"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() =>
                            setDenominations((prev) => ({
                              ...prev,
                              [String(denomination)]: (Number(prev[String(denomination)]) || 0) + 1,
                            }))
                          }
                          className="flex h-8 w-7 shrink-0 select-none items-center justify-center rounded-md border border-cyan-200/70 bg-cyan-50 text-sm font-bold text-cyan-400 transition-colors hover:bg-cyan-100 hover:text-cyan-600 active:scale-95"
                        >
                          +
                        </button>
                      </div>
                      <span className={`text-right text-base font-bold ${qty > 0 ? 'text-cyan-700' : 'text-slate-300'}`}>
                        {qty > 0 ? formatCurrency(subtotal) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between border-t-2 border-cyan-200 bg-cyan-100/60 px-4 py-3">
                <span className="text-base font-semibold text-cyan-800">Tổng đếm được</span>
                <span className="text-2xl font-black text-cyan-900">{formatCurrency(countedTotal)}</span>
              </div>
            </div>

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
                  <div className="mt-1 flex items-center justify-between border-t border-slate-200/60 pt-2">
                    <span className={`text-base font-bold ${diffColor}`}>
                      {isBalanced ? '✓ Cân bằng' : isSurplus ? '↑ Thừa' : '↓ Thiếu'}
                    </span>
                    <span className={`text-2xl font-black ${diffColor}`}>
                      {(differenceAmount ?? 0) > 0 ? '+' : ''}
                      {formatCurrency(differenceAmount ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <textarea
              id="shift-note"
              rows={1}
              value={employeeNote}
              onChange={(event) => {
                setEmployeeNote(event.target.value)
                const element = event.target
                element.style.height = 'auto'
                element.style.height = `${element.scrollHeight}px`
              }}
              className="mt-auto w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400"
              placeholder="Ghi chú bàn giao, thừa thiếu..."
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void handlePrintReport()
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Printer size={16} />
              In báo cáo
            </button>
            <button
              type="button"
              onClick={() => window.open('/finance?tab=cash-shifts', '_blank')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Sổ tiền mặt
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-base font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Hủy
            </button>
            {shift && shift.status !== 'CLOSED' ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => startShift.mutate()}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                Sửa đầu ca
              </button>
            ) : null}
            {shift?.status === 'CLOSED' ? (
              <button
                type="button"
                onClick={() => {
                  void useAuthStore.getState().logout().then(() => {
                    window.location.href = '/login'
                  })
                }}
                className="rounded-xl border border-rose-200 px-5 py-2.5 text-base font-semibold text-rose-600 transition-colors hover:bg-rose-50"
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
              className="rounded-xl bg-[#0089A1] px-7 py-2.5 text-base font-bold text-white transition-colors hover:bg-[#006E82] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu...' : modeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  icon,
  label,
  subLabel,
  value,
  tone,
  highlight,
  isCount,
}: {
  icon?: ReactNode
  label: string
  subLabel?: string
  value: number
  tone?: 'emerald' | 'rose' | 'cyan' | 'amber'
  highlight?: boolean
  isCount?: boolean
}) {
  const toneMap = {
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    cyan: 'text-cyan-700',
    amber: 'text-amber-600',
  }

  const valueColor = tone ? toneMap[tone] : 'text-slate-800'
  const bgClass = highlight ? 'bg-cyan-50 border-cyan-200' : 'bg-slate-50 border-slate-200'

  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${bgClass}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        {icon ? <span className="shrink-0 text-slate-400">{icon}</span> : null}
        <span className="truncate text-sm text-slate-600">
          {label}
          {subLabel ? <span className="ml-1.5 text-xs font-normal text-slate-400">({subLabel})</span> : null}
        </span>
      </div>
      <span className={`shrink-0 text-base font-bold tabular-nums ${valueColor}`}>
        {isCount ? value : formatCurrency(value)}
      </span>
    </div>
  )
}
