'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, CalendarDays, ChevronRight, Crown, Download, Landmark, Package, PiggyBank, TrendingUp, Truck, Users, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as XLSX from 'xlsx'
import { PageHeader } from '@/components/layout/PageLayout'
import { useAuthorization } from '@/hooks/useAuthorization'
import {
  reportsApi,
  type CustomerDebtItem,
  type DashboardMetrics,
  type LowStockSuggestion,
  type ReportsDebtSummary,
  type ReportsCashbookSummary,
  type RevenuePoint,
  type SupplierAnalyticsItem,
  type SupplierAnalyticsResponse,
  type TopCustomer,
  type TopProduct,
} from '@/lib/api/reports.api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

type ReportsTabId = 'sales' | 'customers' | 'purchase' | 'inventory' | 'debt' | 'cashbook'
type RangePreset = 7 | 30 | 90

type TabConfig = {
  id: ReportsTabId
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  anyPermissions: string[]
}

const REPORTS_TABS: TabConfig[] = [
  { id: 'sales', label: 'Ban hang', icon: TrendingUp, anyPermissions: ['report.sales'] },
  { id: 'customers', label: 'Khach hang', icon: Users, anyPermissions: ['report.customer'] },
  { id: 'purchase', label: 'Mua hang', icon: Truck, anyPermissions: ['report.purchase'] },
  { id: 'inventory', label: 'Kho', icon: Package, anyPermissions: ['report.inventory'] },
  { id: 'debt', label: 'Cong no', icon: Landmark, anyPermissions: ['report.debt'] },
  { id: 'cashbook', label: 'So quy', icon: Wallet, anyPermissions: ['report.cashbook'] },
]

const RANGE_OPTIONS: Array<{ label: string; value: RangePreset }> = [
  { label: '7 ngay', value: 7 },
  { label: '30 ngay', value: 30 },
  { label: '90 ngay', value: 90 },
]

const DEFAULT_RANGE: RangePreset = 30

function parseRangePreset(value: string | null): RangePreset | null {
  const parsed = Number(value)
  return RANGE_OPTIONS.some((option) => option.value === parsed) ? (parsed as RangePreset) : null
}

function isValidDateInput(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value))
}

function todayString() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function minusDays(days: number) {
  const now = new Date()
  now.setDate(now.getDate() - days + 1)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function countDaysInclusive(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  return Math.max(diff, 1)
}

function formatDateTimeForExport(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ReportsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-2xl border border-border/60 bg-background-secondary px-3 py-2 shadow-xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="mt-1 text-sm font-bold text-foreground-base">{formatCurrency(Number(payload[0]?.value ?? 0))}</div>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-background-secondary p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground-base">{title}</h2>
          {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  hint,
  tone = 'primary',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'primary' | 'emerald' | 'amber' | 'blue'
}) {
  const palette = {
    primary: 'border-primary-500/15 bg-primary-500/8 text-primary-500',
    emerald: 'border-emerald-500/15 bg-emerald-500/8 text-emerald-500',
    amber: 'border-amber-500/15 bg-amber-500/8 text-amber-500',
    blue: 'border-blue-500/15 bg-blue-500/8 text-blue-500',
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-background-base p-4">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-foreground-muted">{label}</div>
      <div className="mt-3 text-2xl font-extrabold text-foreground-base">{value}</div>
      {hint ? <div className={cn('mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', palette[tone])}>{hint}</div> : null}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-foreground-muted">{message}</div>
}

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-3xl border border-border/60 bg-background-secondary">
      <div className="flex items-center gap-3 text-sm text-foreground-muted">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary-500" />
        {message}
      </div>
    </div>
  )
}

