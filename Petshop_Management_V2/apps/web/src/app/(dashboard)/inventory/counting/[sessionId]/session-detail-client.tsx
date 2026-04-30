'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Package,
  PlayCircle,
  Send,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { stockCountApi } from '@/lib/api/stock-count.api'
import { useAuthStore } from '@/stores/auth.store'
import { confirmDialog, promptDialog } from '@/components/ui/confirmation-provider'
import { customToast as toast } from '@/components/ui/toast-with-copy'

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_LABELS: Record<string, string> = {
  MON: 'Thứ 2',
  TUE: 'Thứ 3',
  WED: 'Thứ 4',
  THU: 'Thứ 5',
  FRI: 'Thứ 6',
  SAT: 'Thứ 7',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Đang kiểm',
  SUBMITTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
}

function formatDate(value: string | Date) {
  const date = new Date(value)
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()}`
}

function toInputDate(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10)
}

function clampSuggestedDate(startDate: string | Date, endDate: string | Date) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (today < start) return toInputDate(start)
  if (today > end) return toInputDate(end)
  return toInputDate(today)
}

function getShiftTone(shift: any) {
  if (shift.status === 'APPROVED') return 'border-emerald-200 bg-emerald-50'
  if (shift.status === 'SUBMITTED') return 'border-amber-200 bg-amber-50'
  if (shift.startedAt) return 'border-blue-200 bg-blue-50'
  return 'border-border bg-card'
}

export function SessionDetailClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [selectedDate, setSelectedDate] = useState('')

  const { data: sessionResponse, isLoading, error } = useQuery({
    queryKey: ['stock-count-session', sessionId],
    queryFn: () => stockCountApi.getSession(sessionId),
  })

  const session = (sessionResponse as any)?.data ?? null

  useEffect(() => {
    if (session?.startDate && session?.endDate) {
      setSelectedDate((current) =>
        current || clampSuggestedDate(session.startDate, session.endDate),
      )
    }
  }, [session?.startDate, session?.endDate])

  const claimShiftMutation = useMutation({
    mutationFn: (countDate: string) =>
      stockCountApi.claimRandomShift(sessionId, {
        countDate,
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['stock-count-session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['stock-count-progress'] })
      const shiftId = (response as any)?.data?.id
      if (shiftId) {
        router.push(`/inventory/counting/shifts/${shiftId}`)
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => stockCountApi.approveSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-count-session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['stock-count-progress'] })
      queryClient.invalidateQueries({ queryKey: ['stock-count-sessions'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (rejectionReason: string) =>
      stockCountApi.rejectSession(sessionId, { rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-count-session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['stock-count-progress'] })
      queryClient.invalidateQueries({ queryKey: ['stock-count-sessions'] })
    },
  })

  const handleClaimShift = async () => {
    if (!selectedDate) {
      toast.error('Vui lòng chọn ngày kiểm.')
      return
    }

    try {
      await claimShiftMutation.mutateAsync(selectedDate)
    } catch (error: any) {
      const message =
        error?.response?.data?.message ?? 'Không thể nhận ca kiểm ngẫu nhiên cho ngày đã chọn.'
      toast.error(Array.isArray(message) ? message.join('\n') : message)
    }
  }

  const handleApprove = async () => {
    if (!(await confirmDialog('Duyệt phiếu kiểm và áp chênh lệch vào tồn kho hiện tại?'))) {
      return
    }

    try {
      await approveMutation.mutateAsync()
      toast.success('Phiếu kiểm đã được duyệt.')
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Không thể duyệt phiếu kiểm.'
      toast.error(Array.isArray(message) ? message.join('\n') : message)
    }
  }

  const handleReject = async () => {
    const rejectionReason = await promptDialog('Nhập lý do từ chối phiếu kiểm:')
    if (!rejectionReason?.trim()) {
      return
    }

    try {
      await rejectMutation.mutateAsync(rejectionReason.trim())
      toast.success('Phiếu kiểm đã bị từ chối.')
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Không thể từ chối phiếu kiểm.'
      toast.error(Array.isArray(message) ? message.join('\n') : message)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-foreground-muted">Đang tải phiếu kiểm...</div>
  }

  if (error || !session) {
    return <div className="p-8 text-center text-error">Không tìm thấy phiếu kiểm kho.</div>
  }

  const progressPercent = session.progressPercent ?? 0
  const shiftsByDay = DAY_ORDER.map((dayKey) => ({
    dayKey,
    shifts: (session.shifts ?? []).filter((shift: any) => shift.shift?.startsWith(dayKey)),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Phiếu kiểm tuần {session.weekNumber}/{session.year}
          </h2>
          <p className="text-sm text-foreground-muted">
            Chi nhánh: {session.branch?.name ?? '—'} · {formatDate(session.startDate)} →{' '}
            {formatDate(session.endDate)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-background-tertiary px-3 py-1 text-xs font-semibold text-foreground">
            {STATUS_LABELS[session.status] ?? session.status}
          </span>
          {session.status === 'SUBMITTED' ? (
            <>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <CheckCircle2 size={16} /> Duyệt phiếu
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle size={16} /> Từ chối
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            <Package size={14} /> Dòng hàng
          </div>
          <div className="mt-3 text-2xl font-bold text-foreground">
            {session.countedProducts}/{session.totalProducts}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            <Clock size={14} /> Ca kiểm
          </div>
          <div className="mt-3 text-2xl font-bold text-foreground">{session.shifts?.length ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            <CheckCircle2 size={14} /> Tiến độ
          </div>
          <div className="mt-3 text-2xl font-bold text-foreground">{progressPercent}%</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            <CalendarDays size={14} /> Người tạo
          </div>
          <div className="mt-3 text-sm font-semibold text-foreground">
            {session.creator?.fullName ?? '—'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Nhận ca kiểm ngẫu nhiên</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              Bạn có thể chọn ngày hiện tại, ngày trước chưa kiểm hoặc ngày sau muốn kiểm sớm.
              Hệ thống chỉ random ca chưa hoàn tất của đúng ngày đó, không cho chọn ca theo ý.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="date"
              value={selectedDate}
              min={toInputDate(session.startDate)}
              max={toInputDate(session.endDate)}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-primary-500 focus:outline-none"
            />
            <button
              onClick={handleClaimShift}
              disabled={claimShiftMutation.isPending || session.status !== 'DRAFT'}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
            >
              <PlayCircle size={16} />
              {claimShiftMutation.isPending ? 'Đang nhận ca...' : 'Nhận ca ngẫu nhiên'}
            </button>
          </div>
        </div>

        {session.rejectionReason ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Lý do từ chối trước đó: {session.rejectionReason}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">Danh sách ca trong tuần</h3>
          <p className="mt-1 text-sm text-foreground-muted">
            Ca đã nhận hoặc đã nộp có thể mở lại để xem chi tiết.
          </p>
        </div>

        <div className="space-y-5">
          {shiftsByDay.map(({ dayKey, shifts }) => (
            <div key={dayKey}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                {DAY_LABELS[dayKey]}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {shifts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-foreground-muted">
                    Chưa có sản phẩm gán cho ngày này.
                  </div>
                ) : (
                  shifts.map((shift: any) => {
                    const isOwnedByCurrentUser = shift.counter?.id === user?.id
                    const canOpen =
                      shift.status !== 'DRAFT' || shift.startedAt || isOwnedByCurrentUser

                    return (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => canOpen && router.push(`/inventory/counting/shifts/${shift.id}`)}
                        disabled={!canOpen}
                        className={`rounded-xl border p-4 text-left transition ${getShiftTone(shift)} ${canOpen ? 'hover:shadow-md' : 'cursor-not-allowed opacity-70'}`}
                      >
                        <div className="text-sm font-semibold text-foreground">{shift.shiftLabel ?? shift.shift}</div>
                        <div className="mt-1 text-xs text-foreground-muted">
                          {shift.countedItems}/{shift.totalItems} dòng hàng
                        </div>
                        <div className="mt-2 text-xs text-foreground-muted">
                          {shift.counter?.fullName
                            ? `Người kiểm: ${shift.counter.fullName}`
                            : 'Chưa có người nhận ca'}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">
                            {STATUS_LABELS[shift.status] ?? shift.status}
                          </span>
                          {shift.completedAt ? (
                            <span className="text-emerald-600">Đã nộp ca</span>
                          ) : shift.startedAt ? (
                            <span className="text-blue-600">Đang kiểm</span>
                          ) : (
                            <span className="text-foreground-muted">Chưa nhận</span>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {session.approver?.fullName ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-foreground-muted">
          Quản lý duyệt: <span className="font-semibold text-foreground">{session.approver.fullName}</span>
          {session.approvedAt ? ` · ${formatDate(session.approvedAt)}` : ''}
        </div>
      ) : null}
    </div>
  )
}
