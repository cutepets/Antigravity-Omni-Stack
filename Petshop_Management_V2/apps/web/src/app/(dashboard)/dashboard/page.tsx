'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Package,
  PawPrint,
  ReceiptText,
  RefreshCw,
  Scissors,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { reportsApi, type ReportsOverview } from '@/lib/api/reports.api'
import { cn } from '@/lib/utils'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useAuthStore } from '@/stores/auth.store'

type RangePreset = 'today' | 'week' | 'month' | 'year' | 'custom'

type RangeOption = {
  value: RangePreset
  label: string
}

const RANGE_OPTIONS: RangeOption[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'year', label: 'Năm nay' },
  { value: 'custom', label: 'Tùy chọn' },
]

const pad = (value: number) => String(value).padStart(2, '0')

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getPresetRange(preset: RangePreset) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'today') {
    return { dateFrom: toDateInput(today), dateTo: toDateInput(today) }
  }

  if (preset === 'week') {
    const day = today.getDay() || 7
    const start = new Date(today)
    start.setDate(today.getDate() - day + 1)
    return { dateFrom: toDateInput(start), dateTo: toDateInput(today) }
  }

  if (preset === 'year') {
    return { dateFrom: toDateInput(new Date(today.getFullYear(), 0, 1)), dateTo: toDateInput(today) }
  }

  return { dateFrom: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: toDateInput(today) }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value))
}

