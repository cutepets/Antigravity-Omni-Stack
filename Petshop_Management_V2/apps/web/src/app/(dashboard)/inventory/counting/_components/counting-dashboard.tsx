'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { stockCountApi } from '@/lib/api/stock-count.api'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import {
  DataListShell,
  DataListToolbar,
  DataListTable,
  DataListPagination,
  useDataListCore,
} from '@/components/data-list'

// Helpers
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
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { start: monday, end: saturday }
}

function formatDate(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
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

  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const allowedBranches = useAuthStore((s) => s.allowedBranches)

  const scopedBranchId = searchParams.get('branchId')?.trim() || ''
  const selectedBranchId = scopedBranchId || activeBranchId || ''

  const currentWeek = getWeekNumber(new Date())
  const currentYear = new Date().getFullYear()

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['stock-count-sessions', selectedBranchId, page, pageSize],
    queryFn: () => stockCountApi.getSessions({
      branchId: selectedBranchId,
      page,
      limit: pageSize,
    }),
    enabled: !!selectedBranchId,
  })

  const sessions = (sessionsData as any)?.data?.data ?? []
  const total = (sessionsData as any)?.data?.total ?? 0
  const totalPages = (sessionsData as any)?.data?.totalPages ?? 1

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + sessions.length)

  const handleCreateSession = () => {
    const { start, end } = getWeekDates(new Date())
    const weekNum = getWeekNumber(new Date())
    const year = new Date().getFullYear()

    // TODO: Call API to create session
    alert(
      `Tạo phiếu kiểm tuần ${weekNum}/${year}\nTừ: ${formatDate(start)} → Đến: ${formatDate(end)}\n\n(Tính năng đang phát triển)`,
    )
  }

  return (
    <DataListShell>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Kiểm kho theo Ca</h2>
          <p className="text-sm text-foreground-muted">
            Chia nhỏ kiểm kho theo ca, đảm bảo chính xác và khách quan
          </p>
        </div>
        <button
          onClick={handleCreateSession}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
        >
          <Plus size={16} /> Tạo phiếu kiểm tuần
        </button>
      </div>

      {/* Current Week Progress Card */}
      {selectedBranchId && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays size={16} className="text-primary-500" />
              Tuần {currentWeek}/{currentYear} ({formatDate(getWeekDates(new Date()).start)} →{' '}
              {formatDate(getWeekDates(new Date()).end)})
            </div>
            <div className="text-xs text-foreground-muted">
              Chi nhánh: <span className="font-semibold text-foreground">
                {allowedBranches.find((b) => b.id === selectedBranchId)?.name ?? selectedBranchId}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-xs text-foreground-muted">
                <span>Tiến độ</span>
                <span>0%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-background-tertiary">
                <div className="h-full w-0 rounded-full bg-primary-500 transition-all" />
              </div>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={12} /> 0 ca
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <Clock size={12} /> 0 ca
              </span>
              <span className="flex items-center gap-1 text-foreground-muted">
                <Package size={12} /> 0/24 ca
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No branch warning */}
      {!selectedBranchId && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={16} className="inline mr-2" />
          Chưa chọn chi nhánh. Vui lòng chọn chi nhánh ở menu bên trái để bắt đầu kiểm kho.
        </div>
      )}

      {/* Toolbar */}
      <DataListToolbar
        searchValue=""
        onSearchChange={() => { }}
        searchPlaceholder="Tìm phiếu kiểm..."
        showColumnToggle={false}
        showFilterToggle={false}
      />

      {/* Table */}
      <DataListTable
        columns={[
          { id: 'week', label: 'Tuần' },
          { id: 'status', label: 'Trạng thái' },
          { id: 'progress', label: 'Tiến độ' },
          { id: 'dates', label: 'Thời gian' },
          { id: 'actions', label: 'Thao tác' },
        ]}
        isLoading={isLoading}
        isEmpty={!isLoading && sessions.length === 0}
        emptyText="Chưa có phiếu kiểm kho nào."
      >
        {sessions.map((session: any) => (
          <tr key={session.id} className="border-b border-border/50 transition-colors hover:bg-background-secondary/40">
            <td className="px-3 py-3">
              <span className="font-mono text-sm font-semibold text-primary-500">
                Tuần {session.weekNumber}/{session.year}
              </span>
            </td>
            <td className="px-3 py-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[session.status]}`}>
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
                    style={{
                      width: `${session.totalProducts > 0 ? Math.round((session.countedProducts / session.totalProducts) * 100) : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-foreground-muted">
                  {session.countedProducts}/{session.totalProducts}
                </span>
              </div>
            </td>
            <td className="px-3 py-3 text-sm text-foreground-muted">
              {session.startDate ? formatDate(new Date(session.startDate)) : '—'}
            </td>
            <td className="px-3 py-3">
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/inventory/counting/${session.id}`)}
                  className="text-xs font-medium bg-background-tertiary hover:bg-border px-3 py-1.5 rounded-lg border border-border"
                >
                  Chi tiết
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataListTable>

      {/* Pagination */}
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
            onPageSizeChange={() => { }}
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
