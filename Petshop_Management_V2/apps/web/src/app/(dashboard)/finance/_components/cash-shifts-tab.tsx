'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Edit3, RefreshCw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { shiftApi, type CashShift, type ShiftReviewStatus } from '@/lib/api/shift.api'
import { useAuthorization } from '@/hooks/useAuthorization'

function todayString() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function firstDayOfMonth() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

function diffTone(value?: number | null) {
  const amount = Number(value) || 0
  if (amount === 0) return 'text-emerald-400'
  return amount > 0 ? 'text-amber-400' : 'text-rose-400'
}

// ─── Review status options ───────────────────────────────────────────────────

type ReviewStatusOption = {
  value: ShiftReviewStatus
  label: string
  activeClass: string
  inactiveClass: string
}

const REVIEW_STATUS_OPTIONS: ReviewStatusOption[] = [
  {
    value: 'PENDING',
    label: 'Chờ duyệt',
    activeClass: 'border-slate-400 bg-slate-500/20 text-slate-200',
    inactiveClass:
      'border-border/60 bg-background-secondary text-foreground-muted hover:border-slate-400/50 hover:text-slate-300',
  },
  {
    value: 'APPROVED',
    label: 'Duyệt',
    activeClass: 'border-emerald-500 bg-emerald-500/20 text-emerald-300',
    inactiveClass:
      'border-border/60 bg-background-secondary text-foreground-muted hover:border-emerald-500/50 hover:text-emerald-300',
  },
  {
    value: 'CHECKED',
    label: 'Sai tiền',
    activeClass: 'border-rose-500 bg-rose-500/20 text-rose-300',
    inactiveClass:
      'border-border/60 bg-background-secondary text-foreground-muted hover:border-rose-500/50 hover:text-rose-300',
  },
  {
    value: 'REJECTED',
    label: 'Cần xử lý',
    activeClass: 'border-amber-500 bg-amber-500/20 text-amber-300',
    inactiveClass:
      'border-border/60 bg-background-secondary text-foreground-muted hover:border-amber-500/50 hover:text-amber-300',
  },
]

function getStatusBadge(status: ShiftReviewStatus) {
  return REVIEW_STATUS_OPTIONS.find((o) => o.value === status) ?? REVIEW_STATUS_OPTIONS[0]
}

// ─── Review form ──────────────────────────────────────────────────────────────

type ReviewForm = {
  openAmount: string
  closeAmount: string
  managerConclusion: string
  reviewStatus: ShiftReviewStatus
}