function SectionPanel({
  title,
  icon: Icon,
  children,
  action,
  className,
}: {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('glass-panel rounded-2xl p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground-base">
          <Icon size={17} className="text-primary-500" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  tone: 'primary' | 'blue' | 'emerald' | 'amber' | 'rose'
}) {
  const tones = {
    primary: 'bg-primary-500 text-white shadow-primary-500/25',
    blue: 'bg-blue-500 text-white shadow-blue-500/25',
    emerald: 'bg-emerald-500 text-white shadow-emerald-500/25',
    amber: 'bg-amber-500 text-white shadow-amber-500/25',
    rose: 'bg-rose-500 text-white shadow-rose-500/25',
  }

  return (
    <div className="glass-panel min-h-[128px] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground-muted">{label}</p>
          <p className="mt-3 truncate text-2xl font-extrabold text-foreground-base">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg', tones[tone])}>
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold text-foreground-secondary">{hint}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background-base/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground-muted">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-foreground-base">{value}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-foreground-muted">
      {message}
    </div>
  )
}

function OverviewTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/60 bg-background-secondary px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-foreground-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground-base">{formatCurrency(Number(payload[0]?.value ?? 0))}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { roleCode, hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const allowedBranches = useAuthStore((state) => state.allowedBranches)
  const activeBranchId = useAuthStore((state) => state.activeBranchId)
  const canUseAllBranches = roleCode === 'SUPER_ADMIN' || roleCode === 'ADMIN' || hasPermission('branch.access.all')
  const [rangePreset, setRangePreset] = useState<RangePreset>('month')
  const presetRange = useMemo(() => getPresetRange(rangePreset === 'custom' ? 'month' : rangePreset), [rangePreset])
  const [customRange, setCustomRange] = useState(presetRange)
  const [branchId, setBranchId] = useState(canUseAllBranches ? 'all' : activeBranchId ?? '')
  const effectiveRange = rangePreset === 'custom' ? customRange : presetRange
  const selectedBranchId = canUseAllBranches && branchId === 'all' ? undefined : branchId || activeBranchId || undefined

  useEffect(() => {
    if (rangePreset !== 'custom') {
      setCustomRange(presetRange)
    }
  }, [presetRange, rangePreset])

  useEffect(() => {
    if (canUseAllBranches) {
      setBranchId((current) => current || 'all')
      return
    }

    if (!branchId || !allowedBranches.some((branch) => branch.id === branchId)) {
      setBranchId(activeBranchId ?? allowedBranches[0]?.id ?? '')
    }
  }, [activeBranchId, allowedBranches, branchId, canUseAllBranches])

  const overviewQuery = useQuery({
    queryKey: ['reports', 'overview', selectedBranchId ?? 'all', effectiveRange.dateFrom, effectiveRange.dateTo],
    queryFn: () =>
      reportsApi.getOverview({
        dateFrom: effectiveRange.dateFrom,
        dateTo: effectiveRange.dateTo,
        branchId: selectedBranchId,
      }),
    enabled: !isAuthLoading,
    staleTime: 60_000,
  })

  const overview = overviewQuery.data
  const chartData = useMemo(
    () =>
      (overview?.revenueSeries ?? []).map((point) => ({
        label: formatShortDate(point.date),
        revenue: point.revenue,
      })),
    [overview?.revenueSeries],
  )
  const isStaffView = overview?.scope.role === 'STAFF'
  const kpis = buildKpis(overview, isStaffView)

  return (
    <div className="flex w-full flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="sticky top-0 z-20 -mx-1 flex min-h-[55px] items-center justify-end bg-transparent py-1">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {(canUseAllBranches || allowedBranches.length > 1) ? (
              <select
                value={canUseAllBranches ? branchId : selectedBranchId ?? ''}
                onChange={(event) => setBranchId(event.target.value)}
                className="h-9 rounded-lg border-0 bg-background-secondary px-3 text-sm font-semibold text-foreground-base outline-none"
              >
                {canUseAllBranches ? <option value="all">Tất cả chi nhánh</option> : null}
                {allowedBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}

            <div className="flex h-9 flex-wrap items-center bg-transparent">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRangePreset(option.value)}
                  className={cn(
                    'h-9 rounded-lg px-3 text-sm font-semibold transition-colors',
                    rangePreset === option.value
                      ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
                      : 'text-foreground-muted hover:text-foreground-base',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {rangePreset === 'custom' ? (
              <div className="flex h-9 items-center gap-2 rounded-lg bg-background-secondary px-3">
                <CalendarDays size={15} className="text-primary-500" />
                <input
                  type="date"
                  value={customRange.dateFrom}
                  max={customRange.dateTo}
                  onChange={(event) => setCustomRange((current) => ({ ...current, dateFrom: event.target.value }))}
                  className="w-32 bg-transparent text-sm font-semibold outline-none"
                />
                <span className="text-foreground-muted">-</span>
                <input
                  type="date"
                  value={customRange.dateTo}
                  min={customRange.dateFrom}
                  max={toDateInput(new Date())}
                  onChange={(event) => setCustomRange((current) => ({ ...current, dateTo: event.target.value }))}
                  className="w-32 bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => overviewQuery.refetch()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border-0 bg-background-secondary px-3 text-sm font-semibold text-foreground-secondary hover:text-foreground-base"
            >
              <RefreshCw size={15} className={cn(overviewQuery.isFetching && 'animate-spin')} />
              {overviewQuery.isFetching ? 'Đang cập nhật' : 'Cập nhật'}
            </button>
          </div>
      </div>

      {overviewQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="glass-panel h-32 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : overviewQuery.isError ? (
        <SectionPanel title="Không tải được tổng quan" icon={AlertTriangle}>
          <p className="text-sm text-foreground-secondary">Vui lòng kiểm tra quyền truy cập hoặc thử cập nhật lại.</p>
        </SectionPanel>
      ) : overview ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionPanel title="Doanh thu theo thời gian" icon={TrendingUp} className="xl:col-span-2">
              <div className="h-[340px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: 'var(--color-foreground-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: 'var(--color-foreground-muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatCompactCurrency(Number(value))}
                      />
                      <Tooltip content={<OverviewTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="revenue" fill="var(--color-primary-500)" radius={[10, 10, 3, 3]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState message="Chưa có doanh thu trong khoảng thời gian này" />
                )}
              </div>
            </SectionPanel>

            <SectionPanel title="Cần xử lý ngay" icon={AlertTriangle}>
              <div className="space-y-3">
                {overview.workQueue.length > 0 ? (
                  overview.workQueue.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center justify-between rounded-xl border border-border/50 bg-background-base/60 px-4 py-3 transition-colors hover:border-primary-500/40 hover:bg-primary-500/5"
                    >
                      <span className="text-sm font-semibold text-foreground-base">{item.label}</span>
                      <span className="rounded-lg bg-primary-500/10 px-2.5 py-1 text-sm font-bold text-primary-500">
                        {formatNumber(item.value)}
                      </span>
                    </Link>
                  ))
                ) : (
                  <EmptyState message="Không có cảnh báo cần xử lý" />
                )}
              </div>
            </SectionPanel>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
            <SectionPanel title="Bán hàng / POS" icon={ReceiptText}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Đơn hàng" value={formatNumber(overview.kpis.orderCount)} />
                <MiniStat label="TB đơn" value={formatCurrency(overview.kpis.avgOrderValue)} />
              </div>
              <TopProductsList overview={overview} />
            </SectionPanel>

            <SectionPanel title="Spa & Hotel" icon={Scissors}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Spa chờ" value={formatNumber(overview.services.pendingGrooming)} />
                <MiniStat label="Đang làm" value={formatNumber(overview.services.inProgressGrooming)} />
                <MiniStat label="Hotel lưu trú" value={formatNumber(overview.services.activeHotelStays)} />
                <MiniStat label="Hotel đặt trước" value={formatNumber(overview.services.bookedHotelStays)} />
              </div>
              {overview.services.revenue ? (
                <p className="mt-4 rounded-xl bg-primary-500/10 px-3 py-2 text-sm font-semibold text-primary-500">
                  Doanh thu dịch vụ: {formatCurrency(overview.services.revenue.totalRevenue)}
                </p>
              ) : null}
            </SectionPanel>

            <SectionPanel title="Khách hàng" icon={Users}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Khách mới" value={formatNumber(overview.customers.newCustomers)} />
                <MiniStat label="Top khách" value={formatNumber(overview.customers.topCustomers.length)} />
              </div>
              <TopCustomersList overview={overview} />
            </SectionPanel>

            <SectionPanel title="Kho & mua hàng" icon={Package}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Sắp thiếu" value={formatNumber(overview.inventory.totalItems)} />
                <MiniStat label="Hết hàng" value={formatNumber(overview.inventory.outOfStockCount)} />
              </div>
              {overview.purchase ? (
                <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-500">
                  Nợ NCC: {formatCurrency(overview.purchase.totalDebt)}
                </p>
              ) : (
                <p className="mt-4 text-sm text-foreground-muted">Ẩn dữ liệu mua hàng theo quyền truy cập.</p>
              )}
            </SectionPanel>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionPanel title="Top sản phẩm / dịch vụ" icon={Package}>
              <TopProductsList overview={overview} expanded />
            </SectionPanel>

            <SectionPanel title="Top khách hàng" icon={Users}>
              <TopCustomersList overview={overview} expanded />
            </SectionPanel>

            {overview.cashbook ? (
              <SectionPanel title="Sổ quỹ gần nhất" icon={Wallet}>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <MiniStat label="Thu" value={formatCurrency(overview.cashbook.totalIncome)} />
                  <MiniStat label="Chi" value={formatCurrency(overview.cashbook.totalExpense)} />
                </div>
                <CompactTransactions overview={overview} />
              </SectionPanel>
            ) : (
              <SectionPanel title={isStaffView ? 'Việc của tôi' : 'Tóm tắt công nợ'} icon={isStaffView ? ClipboardList : CircleDollarSign}>
                {isStaffView ? (
                  <div className="space-y-3">
                    <MiniStat label="Việc vận hành" value={formatNumber(overview.kpis.serviceOpenCount)} />
                    <MiniStat label="Cảnh báo chi nhánh" value={formatNumber(overview.kpis.alertCount)} />
                    <p className="text-sm text-foreground-muted">
                      Dashboard nhân viên đang giới hạn dữ liệu nhạy cảm, tập trung vào việc cần xử lý trong chi nhánh.
                    </p>
                  </div>
                ) : overview.debt ? (
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Nợ khách" value={formatCurrency(overview.debt.totalCustomerDebt)} />
                    <MiniStat label="Nợ NCC" value={formatCurrency(overview.debt.totalSupplierDebt)} />
                    <MiniStat label="KH nợ" value={formatNumber(overview.debt.customersWithDebt)} />
                    <MiniStat label="NCC nợ" value={formatNumber(overview.debt.suppliersWithDebt)} />
                  </div>
                ) : (
                  <EmptyState message="Không có quyền xem dữ liệu tài chính" />
                )}
              </SectionPanel>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function buildKpis(overview: ReportsOverview | undefined, isStaffView: boolean) {
  return [
    {
      label: isStaffView ? 'Đơn trong chi nhánh' : 'Doanh thu kỳ này',
      value: isStaffView ? formatNumber(overview?.kpis.orderCount ?? 0) : formatCurrency(overview?.kpis.revenue ?? 0),
      hint: isStaffView ? 'Theo phạm vi chi nhánh được phép' : `${formatNumber(overview?.kpis.orderCount ?? 0)} đơn đã thanh toán`,
      icon: isStaffView ? ReceiptText : CircleDollarSign,
      tone: 'primary' as const,
    },
    {
      label: 'Đơn hàng',
      value: formatNumber(overview?.kpis.orderCount ?? 0),
      hint: `Trung bình ${formatCurrency(overview?.kpis.avgOrderValue ?? 0)}/đơn`,
      icon: ReceiptText,
      tone: 'blue' as const,
    },
    {
      label: 'Khách mới',
      value: formatNumber(overview?.kpis.newCustomers ?? 0),
      hint: 'Khách phát sinh trong kỳ lọc',
      icon: Users,
      tone: 'emerald' as const,
    },
    {
      label: 'Dịch vụ đang xử lý',
      value: formatNumber(overview?.kpis.serviceOpenCount ?? 0),
      hint: 'Spa đang chờ/làm và Hotel lưu trú',
      icon: PawPrint,
      tone: 'amber' as const,
    },
    {
      label: 'Cảnh báo vận hành',
      value: formatNumber(overview?.kpis.alertCount ?? 0),
      hint: 'Tồn kho, dịch vụ, công nợ cần theo dõi',
      icon: AlertTriangle,
      tone: 'rose' as const,
    },
  ]
}

function TopProductsList({ overview, expanded = false }: { overview: ReportsOverview; expanded?: boolean }) {
  const products = overview.sales?.topProducts?.slice(0, expanded ? 5 : 3) ?? []
  if (!products.length) return <EmptyState message="Chưa có dữ liệu sản phẩm" />

  return (
    <div className="mt-4 space-y-3">
      {products.map((item, index) => (
        <div key={item.product?.id ?? index} className="flex items-center justify-between gap-3 rounded-xl bg-background-base/60 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground-base">
              #{index + 1} {item.product?.name ?? 'Sản phẩm đã xóa'}
            </p>
            <p className="text-xs text-foreground-muted">{item.product?.sku ?? 'N/A'} • {formatNumber(item.totalQuantity)} lượt</p>
          </div>
          <p className="shrink-0 text-sm font-bold text-primary-500">{formatCurrency(item.totalRevenue)}</p>
        </div>
      ))}
    </div>
  )
}

function TopCustomersList({ overview, expanded = false }: { overview: ReportsOverview; expanded?: boolean }) {
  const customers = overview.customers.topCustomers.slice(0, expanded ? 5 : 3)
  if (!customers.length) return <EmptyState message="Chưa có dữ liệu khách hàng" />

  return (
    <div className="mt-4 space-y-3">
      {customers.map((item, index) => (
        <div key={item.customer?.id ?? index} className="flex items-center justify-between gap-3 rounded-xl bg-background-base/60 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground-base">
              #{index + 1} {item.customer?.fullName ?? 'Khách lẻ / đã xóa'}
            </p>
            <p className="text-xs text-foreground-muted">{item.customer?.customerCode ?? 'KH'} • {formatNumber(item.orderCount)} đơn</p>
          </div>
          <p className="shrink-0 text-sm font-bold text-primary-500">{formatCurrency(item.totalSpent)}</p>
        </div>
      ))}
    </div>
  )
}

function CompactTransactions({ overview }: { overview: ReportsOverview }) {
  const transactions = overview.cashbook?.transactions?.slice(0, 5) ?? []
  if (!transactions.length) return <EmptyState message="Chưa có giao dịch sổ quỹ" />

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="rounded-xl bg-background-base/60 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-bold text-foreground-base">{transaction.description}</p>
            <p className={cn('shrink-0 text-sm font-bold', transaction.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500')}>
              {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
            </p>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">{transaction.voucherNumber} • {formatShortDate(transaction.date)}</p>
        </div>
      ))}
    </div>
  )
}
