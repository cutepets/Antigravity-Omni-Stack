'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  AlertTriangle,
  ArrowRight,
  MapPin,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { stockCountApi } from '@/lib/api/stock-count.api'
import { useAuthStore } from '@/stores/auth.store'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import {
  DataListShell,
  DataListToolbar,
  DataListTable,
  DataListPagination,
} from '@petshop/ui/data-list'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getWeekDates(date: Date): { start: Date; end: Date } {
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  saturday.setHours(0, 0, 0, 0)
  return { start: monday, end: saturday }
}

function formatDate(date: Date | string): string {
  const value = new Date(date)
  return `${value.getDate().toString().padStart(2, '0')}/${(value.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${value.getFullYear()}`
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Đang kiểm',
  SUBMITTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export function CountingDashboard() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [page, setPage] = useState(1)
  const pageSize = 10

  const activeBranchId = useAuthStore((state) => state.activeBranchId)
  const allowedBranches = useAuthStore((state) => state.allowedBranches)

  const scopedBranchId = searchParams.get('branchId')?.trim() || ''
  const selectedBranchId = scopedBranchId || activeBranchId || ''

  const now = new Date()
  const currentWeek = getWeekNumber(now)
  const currentYear = now.getFullYear()
  const currentWeekRange = getWeekDates(now)

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['stock-count-sessions', selectedBranchId, page, pageSize],
    queryFn: () =>
      stockCountApi.getSessions({
        branchId: selectedBranchId,
        page,
        limit: pageSize,
      }),
    enabled: !!selectedBranchId,
  })

  const { data: progressResponse } = useQuery({
    queryKey: ['stock-count-progress', selectedBranchId, currentWeek, currentYear],
    queryFn: async () => {
      try {
        return await stockCountApi.getWeeklyProgress(selectedBranchId, currentWeek, currentYear)
      } catch (error: any) {
        if (error?.response?.status === 404) {
          return null
        }
        throw error
      }
    },
    enabled: !!selectedBranchId,
    retry: false,
  })

  const createSessionMutation = useMutation({
    mutationFn: () =>
      stockCountApi.createSession({
        branchId: selectedBranchId,
        weekNumber: currentWeek,
        year: currentYear,
        startDate: toIsoDate(currentWeekRange.start),
        endDate: toIsoDate(currentWeekRange.end),
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['stock-count-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['stock-count-progress'] })
      const sessionId = (response as any)?.data?.id
      if (sessionId) {
        router.push(`/inventory/counting/${sessionId}`)
      }
    },
  })

  const sessions = (sessionsData as any)?.data?.data ?? []
  const total = (sessionsData as any)?.data?.total ?? 0
  const totalPages = (sessionsData as any)?.data?.totalPages ?? 1
  const progress = (progressResponse as any)?.data ?? null

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + sessions.length)

  const handleCreateSession = async () => {
    if (!selectedBranchId) {
      toast.error('Vui lòng chọn chi nhánh trước khi tạo phiếu kiểm tuần.')
      return
    }

    try {
      await createSessionMutation.mutateAsync()
    } catch (error: any) {
      const message =
        error?.response?.data?.message ?? 'Không thể tạo phiếu kiểm tuần cho chi nhánh này.'
      toast.error(Array.isArray(message) ? message.join('\n') : message)
    }
  }

  return (
    <DataListShell>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Kiểm kho theo Ca</h2>
          <p className="text-sm text-foreground-muted">
            Nhân viên nhận ca ngẫu nhiên theo ngày, nhập chênh lệch và chờ quản lý duyệt.
          </p>
        </div>
        <button
          onClick={handleCreateSession}
          disabled={createSessionMutation.isPending || !selectedBranchId}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          <Plus size={16} /> {createSessionMutation.isPending ? 'Đang tạo...' : 'Tạo phiếu kiểm tuần'}
        </button>
      </div>

      {selectedBranchId && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarDays size={16} className="text-primary-500" />
                Tuần {currentWeek}/{currentYear} ({formatDate(currentWeekRange.start)} →{' '}
                {formatDate(currentWeekRange.end)})
              </div>
              <div className="mt-1 text-xs text-foreground-muted">
                Chi nhánh:{' '}
                <span className="font-semibold text-foreground">
                  {allowedBranches.find((branch) => branch.id === selectedBranchId)?.name ??
                    selectedBranchId}
                </span>
              </div>
            </div>

            {progress?.session ? (
              <button
                onClick={() => router.push(`/inventory/counting/${progress.session.id}`)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-background-secondary"
              >
                Mở phiếu tuần này <ArrowRight size={14} />
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-foreground-muted">
                Tuần này chưa có phiếu kiểm kho.
              </div>
            )}
          </div>

          {progress?.session && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-xs text-foreground-muted">
                    <span>Tiến độ kiểm trong tuần</span>
                    <span>{progress.session.progressPercent}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-background-tertiary">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all"
                      style={{ width: `${progress.session.progressPercent}%` }}
                    />
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[progress.session.status]}`}
                >
                  {STATUS_LABELS[progress.session.status]}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={12} /> {progress.summary.completedShifts} ca xong
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <Clock size={12} /> {progress.summary.inProgressShifts} ca đang kiểm
                </span>
                <span className="flex items-center gap-1 text-foreground-muted">
                  <Package size={12} /> {progress.session.countedProducts}/{progress.session.totalProducts}{' '}
                  dòng hàng
                </span>
              </div>

              {progress.session.rejectionReason ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Lý do từ chối: {progress.session.rejectionReason}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {!selectedBranchId && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={16} className="mr-2 inline" />
          Chưa chọn chi nhánh. Vui lòng chọn chi nhánh ở menu bên trái để bắt đầu kiểm kho.
        </div>
      )}

      <DataListToolbar
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder="Tìm phiếu kiểm..."
        showColumnToggle={false}
        showFilterToggle={false}
      />

      <DataListTable
        columns={[
          { id: 'week', label: 'Tuần' },
          { id: 'branch', label: 'Chi nhánh' },
          { id: 'status', label: 'Trạng thái' },
          { id: 'progress', label: 'Tiến độ' },
          { id: 'dates', label: 'Thời gian' },
          { id: 'actions', label: 'Thao tác' },
        ]}
        isLoading={isLoading}
        isEmpty={!isLoading && sessions.length === 0}
        emptyText="Chưa có phiếu kiểm kho nào."
      >
        {sessions.map((session: any) => {
          const percent =
            session.totalProducts > 0
              ? Math.round((session.countedProducts / session.totalProducts) * 100)
              : 0

          return (
            <tr
              key={session.id}
              className="border-b border-border/50 transition-colors hover:bg-background-secondary/40"
            >
              <td className="px-3 py-3">
                <span className="font-mono text-sm font-semibold text-primary-500">
                  Tuần {session.weekNumber}/{session.year}
                </span>
              </td>
              <td className="px-3 py-3">
                {session.branch ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs font-semibold text-primary-600">
                    <MapPin size={11} />
                    {session.branch.name}
                    {session.branch.code ? ` (${session.branch.code})` : ''}
                  </span>
                ) : (
                  <span className="text-xs text-foreground-muted">—</span>
                )}
              </td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[session.status]}`}
                >
                  {session.status === 'APPROVED' && <CheckCircle2 size={11} />}
                  {session.status === 'REJECTED' && <XCircle size={11} />}
                  {session.status === 'SUBMITTED' && <Clock size={11} />}
                  {STATUS_LABELS[session.status]}
                </span>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-background-tertiary">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-xs text-foreground-muted">
                    {session.countedProducts}/{session.totalProducts}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 text-sm text-foreground-muted">
                {formatDate(session.startDate)} → {formatDate(session.endDate)}
              </td>
              <td className="px-3 py-3">
                <button
                  onClick={() => router.push(`/inventory/counting/${session.id}`)}
                  className="rounded-lg border border-border bg-background-tertiary px-3 py-1.5 text-xs font-medium hover:bg-border"
                >
                  Chi tiết
                </button>
              </td>
            </tr>
          )
        })}
      </DataListTable>

      <div className="-mt-1">
        <div className="rounded-b-2xl border border-t-0 border-border bg-card/95">
          <DataListPagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            onPageSizeChange={() => {}}
            pageSizeOptions={[10, 20, 50]}
            totalItemText={
              <span className="text-xs">
                Tổng <strong className="text-foreground">{total}</strong> phiếu kiểm
              </span>
            }
          />
        </div>
      </div>
    </DataListShell>
  )
}