function buildReviewForm(shift: CashShift): ReviewForm {
  return {
    openAmount: String(Math.round(shift.openAmount || 0)),
    closeAmount:
      shift.closeAmount === null || shift.closeAmount === undefined
        ? ''
        : String(Math.round(shift.closeAmount)),
    managerConclusion: shift.managerConclusion ?? '',
    reviewStatus: shift.reviewStatus,
  }
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/\D/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ShiftReviewModalProps = {
  shift: CashShift | null
  canManage: boolean
  onClose: () => void
}

function ShiftReviewModal({ shift, canManage, onClose }: ShiftReviewModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ReviewForm | null>(shift ? buildReviewForm(shift) : null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setForm(shift ? buildReviewForm(shift) : null)
    setIsEditing(false)
  }, [shift])

  const updateShift = useMutation({
    mutationFn: () => {
      if (!shift || !form) throw new Error('Missing shift')
      return shiftApi.update(shift.id, {
        openAmount: parseAmount(form.openAmount),
        closeAmount: form.closeAmount.trim() ? parseAmount(form.closeAmount) : null,
        managerConclusion: form.managerConclusion,
        reviewStatus: form.reviewStatus,
      })
    },
    onSuccess: () => {
      toast.success('Đã cập nhật ca tiền mặt')
      queryClient.invalidateQueries({ queryKey: ['finance', 'cash-shifts'] })
      queryClient.invalidateQueries({ queryKey: ['cash-shifts'] })
      setIsEditing(false)
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể cập nhật ca tiền mặt')
    },
  })

  if (!shift || !form) return null

  const summary = shift.summarySnapshot ?? shift.summary
  const statusBadge = getStatusBadge(form.reviewStatus)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[840px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-background-secondary/60 px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-foreground">Kiểm tra ca tiền mặt</h3>
              <span
                className={`rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${statusBadge.activeClass}`}
              >
                {statusBadge.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {shift.branchName ?? 'Chi nhánh'} · {shift.staffName ?? '-'} · Chốt{' '}
              {formatDateTime(shift.closedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-foreground-muted hover:bg-white/10 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — 2 columns */}
        <div className="grid md:grid-cols-2">

          {/* Left: info */}
          <div className="space-y-2 border-r border-border/40 p-5">
            {(
              [
                ['Nhân viên mở ca', shift.staffName ?? '-'],
                ['Chi nhánh', shift.branchName ?? '-'],
                ['Trạng thái ca', shift.status === 'CLOSED' ? 'Đã đóng' : 'Đang mở'],
                ['Đã chốt lại', `${shift.closeCount ?? 0} lần`],
                ['Mở ca', formatDateTime(shift.openedAt)],
                ['Chốt ca', formatDateTime(shift.closedAt)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-background-secondary/60 px-3 py-2 text-sm"
              >
                <span className="text-foreground-muted">{label}</span>
                <strong className="text-right text-foreground">{value}</strong>
              </div>
            ))}

            {/* Ghi chú nhân viên */}
            {shift.employeeNote ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400/80">
                  Ghi chú nhân viên
                </p>
                <p className="text-foreground">{shift.employeeNote}</p>
              </div>
            ) : null}
          </div>

          {/* Right: financial */}
          <div className="space-y-2 p-5">
            {[
              { label: 'Tiền đầu ca', value: shift.openAmount },
              { label: 'Thu tiền mặt', value: summary?.cashIncome ?? shift.cashIncomeAmount },
              { label: 'Chi/hoàn tiền mặt', value: summary?.cashExpense ?? shift.cashExpenseAmount },
              { label: 'Bán được', value: shift.netCashAmount ?? summary?.netCashAmount ?? 0 },
              { label: 'Bù két', value: shift.reserveTopUpAmount ?? summary?.reserveTopUpAmount ?? 0 },
              { label: 'Thực rút', value: shift.withdrawableAmount ?? summary?.withdrawableAmount ?? 0 },
              { label: 'Đã thu', value: shift.collectedAmount ?? 0 },
              { label: 'Còn chờ thu', value: shift.pendingCollectionAmount ?? summary?.pendingCollectionAmount ?? 0 },
              {
                label: 'Cần thu được',
                value: shift.expectedCloseAmount ?? summary?.expectedCloseAmount ?? 0,
              },
              { label: 'Chốt cuối ca', value: shift.closeAmount ?? 0 },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-background-secondary/60 px-3 py-2 text-sm"
              >
                <span className="text-foreground-muted">{label}</span>
                <strong className="text-foreground">{formatCurrency(Number(value) || 0)}</strong>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background-secondary/60 px-3 py-2 text-sm">
              <span className="text-foreground-muted">Chênh lệch</span>
              <strong className={`text-lg font-bold ${diffTone(shift.differenceAmount)}`}>
                {formatCurrency(shift.differenceAmount)}
              </strong>
            </div>
          </div>
        </div>

        {/* Footer: editable area */}
        <div className="space-y-4 border-t border-border/60 bg-background-secondary/30 p-5">

          {/* Số tiền */}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-foreground-muted">Tiền đầu ca</span>
              <input
                value={formatCurrency(parseAmount(form.openAmount))}
                disabled={!isEditing}
                onChange={(e) =>
                  setForm((cur) => (cur ? { ...cur, openAmount: e.target.value } : cur))
                }
                className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2 text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-foreground-muted">Tiền thực tế cuối ca</span>
              <input
                value={form.closeAmount ? formatCurrency(parseAmount(form.closeAmount)) : ''}
                disabled={!isEditing}
                onChange={(e) =>
                  setForm((cur) => (cur ? { ...cur, closeAmount: e.target.value } : cur))
                }
                className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2 text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
              />
            </label>
          </div>

          {/* Kết luận quản lý */}
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-foreground-muted">Kết luận quản lý</span>
            <textarea
              value={form.managerConclusion}
              disabled={!canManage}
              onChange={(e) =>
                setForm((cur) => (cur ? { ...cur, managerConclusion: e.target.value } : cur))
              }
              rows={2}
              className="min-h-[60px] w-full resize-none rounded-xl border border-border bg-background-secondary px-3 py-2 text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
              placeholder="Ví dụ: đủ tiền, thiếu tiền cần nhân viên giải trình..."
            />
          </label>

          {/* Sửa sổ toggle — chỉ quản lý thấy */}
          {canManage && isEditing ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-2.5 text-sm text-amber-300">
              <span className="flex-1">Đang ở chế độ sửa sổ — nhập lại tiền đầu ca / cuối ca nếu nhân viên chốt nhầm.</span>
              <button
                type="button"
                onClick={() => { setIsEditing(false); setForm(buildReviewForm(shift)) }}
                className="rounded-lg border border-amber-500/40 px-3 py-1 text-xs font-semibold hover:bg-amber-500/20"
              >
                Huỷ sửa
              </button>
            </div>
          ) : null}

          {/* Trạng thái duyệt — nút */}
          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground-muted">Trạng thái duyệt</span>
            <div className="flex flex-wrap gap-2">
              {REVIEW_STATUS_OPTIONS.filter((opt) => opt.value !== 'PENDING').map((opt) => {
                const isActive = form.reviewStatus === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!canManage}
                    onClick={() => {
                      if (!canManage) return
                      setForm((cur) => (cur ? { ...cur, reviewStatus: opt.value } : cur))
                    }}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActive ? opt.activeClass : opt.inactiveClass
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
              {/* Hiện trạng thái Chờ duyệt chỉ khi đang ở PENDING */}
              {form.reviewStatus === 'PENDING' ? (
                <span className={`rounded-xl border px-4 py-2 text-sm font-semibold ${REVIEW_STATUS_OPTIONS[0].activeClass}`}>
                  Chờ duyệt
                </span>
              ) : null}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-foreground-muted hover:bg-white/10"
            >
              Đóng
            </button>
            {canManage && !isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                <Edit3 size={16} />
                Sửa sổ
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                disabled={updateShift.isPending}
                onClick={() => updateShift.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                <CheckCircle2 size={16} />
                {updateShift.isPending ? 'Đang lưu...' : 'Lưu duyệt'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Table / List ─────────────────────────────────────────────────────────────

export function CashShiftsTab() {
  const queryClient = useQueryClient()
  const { hasRole, isAdminOrManager, allowedBranches } = useAuthorization()
  const canManage = isAdminOrManager()
  const canDelete = hasRole(['SUPER_ADMIN', 'ADMIN'])
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth())
  const [dateTo, setDateTo] = useState(todayString())
  const [reviewStatus, setReviewStatus] = useState<ShiftReviewStatus | 'ALL'>('ALL')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL')
  const [selectedShift, setSelectedShift] = useState<CashShift | null>(null)

  const query = useQuery({
    queryKey: ['finance', 'cash-shifts', dateFrom, dateTo, reviewStatus, selectedBranchId],
    queryFn: () =>
      shiftApi.list({
        dateFrom,
        dateTo,
        reviewStatus,
        branchId: selectedBranchId === 'ALL' ? undefined : selectedBranchId,
        limit: 100,
      }),
  })

  const shifts = useMemo(() => query.data?.shifts ?? [], [query.data?.shifts])

  const deleteShift = useMutation({
    mutationFn: (id: string) => shiftApi.remove(id),
    onSuccess: () => {
      toast.success('Đã xoá ca tiền mặt')
      queryClient.invalidateQueries({ queryKey: ['finance', 'cash-shifts'] })
      queryClient.invalidateQueries({ queryKey: ['cash-shifts'] })
      setSelectedShift(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Không thể xoá ca tiền mặt')
    },
  })

  const handleDeleteShift = (shift: CashShift) => {
    if (shift.status !== 'CLOSED') {
      toast.error('Chỉ được xoá ca đã chốt')
      return
    }
    if (!window.confirm('Xoá ca chốt này? Hành động này không thể hoàn tác.')) return
    deleteShift.mutate(shift.id)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-4">
          {allowedBranches && allowedBranches.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedBranchId('ALL')}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  selectedBranchId === 'ALL'
                    ? 'border-primary-500/50 bg-primary-500/12 text-primary-100'
                    : 'border-border/70 bg-background-secondary text-foreground-muted hover:border-border hover:text-foreground'
                }`}
              >
                Tất cả chi nhánh
              </button>
              {allowedBranches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedBranchId === branch.id
                      ? 'border-primary-500/50 bg-primary-500/12 text-primary-100'
                      : 'border-border/70 bg-background-secondary text-foreground-muted hover:border-border hover:text-foreground'
                  }`}
                >
                  {branch.name}
                </button>
              ))}
              <div className="mx-1 hidden h-6 w-px bg-border/50 md:block"></div>
            </>
          ) : null}

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-border bg-background-secondary px-3 py-2 text-sm text-foreground outline-none"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-border bg-background-secondary px-3 py-2 text-sm text-foreground outline-none"
          />
          <select
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value as ShiftReviewStatus | 'ALL')}
            className="rounded-xl border border-border bg-background-secondary px-3 py-2 text-sm text-foreground outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Duyệt</option>
            <option value="CHECKED">Sai tiền</option>
            <option value="REJECTED">Cần xử lý</option>
          </select>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground-muted hover:text-foreground"
          >
            <RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />
            Tải lại
          </button>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card/95">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="sticky top-0 bg-background-secondary text-xs uppercase text-foreground-muted">
              <tr>
                <th className="px-4 py-3">Ngày ca</th>
                <th className="px-4 py-3">Chi nhánh</th>
                <th className="px-4 py-3">Nhân viên mở</th>
                <th className="px-4 py-3 text-right">Đầu ca</th>
                <th className="px-4 py-3 text-right">Theo app</th>
                <th className="px-4 py-3 text-right">Thực tế</th>
                <th className="px-4 py-3 text-right">Bán được</th>
                <th className="px-4 py-3 text-right">Bù két</th>
                <th className="px-4 py-3 text-right">Thực rút</th>
                <th className="px-4 py-3 text-right">Chờ thu</th>
                <th className="px-4 py-3 text-right">Đã thu</th>
                <th className="px-4 py-3 text-right">Thừa/thiếu</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-foreground-muted">
                    Đang tải sổ tiền mặt...
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-foreground-muted">
                    Chưa có ca tiền mặt trong khoảng thời gian này.
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => {
                  const badge = getStatusBadge(shift.reviewStatus)
                  return (
                    <tr key={shift.id} className="border-t border-border/70 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {formatDateTime(shift.openedAt)}
                        </div>
                        <div className="text-xs text-foreground-muted">
                          Đóng: {formatDateTime(shift.closedAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground-muted">{shift.branchName ?? '-'}</td>
                      <td className="px-4 py-3 text-foreground-muted">{shift.staffName ?? '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(shift.openAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary-400">
                        {formatCurrency(shift.expectedCloseAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(shift.closeAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-sky-300">
                        {formatCurrency(shift.netCashAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-300">
                        {formatCurrency(shift.reserveTopUpAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-300">
                        {formatCurrency(shift.withdrawableAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-300">
                        {formatCurrency(shift.pendingCollectionAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-sky-300">
                        {formatCurrency(shift.collectedAmount)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${diffTone(shift.differenceAmount)}`}
                      >
                        {formatCurrency(shift.differenceAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-bold uppercase text-foreground">
                          {shift.status === 'CLOSED' ? 'Đã đóng' : 'Đang mở'}
                        </div>
                        <span
                          className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.activeClass}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedShift(shift)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground-muted hover:text-foreground"
                          >
                            <Edit3 size={14} />
                            {canManage ? 'Sửa/duyệt' : 'Xem'}
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              disabled={deleteShift.isPending || shift.status !== 'CLOSED'}
                              onClick={() => handleDeleteShift(shift)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                              Xoá
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ShiftReviewModal
        shift={selectedShift}
        canManage={canManage}
        onClose={() => setSelectedShift(null)}
      />
    </>
  )
}