export function ReportsWorkspace() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const activeBranchId = useAuthStore((state) => state.activeBranchId)
  const allowedBranches = useAuthStore((state) => state.allowedBranches)
  const switchBranch = useAuthStore((state) => state.switchBranch)

  const canReadSales = hasPermission('report.sales')
  const canReadCustomers = hasPermission('report.customer')
  const canReadPurchase = hasPermission('report.purchase')
  const canReadInventory = hasPermission('report.inventory')
  const canReadDebt = hasPermission('report.debt')
  const canReadCashbook = hasPermission('report.cashbook')
  const canAccessReports = canReadSales || canReadCustomers || canReadPurchase || canReadInventory || canReadDebt || canReadCashbook

  const visibleTabs = useMemo(
    () =>
      REPORTS_TABS.filter((tab) => {
        switch (tab.id) {
          case 'customers':
            return canReadCustomers
          case 'purchase':
            return canReadPurchase
          case 'inventory':
            return canReadInventory
          case 'debt':
            return canReadDebt
          case 'cashbook':
            return canReadCashbook
          case 'sales':
          default:
            return canReadSales
        }
      }),
    [canReadCashbook, canReadCustomers, canReadDebt, canReadInventory, canReadPurchase, canReadSales],
  )

  const todayValue = useMemo(() => todayString(), [])
  const requestedTab = searchParams.get('tab')
  const requestedRange = searchParams.get('range')
  const requestedDateFrom = searchParams.get('dateFrom')
  const requestedDateTo = searchParams.get('dateTo')
  const requestedBranchId = searchParams.get('branchId')?.trim() ?? ''
  const hasValidCustomRange =
    isValidDateInput(requestedDateFrom) &&
    isValidDateInput(requestedDateTo) &&
    String(requestedDateFrom) <= String(requestedDateTo)
  const activeTab = useMemo<ReportsTabId>(() => {
    if (requestedTab && visibleTabs.some((tab) => tab.id === requestedTab)) {
      return requestedTab as ReportsTabId
    }
    return visibleTabs[0]?.id ?? 'sales'
  }, [requestedTab, visibleTabs])
  const isCustomRange = requestedRange === 'custom' && hasValidCustomRange
  const presetRange = parseRangePreset(requestedRange) ?? DEFAULT_RANGE
  const dateFrom = isCustomRange ? String(requestedDateFrom) : minusDays(presetRange)
  const dateTo = isCustomRange ? String(requestedDateTo) : todayValue
  const rangeDays = isCustomRange ? countDaysInclusive(dateFrom, dateTo) : presetRange
  const resolvedBranchId = useMemo(() => {
    if (requestedBranchId && allowedBranches.some((branch) => branch.id === requestedBranchId)) {
      return requestedBranchId
    }
    return activeBranchId ?? ''
  }, [activeBranchId, allowedBranches, requestedBranchId])
  const isBranchSyncing = Boolean(requestedBranchId && requestedBranchId !== activeBranchId && requestedBranchId === resolvedBranchId)
  const currentFilterLabel = useMemo(() => {
    if (isCustomRange) {
      return 'Tuy chon'
    }
    const rangeOption = RANGE_OPTIONS.find((option) => option.value === presetRange)
    return rangeOption?.label ?? `${rangeDays} ngay`
  }, [isCustomRange, presetRange, rangeDays])
  const detailQueryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('from', 'reports')
    params.set('tab', activeTab)
    params.set('range', isCustomRange ? 'custom' : String(presetRange))
    params.set('dateFrom', dateFrom)
    params.set('dateTo', dateTo)
    if (resolvedBranchId) {
      params.set('branchId', resolvedBranchId)
    }
    return params.toString()
  }, [activeTab, dateFrom, dateTo, isCustomRange, presetRange, resolvedBranchId])
  const detailHref = (path: string) => `${path}?${detailQueryString}`

  const replaceSearchParams = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value)
      } else {
        nextParams.delete(key)
      }
    })

    const nextQuery = nextParams.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    }
  }

  useEffect(() => {
    if (isAuthLoading) return
    if (resolvedBranchId && resolvedBranchId !== activeBranchId) {
      switchBranch(resolvedBranchId)
    }
  }, [activeBranchId, isAuthLoading, resolvedBranchId, switchBranch])

  useEffect(() => {
    if (isAuthLoading) return

    if (!canAccessReports) {
      router.replace('/dashboard')
      return
    }
  }, [canAccessReports, isAuthLoading, router])

  useEffect(() => {
    if (isAuthLoading || !canAccessReports) return

    const expectedRange = isCustomRange ? 'custom' : String(presetRange)
    const expectedBranchId = resolvedBranchId || null
    const shouldNormalize =
      searchParams.get('tab') !== activeTab ||
      searchParams.get('range') !== expectedRange ||
      searchParams.get('dateFrom') !== dateFrom ||
      searchParams.get('dateTo') !== dateTo ||
      (searchParams.get('branchId') ?? null) !== expectedBranchId

    if (shouldNormalize) {
      replaceSearchParams({
        tab: activeTab,
        range: expectedRange,
        dateFrom,
        dateTo,
        branchId: expectedBranchId,
      })
    }
  }, [activeTab, canAccessReports, dateFrom, dateTo, isAuthLoading, isCustomRange, presetRange, resolvedBranchId, searchParams])

  const [dashboardQuery, revenueQuery, customersQuery, productsQuery, cashbookQuery, suppliersQuery, inventoryQuery, customerDebtQuery] = useQueries({
    queries: [
      {
        queryKey: ['reports', 'dashboard', resolvedBranchId || 'all'],
        queryFn: reportsApi.getDashboard,
        enabled: canAccessReports && !isBranchSyncing,
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'revenue-chart', resolvedBranchId || 'all', dateFrom, dateTo],
        queryFn: () => reportsApi.getRevenueChart({ days: rangeDays, dateFrom, dateTo }),
        enabled: canReadSales && !isBranchSyncing,
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'top-customers', resolvedBranchId || 'all', dateFrom, dateTo],
        queryFn: () => reportsApi.getTopCustomers(8, { dateFrom, dateTo }),
        enabled: canReadCustomers && !isBranchSyncing,
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'top-products', resolvedBranchId || 'all', dateFrom, dateTo],
        queryFn: () => reportsApi.getTopProducts(8, { dateFrom, dateTo }),
        enabled: canReadSales && !isBranchSyncing,
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'cashbook-summary', resolvedBranchId || 'all', dateFrom, dateTo],
        queryFn: () =>
          reportsApi.getCashbookSummary({
            dateFrom,
            dateTo,
            limit: 5,
          }),
        enabled: canReadCashbook && !isBranchSyncing,
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'purchase-summary', resolvedBranchId || 'all', dateFrom, dateTo],
        queryFn: () => reportsApi.getPurchaseSummary({ dateFrom, dateTo }),
        enabled: (canReadPurchase || canReadDebt) && !isBranchSyncing,
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'inventory-health', resolvedBranchId || 'all'],
        queryFn: reportsApi.getInventoryHealth,
        enabled: canReadInventory && !isBranchSyncing,
        staleTime: 60_000,
      },
      {
        queryKey: ['reports', 'debt-summary', resolvedBranchId || 'all', dateFrom, dateTo],
        queryFn: () => reportsApi.getDebtSummary(100, { dateFrom, dateTo }),
        enabled: canReadDebt && !isBranchSyncing,
        staleTime: 60_000,
      },
    ],
  })

  const metrics = dashboardQuery.data
  const revenuePoints = revenueQuery.data ?? []
  const topCustomers = customersQuery.data ?? []
  const topProducts = productsQuery.data ?? []
  const cashbookSummary = cashbookQuery.data
  const supplierAnalytics = (suppliersQuery.data as SupplierAnalyticsResponse | undefined) ?? undefined
  const inventorySuggestions = (inventoryQuery.data as LowStockSuggestion[] | undefined) ?? []
  const debtSummary = (customerDebtQuery.data as ReportsDebtSummary | undefined) ?? undefined
  const customerDebtRows = debtSummary?.customers ?? []
  const currentBranchName =
    allowedBranches.find((branch) => branch.id === resolvedBranchId)?.name ??
    'Chi nhanh dang chon'
  const salesKpis = useMemo(() => buildSalesKpis(metrics, revenuePoints), [metrics, revenuePoints])
  const customerKpis = useMemo(() => buildCustomerKpis(metrics, topCustomers), [metrics, topCustomers])
  const activeTabMeta = useMemo(() => {
    switch (activeTab) {
      case 'customers':
        return {
          title: 'Bao cao khach hang',
          description: 'Tap trung vao nhom khach chi tieu cao, tan suat mua va quy mo tap khach.',
        }
      case 'purchase':
        return {
          title: 'Bao cao mua hang',
          description: 'Theo doi nha cung cap, tong chi mua va diem can xu ly trong van hanh nhap hang.',
        }
      case 'inventory':
        return {
          title: 'Bao cao kho',
          description: 'Tap trung vao mat hang sap thieu, muc do thieu va chi nhanh dang can bo sung.',
        }
      case 'debt':
        return {
          title: 'Bao cao cong no',
          description: 'Tong hop cong no khach hang va nha cung cap de uu tien thu hoi va doi soat.',
        }
      case 'cashbook':
        return {
          title: 'Bao cao so quy',
          description: 'Theo doi dong tien, giao dich gan nhat va dieu huong sang workspace doi soat chi tiet.',
        }
      case 'sales':
      default:
        return {
          title: 'Bao cao ban hang',
          description: 'Di sau vao doanh thu theo ky, bien dong theo ngay va nhom san pham dong gop.',
        }
    }
  }, [activeTab])

  const handleSelectRangePreset = (value: RangePreset) => {
    replaceSearchParams({
      range: String(value),
      dateFrom: minusDays(value),
      dateTo: todayValue,
    })
  }

  const handleCustomDateFromChange = (value: string) => {
    const nextDateTo = isValidDateInput(value) && value > dateTo ? value : dateTo
    replaceSearchParams({
      range: 'custom',
      dateFrom: value,
      dateTo: nextDateTo,
    })
  }

  const handleCustomDateToChange = (value: string) => {
    const nextDateFrom = isValidDateInput(value) && value < dateFrom ? value : dateFrom
    replaceSearchParams({
      range: 'custom',
      dateFrom: nextDateFrom,
      dateTo: value,
    })
  }

  const exportRows = useMemo(() => {
    switch (activeTab) {
      case 'customers':
        return topCustomers.map((item, index) => ({
          'Hang': index + 1,
          'Ma KH': item.customer?.customerCode ?? 'KH',
          'Khach hang': item.customer?.fullName ?? 'Khach le / da xoa',
          'So don': item.orderCount,
          'Tong chi tieu': item.totalSpent,
        }))
      case 'purchase':
        return (supplierAnalytics?.data ?? []).map((supplier, index) => ({
          'Hang': index + 1,
          'Ma NCC': supplier.code ?? 'NCC',
          'Nha cung cap': supplier.name,
          'Tong phieu': supplier.stats.totalOrders,
          'Tong chi': supplier.stats.totalSpent,
          'Cong no': supplier.stats.totalDebt,
          'Diem danh gia': supplier.evaluation.score,
          'Nhan xet': supplier.evaluation.label,
        }))
      case 'inventory':
        return inventorySuggestions.map((item, index) => ({
          'Hang': index + 1,
          'San pham': item.product?.name ?? 'San pham',
          'Bien the': item.variant?.name ?? '',
          'SKU': item.product?.sku ?? 'N/A',
          'Chi nhanh': item.branch?.name ?? '',
          'Ton hien tai': item.stock,
          'Min ton': item.minStock,
          'Thieu hut': item.shortage,
        }))
      case 'debt':
        return [
          ...customerDebtRows.map((item, index) => ({
            'Loai': 'Khach hang',
            'Hang': index + 1,
            'Ma': item.customerCode ?? 'KH',
            'Ten': item.fullName,
            'Gia tri cong no': Number(item.debt ?? 0),
            'Ghi chu': `${item.phone ?? 'Chua co SDT'} • ${formatNumber(item._count?.orders ?? 0)} don`,
          })),
          ...(supplierAnalytics?.data ?? [])
            .filter((supplier) => supplier.stats.totalDebt > 0)
            .map((supplier, index) => ({
              'Loai': 'Nha cung cap',
              'Hang': index + 1,
              'Ma': supplier.code ?? 'NCC',
              'Ten': supplier.name,
              'Gia tri cong no': supplier.stats.totalDebt,
              'Ghi chu': `${supplier.evaluation.label} • ${formatNumber(supplier.stats.totalOrders)} phieu`,
            })),
        ]
      case 'cashbook':
        return (cashbookSummary?.transactions ?? []).map((transaction, index) => ({
          'Hang': index + 1,
          'So phieu': transaction.voucherNumber,
          'Loai': transaction.type === 'INCOME' ? 'Thu' : 'Chi',
          'So tien': transaction.amount,
          'Mo ta': transaction.description,
          'Nguon': transaction.source,
          'Thoi gian': formatDateTimeForExport(transaction.date),
          'Chi nhanh': transaction.branchName ?? '',
        }))
      case 'sales':
      default:
        return revenuePoints.map((item, index) => ({
          'Hang': index + 1,
          'Ngay': formatShortDate(item.date),
          'Doanh thu': item.revenue,
          'Doanh thu hom nay': metrics?.todayRevenue ?? 0,
          'Doanh thu thang': metrics?.monthRevenue ?? 0,
        }))
    }
  }, [activeTab, cashbookSummary?.transactions, customerDebtRows, inventorySuggestions, metrics?.monthRevenue, metrics?.todayRevenue, revenuePoints, supplierAnalytics?.data, topCustomers])

  const handleExport = () => {
    if (exportRows.length === 0) return

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bao cao')
    const branchSlug = (currentBranchName || 'chi-nhanh')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const fileName = `bao-cao-${activeTab}-${branchSlug || 'chi-nhanh'}-${todayString().replaceAll('-', '')}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang kiem tra quyen truy cap...</div>
  }

  if (!canAccessReports) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Dang chuyen huong...</div>
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title={activeTabMeta.title}
        description={activeTabMeta.description}
        icon={BarChart3}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {allowedBranches.length > 1 ? (
              <select
                value={resolvedBranchId}
                onChange={(event) => {
                  const nextBranchId = event.target.value
                  switchBranch(nextBranchId)
                  replaceSearchParams({ branchId: nextBranchId || null })
                }}
                className="rounded-full border border-border/60 bg-background-secondary px-4 py-2 text-sm font-semibold text-foreground-base outline-none transition-colors hover:border-border"
              >
                {allowedBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelectRangePreset(option.value)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                  !isCustomRange && rangeDays === option.value
                    ? 'border-primary-500/40 bg-primary-500/10 text-primary-500'
                    : 'border-border/60 bg-background-secondary text-foreground-muted hover:border-border hover:text-foreground-base',
                )}
              >
                {option.label}
              </button>
            ))}
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background-secondary px-3 py-2">
              <CalendarDays size={14} className="text-primary-500" />
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(event) => handleCustomDateFromChange(event.target.value)}
                className="min-w-[132px] bg-transparent text-sm font-semibold text-foreground-base outline-none"
              />
              <span className="text-foreground-muted">-</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={todayValue}
                onChange={(event) => handleCustomDateToChange(event.target.value)}
                className="min-w-[132px] bg-transparent text-sm font-semibold text-foreground-base outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportRows.length === 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                exportRows.length > 0
                  ? 'border-primary-500/30 bg-primary-500/10 text-primary-500 hover:bg-primary-500/15'
                  : 'cursor-not-allowed border-border/50 bg-background-secondary text-foreground-muted',
              )}
            >
              <Download size={16} />
              Xuat XLSX
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background-secondary px-4 py-3 text-sm text-foreground-muted">
        <span className="rounded-full border border-border/60 bg-background-base px-3 py-1.5 font-semibold text-foreground-base">
          Chi nhanh: {currentBranchName}
        </span>
        <span className="rounded-full border border-border/60 bg-background-base px-3 py-1.5">
          Ky: {currentFilterLabel}
        </span>
        <span className="rounded-full border border-border/60 bg-background-base px-3 py-1.5">
          Tu {formatShortDate(dateFrom)} den {formatShortDate(dateTo)}
        </span>
      </div>

      {visibleTabs.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background-secondary p-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => replaceSearchParams({ tab: tab.id })}
                className={cn(
                  'relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                  isActive ? 'text-white' : 'text-foreground-muted hover:text-foreground-base',
                )}
              >
                {isActive ? (
                  <motion.div
                    layoutId="reports-tab-bg"
                    className="absolute inset-0 rounded-xl bg-primary-500 shadow-md shadow-primary-500/20"
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
                  />
                ) : null}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={16} />
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="space-y-6"
        >
          {activeTab === 'sales' ? (
            <SalesTab
              metrics={metrics}
              revenuePoints={revenuePoints}
              topProducts={topProducts}
              kpis={salesKpis}
              isLoading={dashboardQuery.isLoading || revenueQuery.isLoading || productsQuery.isLoading}
            />
          ) : null}

          {activeTab === 'customers' ? (
            <CustomersTab
              metrics={metrics}
              topCustomers={topCustomers}
              kpis={customerKpis}
              customersHref={detailHref('/customers')}
              isLoading={dashboardQuery.isLoading || customersQuery.isLoading}
            />
          ) : null}

          {activeTab === 'purchase' ? (
            <PurchaseTab
              supplierAnalytics={supplierAnalytics}
              suppliersHref={detailHref('/inventory/suppliers')}
              isLoading={suppliersQuery.isLoading}
            />
          ) : null}

          {activeTab === 'inventory' ? (
            <InventoryTab
              suggestions={inventorySuggestions}
              inventoryHref={detailHref('/inventory/stock')}
              isLoading={inventoryQuery.isLoading}
            />
          ) : null}

          {activeTab === 'debt' ? (
            <DebtTab
              customerDebts={customerDebtRows}
              supplierAnalytics={supplierAnalytics}
              canReadCustomerDebt
              canReadSupplierDebt
              customersHref={detailHref('/customers')}
              suppliersHref={detailHref('/inventory/suppliers')}
              isLoading={customerDebtQuery.isLoading || suppliersQuery.isLoading}
            />
          ) : null}

          {activeTab === 'cashbook' ? (
            <CashbookTab
              summary={cashbookSummary}
              financeHref={detailHref('/finance')}
              isLoading={cashbookQuery.isLoading}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function SalesTab({
  metrics,
  revenuePoints,
  topProducts,
  kpis,
  isLoading,
}: {
  metrics?: DashboardMetrics
  revenuePoints: RevenuePoint[]
  topProducts: TopProduct[]
  kpis: Array<{ label: string; value: string; hint: string; tone: 'primary' | 'emerald' | 'amber' | 'blue' }>
  isLoading: boolean
}) {
  if (isLoading && revenuePoints.length === 0 && topProducts.length === 0) {
    return <LoadingPanel message="Dang tai bao cao ban hang..." />
  }

  const strongestDay = revenuePoints.reduce<RevenuePoint | null>(
    (best, item) => (!best || item.revenue > best.revenue ? item : best),
    null,
  )
  const weakestDay = revenuePoints.reduce<RevenuePoint | null>(
    (worst, item) => (!worst || item.revenue < worst.revenue ? item : worst),
    null,
  )
  const latestRevenue = revenuePoints.at(-1)?.revenue ?? 0
  const revenueRows = revenuePoints
    .slice()
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <MetricCard key={item.label} label={item.label} value={item.value} hint={item.hint} tone={item.tone} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionCard title="Bieu do doanh thu" description="So sanh bien dong doanh thu theo ngay trong ky dang chon.">
            <RevenueChartPanel data={revenuePoints} variant="line" />
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard title="Diem nhan trong ky" description="Nhung moc can xem ky hon khi doc bao cao ban hang.">
            <div className="space-y-3">
              <InsightRow
                icon={<TrendingUp size={16} className="text-primary-500" />}
                title="Ngay cao nhat"
                value={strongestDay ? `${formatCurrency(strongestDay.revenue)}` : '0'}
                description={strongestDay ? `Dat dinh vao ngay ${formatShortDate(strongestDay.date)}.` : 'Chua co du lieu de xac dinh.'}
              />
              <InsightRow
                icon={<BarChart3 size={16} className="text-blue-500" />}
                title="Ngay thap nhat"
                value={weakestDay ? `${formatCurrency(weakestDay.revenue)}` : '0'}
                description={weakestDay ? `Can doi chieu ngay ${formatShortDate(weakestDay.date)} de tim nguyen nhan.` : 'Chua co du lieu de xac dinh.'}
              />
              <InsightRow
                icon={<Wallet size={16} className="text-emerald-500" />}
                title="Doanh thu ngay gan nhat"
                value={formatCurrency(latestRevenue)}
                description={`Hom nay: ${formatCurrency(metrics?.todayRevenue ?? 0)} • Thang nay: ${formatCurrency(metrics?.monthRevenue ?? 0)}.`}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionCard title="San pham / dich vu dong gop doanh thu" description="Xep hang theo doanh thu va san luong ban.">
            <TopProductsList data={topProducts} showRevenueBar />
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard title="Top ngay doanh thu" description="Danh sach ngay co doanh thu cao nhat trong ky.">
            {revenueRows.length > 0 ? (
              <div className="space-y-3">
                {revenueRows.map((row, index) => (
                  <div key={`${row.date}-${index}`} className="rounded-2xl border border-border/50 bg-background-base p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-foreground-base">#{index + 1} {formatShortDate(row.date)}</div>
                        <div className="mt-1 text-xs text-foreground-muted">
                          {strongestDay?.revenue ? `${Math.round((row.revenue / strongestDay.revenue) * 100)}% so voi dinh ky` : 'Chua co moc so sanh'}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-primary-500">{formatCurrency(row.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Chua co du lieu theo ngay." />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function CustomersTab({
  metrics,
  topCustomers,
  kpis,
  customersHref,
  isLoading,
}: {
  metrics?: DashboardMetrics
  topCustomers: TopCustomer[]
  kpis: Array<{ label: string; value: string; hint: string; tone: 'primary' | 'emerald' | 'amber' | 'blue' }>
  customersHref: string
  isLoading: boolean
}) {
  if (isLoading && topCustomers.length === 0) {
    return <LoadingPanel message="Dang tai bao cao khach hang..." />
  }

  const leadingCustomer = topCustomers[0] ?? null
  const totalOrders = topCustomers.reduce((sum, item) => sum + item.orderCount, 0)
  const totalSpent = topCustomers.reduce((sum, item) => sum + item.totalSpent, 0)
  const averageOrderPerTopCustomer = topCustomers.length > 0 ? totalOrders / topCustomers.length : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <MetricCard key={item.label} label={item.label} value={item.value} hint={item.hint} tone={item.tone} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionCard title="Top khach hang" description="Bang xep hang khach hang co tong chi tieu cao nhat." action={<Link href={customersHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mo khach hang</Link>}>
            <TopCustomersList data={topCustomers} showSpendBar />
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard title="Goc nhin nhanh" description="Chi so tham khao de chot chuong trinh cham soc khach hang.">
            <div className="space-y-3">
              <InsightRow
                icon={<Crown size={16} className="text-amber-500" />}
                title="Khach moi thang nay"
                value={formatNumber(metrics?.newCustomersThisMonth ?? 0)}
                description="Nguon dau vao moi cho remarketing va nhac lich."
              />
              <InsightRow
                icon={<Users size={16} className="text-primary-500" />}
                title="Tong khach dang luu"
                value={formatNumber(metrics?.totalCustomers ?? 0)}
                description="Quy mo tap khach co the tiep can lai."
              />
              <InsightRow
                icon={<PiggyBank size={16} className="text-emerald-500" />}
                title="Chi tieu top 1"
                value={formatCurrency(leadingCustomer?.totalSpent ?? 0)}
                description="Moc tham chieu de xay tier va uu dai."
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <SectionCard title="Tiep can nhom VIP" description="Tap trung vao quy mo va tan suat mua cua nhom dau bang.">
            <div className="grid grid-cols-1 gap-3">
              <MetricCard label="Tong chi tieu top nhom" value={formatCurrency(totalSpent)} hint={`${formatNumber(topCustomers.length)} khach duoc xep hang`} tone="primary" />
              <MetricCard label="Don trung binh / khach" value={formatNumber(Math.round(averageOrderPerTopCustomer))} hint={`${formatNumber(totalOrders)} don trong nhom`} tone="blue" />
              <MetricCard label="Khach dan dau" value={leadingCustomer?.customer?.fullName ?? 'Chua co'} hint={formatCurrency(leadingCustomer?.totalSpent ?? 0)} tone="amber" />
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-3">
          <SectionCard title="Diem can hanh dong" description="Huong de bien bao cao thanh hanh dong ban hang va cham soc.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InsightRow
                icon={<Users size={16} className="text-primary-500" />}
                title="Nhac lich cham soc"
                value={formatNumber(metrics?.newCustomersThisMonth ?? 0)}
                description="Dung danh sach khach moi lam tap remarketing 7-14 ngay."
              />
              <InsightRow
                icon={<TrendingUp size={16} className="text-emerald-500" />}
                title="Upsell nhom dau"
                value={formatNumber(topCustomers.length)}
                description="Tao goi uu dai rieng cho nhom co tan suat va chi tieu cao."
              />
              <InsightRow
                icon={<PiggyBank size={16} className="text-amber-500" />}
                title="Gia tri tham chieu"
                value={formatCurrency(topCustomers[2]?.totalSpent ?? leadingCustomer?.totalSpent ?? 0)}
                description="Lay top 3 lam moc de dinh tier VIP/than thiet."
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function PurchaseTab({
  supplierAnalytics,
  suppliersHref,
  isLoading,
}: {
  supplierAnalytics?: SupplierAnalyticsResponse
  suppliersHref: string
  isLoading: boolean
}) {
  if (isLoading && !supplierAnalytics) {
    return <LoadingPanel message="Dang tai bao cao mua hang..." />
  }

  const suppliers = supplierAnalytics?.data ?? []
  const summary = supplierAnalytics?.summary
  const topSpendSuppliers = suppliers.slice().sort((left, right) => right.stats.totalSpent - left.stats.totalSpent).slice(0, 6)
  const riskSuppliers = suppliers.slice().sort((left, right) => left.evaluation.score - right.evaluation.score).slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tong nha cung cap" value={formatNumber(summary?.totalSuppliers ?? 0)} hint={`${formatNumber(summary?.activeSuppliers ?? 0)} dang hoat dong`} />
        <MetricCard label="Chi mua theo ky" value={formatCurrency(summary?.spendLast30Days ?? 0)} hint="Tong chi mua trong khoang ngay dang chon" tone="blue" />
        <MetricCard label="NCC con cong no" value={formatNumber(summary?.suppliersWithDebt ?? 0)} hint={formatCurrency(summary?.totalDebt ?? 0)} tone="amber" />
        <MetricCard label="Diem danh gia TB" value={formatNumber(summary?.avgEvaluationScore ?? 0)} hint="Chat luong quan he NCC" tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionCard title="Nha cung cap chi mua cao nhat" description="Tap trung vao doi tac dang dong gop chi mua lon nhat." action={<Link href={suppliersHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mo nha cung cap</Link>}>
            <SupplierSpendList suppliers={topSpendSuppliers} />
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard title="NCC can theo doi" description="Sap xep theo diem danh gia thap de uu tien xu ly.">
            {riskSuppliers.length > 0 ? (
              <div className="space-y-3">
                {riskSuppliers.map((supplier) => (
                  <InsightRow
                    key={supplier.id}
                    icon={<Truck size={16} className="text-amber-500" />}
                    title={supplier.name}
                    value={`${formatNumber(supplier.evaluation.score)}/100`}
                    description={`${supplier.evaluation.label} • Cong no ${formatCurrency(supplier.stats.totalDebt)}.`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="Chua co du lieu nha cung cap." />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function InventoryTab({
  suggestions,
  inventoryHref,
  isLoading,
}: {
  suggestions: LowStockSuggestion[]
  inventoryHref: string
  isLoading: boolean
}) {
  if (isLoading && suggestions.length === 0) {
    return <LoadingPanel message="Dang tai bao cao kho..." />
  }

  const totalShortage = suggestions.reduce((sum, item) => sum + Math.max(0, item.shortage), 0)
  const zeroStockCount = suggestions.filter((item) => Number(item.stock) <= 0).length
  const affectedBranches = new Set(suggestions.map((item) => item.branch?.name).filter(Boolean)).size
  const sortedSuggestions = suggestions.slice().sort((left, right) => right.shortage - left.shortage)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Mat hang can bo sung" value={formatNumber(suggestions.length)} hint={`${formatNumber(affectedBranches)} chi nhanh bi anh huong`} />
        <MetricCard label="Tong thieu hut" value={formatNumber(totalShortage)} hint="So luong can bo sung toi thieu" tone="amber" />
        <MetricCard label="Het hang" value={formatNumber(zeroStockCount)} hint="Can xu ly uu tien" tone="primary" />
        <MetricCard label="Canh bao kho" value={formatNumber(sortedSuggestions[0]?.shortage ?? 0)} hint={sortedSuggestions[0]?.product?.name ?? 'Chua co'} tone="blue" />
      </div>

      <SectionCard title="Danh sach sap thieu hang" description="Xep theo muc do thieu hut de doi kho bo sung." action={<Link href={inventoryHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mo kho</Link>}>
        {sortedSuggestions.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {sortedSuggestions.slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/50 bg-background-base p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground-base">
                      {item.product?.name ?? 'San pham'}
                      {item.variant?.name ? ` • ${item.variant.name}` : ''}
                    </div>
                    <div className="mt-1 text-xs text-foreground-muted">
                      {(item.product?.sku ?? 'N/A')} • {item.branch?.name ?? 'Chua ro chi nhanh'}
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold text-amber-500">Thieu {formatNumber(item.shortage)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-foreground-muted">
                  <span>Ton hien tai: {formatNumber(item.stock)}</span>
                  <span>Min: {formatNumber(item.minStock)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Khong co mat hang canh bao trong kho." />
        )}
      </SectionCard>
    </div>
  )
}

function DebtTab({
  customerDebts,
  supplierAnalytics,
  canReadCustomerDebt,
  canReadSupplierDebt,
  customersHref,
  suppliersHref,
  isLoading,
}: {
  customerDebts: CustomerDebtItem[]
  supplierAnalytics?: SupplierAnalyticsResponse
  canReadCustomerDebt: boolean
  canReadSupplierDebt: boolean
  customersHref: string
  suppliersHref: string
  isLoading: boolean
}) {
  if (isLoading && customerDebts.length === 0 && !supplierAnalytics) {
    return <LoadingPanel message="Dang tai bao cao cong no..." />
  }

  const supplierDebts = (supplierAnalytics?.data ?? []).filter((supplier) => supplier.stats.totalDebt > 0)
  const totalCustomerDebt = customerDebts.reduce((sum, item) => sum + Number(item.debt ?? 0), 0)
  const totalSupplierDebt = supplierDebts.reduce((sum, item) => sum + item.stats.totalDebt, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cong no khach hang" value={formatCurrency(totalCustomerDebt)} hint={`${formatNumber(customerDebts.length)} khach dang no`} tone="primary" />
        <MetricCard label="Cong no nha cung cap" value={formatCurrency(totalSupplierDebt)} hint={`${formatNumber(supplierDebts.length)} NCC dang no`} tone="amber" />
        <MetricCard label="Tong doi tuong can xu ly" value={formatNumber(customerDebts.length + supplierDebts.length)} hint="Danh sach uu tien doi soat" tone="blue" />
        <MetricCard label="Canh bao lon nhat" value={formatCurrency(Math.max(customerDebts[0]?.debt ?? 0, supplierDebts[0]?.stats.totalDebt ?? 0))} hint="Gia tri no cao nhat hien tai" tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Khach hang con no" description="Danh sach khach dang co cong no lon nhat." action={canReadCustomerDebt ? <Link href={customersHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mo khach hang</Link> : undefined}>
          {canReadCustomerDebt ? <CustomerDebtList customers={customerDebts.slice(0, 10)} /> : <EmptyState message="Ban khong co quyen doc du lieu khach hang." />}
        </SectionCard>

        <SectionCard title="Nha cung cap con no" description="Theo doi NCC dang co cong no de uu tien thanh toan." action={canReadSupplierDebt ? <Link href={suppliersHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mo nha cung cap</Link> : undefined}>
          {canReadSupplierDebt ? <SupplierDebtList suppliers={supplierDebts.slice(0, 10)} /> : <EmptyState message="Ban khong co quyen doc du lieu nha cung cap." />}
        </SectionCard>
      </div>
    </div>
  )
}

function CashbookTab({
  summary,
  financeHref,
  isLoading,
}: {
  summary?: ReportsCashbookSummary
  financeHref: string
  isLoading: boolean
}) {
  if (isLoading && !summary) {
    return <LoadingPanel message="Dang tai tong hop so quy..." />
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Tong hop dong tien"
        description="Trang nay giu vai tro tong hop. Khi can doi soat, sua phieu hoac xem dong tien tai khoan, mo sang so quy."
        action={
          <Link
            href={financeHref}
            className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-500/15"
          >
            Mo so quy
            <ChevronRight size={16} />
          </Link>
        }
      >
        <CashbookSummaryPanel summary={summary} />
      </SectionCard>
    </div>
  )
}

function RevenueChartPanel({
  data,
  variant = 'bar',
}: {
  data: RevenuePoint[]
  variant?: 'bar' | 'line'
}) {
  if (data.length === 0) {
    return <EmptyState message="Chua co du lieu doanh thu trong khoang thoi gian nay." />
  }

  const chartData = data.map((item) => ({
    label: formatShortDate(item.date),
    revenue: item.revenue,
  }))

  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        {variant === 'bar' ? (
          <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" opacity={0.08} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} className="text-foreground-muted" />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-foreground-muted"
              tickFormatter={(value) => formatCompactCurrency(Number(value))}
            />
            <Tooltip content={<ReportsTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }} />
            <Bar dataKey="revenue" fill="rgb(16 185 129)" radius={[10, 10, 0, 0]} maxBarSize={48} />
          </BarChart>
        ) : (
          <RechartsLineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" opacity={0.08} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} className="text-foreground-muted" />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-foreground-muted"
              tickFormatter={(value) => formatCompactCurrency(Number(value))}
            />
            <Tooltip content={<ReportsTooltip />} />
            <Line type="monotone" dataKey="revenue" stroke="rgb(59 130 246)" strokeWidth={3} dot={false} />
          </RechartsLineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function TopCustomersList({
  data,
  showSpendBar = false,
}: {
  data: TopCustomer[]
  showSpendBar?: boolean
}) {
  if (data.length === 0) {
    return <EmptyState message="Chua co du lieu khach hang noi bat." />
  }

  const maxSpent = data.reduce((current, item) => Math.max(current, item.totalSpent), 0)

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const width = maxSpent > 0 ? (item.totalSpent / maxSpent) * 100 : 0
        return (
          <div key={item.customer?.id ?? `customer-${index}`} className="rounded-2xl border border-border/50 bg-background-base p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground-base">
                  #{index + 1} {item.customer?.fullName ?? 'Khach le / da xoa'}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {(item.customer?.customerCode ?? 'KH')} • {formatNumber(item.orderCount)} don
                </div>
              </div>
              <div className="text-right text-sm font-bold text-primary-500">{formatCurrency(item.totalSpent)}</div>
            </div>
            {showSpendBar ? (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                <div className="h-full rounded-full bg-primary-500" style={{ width: `${width}%` }} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function TopProductsList({
  data,
  showRevenueBar = false,
}: {
  data: TopProduct[]
  showRevenueBar?: boolean
}) {
  if (data.length === 0) {
    return <EmptyState message="Chua co du lieu san pham ban chay." />
  }

  const maxRevenue = data.reduce((current, item) => Math.max(current, item.totalRevenue), 0)

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {data.map((item, index) => {
        const width = maxRevenue > 0 ? (item.totalRevenue / maxRevenue) * 100 : 0
        return (
          <div key={item.product?.id ?? `product-${index}`} className="rounded-2xl border border-border/50 bg-background-base p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground-base">
                  #{index + 1} {item.product?.name ?? 'San pham da xoa'}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {(item.product?.sku ?? 'N/A')} • {formatNumber(item.totalQuantity)} luot ban
                </div>
              </div>
              <div className="text-right text-sm font-bold text-emerald-500">{formatCurrency(item.totalRevenue)}</div>
            </div>
            {showRevenueBar ? (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function SupplierSpendList({ suppliers }: { suppliers: SupplierAnalyticsItem[] }) {
  if (suppliers.length === 0) {
    return <EmptyState message="Chua co du lieu nha cung cap de phan tich." />
  }

  const maxSpent = suppliers.reduce((current, item) => Math.max(current, item.stats.totalSpent), 0)

  return (
    <div className="space-y-3">
      {suppliers.map((supplier, index) => {
        const width = maxSpent > 0 ? (supplier.stats.totalSpent / maxSpent) * 100 : 0
        return (
          <div key={supplier.id} className="rounded-2xl border border-border/50 bg-background-base p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground-base">#{index + 1} {supplier.name}</div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {(supplier.code ?? 'NCC')} • {formatNumber(supplier.stats.totalOrders)} phieu • {formatNumber(supplier.stats.uniqueProducts)} mat hang
                </div>
              </div>
              <div className="text-right text-sm font-bold text-primary-500">{formatCurrency(supplier.stats.totalSpent)}</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CustomerDebtList({ customers }: { customers: CustomerDebtItem[] }) {
  if (customers.length === 0) {
    return <EmptyState message="Khong co khach hang con cong no." />
  }

  return (
    <div className="space-y-3">
      {customers.map((customer, index) => (
        <div key={customer.id} className="rounded-2xl border border-border/50 bg-background-base p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground-base">#{index + 1} {customer.fullName}</div>
              <div className="mt-1 text-xs text-foreground-muted">
                {(customer.customerCode ?? 'KH')} • {customer.phone ?? 'Chua co SDT'} • {formatNumber(customer._count?.orders ?? 0)} don
              </div>
            </div>
            <div className="text-right text-sm font-bold text-rose-500">{formatCurrency(Number(customer.debt ?? 0))}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SupplierDebtList({ suppliers }: { suppliers: SupplierAnalyticsItem[] }) {
  if (suppliers.length === 0) {
    return <EmptyState message="Khong co nha cung cap con cong no." />
  }

  return (
    <div className="space-y-3">
      {suppliers.map((supplier, index) => (
        <div key={supplier.id} className="rounded-2xl border border-border/50 bg-background-base p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground-base">#{index + 1} {supplier.name}</div>
              <div className="mt-1 text-xs text-foreground-muted">
                {(supplier.code ?? 'NCC')} • {supplier.evaluation.label} • {formatNumber(supplier.stats.totalOrders)} phieu
              </div>
            </div>
            <div className="text-right text-sm font-bold text-amber-500">{formatCurrency(supplier.stats.totalDebt)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CashbookSummaryPanel({
  summary,
  compact = false,
}: {
  summary?: ReportsCashbookSummary
  compact?: boolean
}) {
  if (!summary) {
    return <EmptyState message="Chua co du lieu so quy trong khoang thoi gian nay." />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="So du dau ky" value={formatCurrency(summary.openingBalance)} tone="blue" />
        <MetricCard label="Tong thu" value={formatCurrency(summary.totalIncome)} tone="emerald" />
        <MetricCard label="Tong chi" value={formatCurrency(summary.totalExpense)} tone="amber" />
        <MetricCard label="So du cuoi ky" value={formatCurrency(summary.closingBalance)} />
      </div>

      {!compact ? (
        <div className="space-y-3">
          <div className="text-sm font-bold text-foreground-base">Giao dich gan nhat</div>
          {summary.transactions.length > 0 ? (
            summary.transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-background-base p-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground-base">{transaction.voucherNumber}</div>
                  <div className="mt-1 text-sm text-foreground-muted">{transaction.description}</div>
                  <div className="mt-2 text-xs text-foreground-muted">
                    {formatShortDate(transaction.date)} • {transaction.source}
                    {transaction.branchName ? ` • ${transaction.branchName}` : ''}
                  </div>
                </div>
                <div className={cn('text-sm font-bold', transaction.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500')}>
                  {transaction.type === 'INCOME' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </div>
              </div>
            ))
          ) : (
            <EmptyState message="Khong co giao dich phu hop bo loc hien tai." />
          )}
        </div>
      ) : null}
    </div>
  )
}

function InsightRow({
  icon,
  title,
  value,
  description,
}: {
  icon: React.ReactNode
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background-base p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground-base">{title}</div>
          <div className="mt-1 text-lg font-bold text-foreground-base">{value}</div>
        </div>
      </div>
      <div className="mt-3 text-sm text-foreground-muted">{description}</div>
    </div>
  )
}

function buildSalesKpis(metrics: DashboardMetrics | undefined, revenuePoints: RevenuePoint[]) {
  const totalRevenue = revenuePoints.reduce((sum, item) => sum + item.revenue, 0)
  const averageRevenue = revenuePoints.length > 0 ? totalRevenue / revenuePoints.length : 0
  const bestDayRevenue = revenuePoints.reduce((best, item) => Math.max(best, item.revenue), 0)

  return [
    {
      label: 'Doanh thu theo ky',
      value: formatCurrency(totalRevenue),
      hint: `${formatCompactCurrency(averageRevenue)}/ngay`,
      tone: 'primary' as const,
    },
    {
      label: 'Dinh doanh thu ngay',
      value: formatCurrency(bestDayRevenue),
      hint: 'Moc doanh thu cao nhat',
      tone: 'blue' as const,
    },
    {
      label: 'Doanh thu hom nay',
      value: formatCurrency(metrics?.todayRevenue ?? 0),
      hint: `${formatNumber(metrics?.todayOrderCount ?? 0)} don hom nay`,
      tone: 'emerald' as const,
    },
    {
      label: 'Doanh thu thang',
      value: formatCurrency(metrics?.monthRevenue ?? 0),
      hint: `${formatNumber(metrics?.monthOrderCount ?? 0)} don trong thang`,
      tone: 'amber' as const,
    },
  ]
}

function buildCustomerKpis(metrics: DashboardMetrics | undefined, topCustomers: TopCustomer[]) {
  const totalTopCustomerSpent = topCustomers.reduce((sum, item) => sum + item.totalSpent, 0)
  const averageTopCustomerSpent = topCustomers.length > 0 ? totalTopCustomerSpent / topCustomers.length : 0
  const topCustomerOrders = topCustomers.reduce((sum, item) => sum + item.orderCount, 0)

  return [
    {
      label: 'Tong khach hang',
      value: formatNumber(metrics?.totalCustomers ?? 0),
      hint: `${formatNumber(metrics?.newCustomersThisMonth ?? 0)} moi trong thang`,
      tone: 'primary' as const,
    },
    {
      label: 'Top spender binh quan',
      value: formatCurrency(averageTopCustomerSpent),
      hint: `${formatNumber(topCustomers.length)} khach noi bat`,
      tone: 'emerald' as const,
    },
    {
      label: 'Tong don top khach',
      value: formatNumber(topCustomerOrders),
      hint: 'Moc de so sanh tan suat mua lai',
      tone: 'blue' as const,
    },
    {
      label: 'Chi tieu top 1',
      value: formatCurrency(topCustomers[0]?.totalSpent ?? 0),
      hint: topCustomers[0]?.customer?.fullName ?? 'Chua co du lieu',
      tone: 'amber' as const,
    },
  ]
}
