'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { buildProductVariantName, resolveProductVariantLabels } from '@petshop/shared'
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
import { exportMultiSheetToExcel } from '@/lib/excel'
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
  type ServiceRevenueReport,
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
  { id: 'sales', label: 'Bán hàng', icon: TrendingUp, anyPermissions: ['report.sales'] },
  { id: 'customers', label: 'Khách hàng', icon: Users, anyPermissions: ['report.customer'] },
  { id: 'purchase', label: 'Mua hàng', icon: Truck, anyPermissions: ['report.purchase'] },
  { id: 'inventory', label: 'Kho', icon: Package, anyPermissions: ['report.inventory'] },
  { id: 'debt', label: 'Công nợ', icon: Landmark, anyPermissions: ['report.debt'] },
  { id: 'cashbook', label: 'Sổ quỹ', icon: Wallet, anyPermissions: ['report.cashbook'] },
]

const RANGE_OPTIONS: Array<{ label: string; value: RangePreset }> = [
  { label: '7 ngày', value: 7 },
  { label: '30 ngày', value: 30 },
  { label: '90 ngày', value: 90 },
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

function getLowStockVariantLabel(item: LowStockSuggestion) {
  if (!item.variant) return ''
  const labels = resolveProductVariantLabels(item.product?.name, item.variant)
  return buildProductVariantName(null, labels.variantLabel, labels.unitLabel) || item.variant.name || ''
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
      return 'Tùy chọn'
    }
    const rangeOption = RANGE_OPTIONS.find((option) => option.value === presetRange)
    return rangeOption?.label ?? `${rangeDays} ngày`
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

  const replaceSearchParams = useCallback((updates: Record<string, string | null>) => {
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
  }, [pathname, router, searchParams])

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
  }, [activeTab, canAccessReports, dateFrom, dateTo, isAuthLoading, isCustomRange, presetRange, replaceSearchParams, resolvedBranchId, searchParams])

  const [dashboardQuery, revenueQuery, customersQuery, productsQuery, serviceRevenueQuery, cashbookQuery, suppliersQuery, inventoryQuery, customerDebtQuery] = useQueries({
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
        queryKey: ['reports', 'service-revenue', resolvedBranchId || 'all', dateFrom, dateTo],
        queryFn: () => reportsApi.getServiceRevenue({ dateFrom, dateTo }),
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
  const revenuePoints = useMemo(() => revenueQuery.data ?? [], [revenueQuery.data])
  const topCustomers = useMemo(() => customersQuery.data ?? [], [customersQuery.data])
  const topProducts = productsQuery.data ?? []
  const serviceRevenue = (serviceRevenueQuery.data as ServiceRevenueReport | undefined) ?? undefined
  const cashbookSummary = cashbookQuery.data
  const supplierAnalytics = (suppliersQuery.data as SupplierAnalyticsResponse | undefined) ?? undefined
  const inventorySuggestions = useMemo(
    () => (inventoryQuery.data as LowStockSuggestion[] | undefined) ?? [],
    [inventoryQuery.data],
  )
  const debtSummary = (customerDebtQuery.data as ReportsDebtSummary | undefined) ?? undefined
  const customerDebtRows = useMemo(() => debtSummary?.customers ?? [], [debtSummary?.customers])
  const currentBranchName =
    allowedBranches.find((branch) => branch.id === resolvedBranchId)?.name ??
    'Chi nhánh đang chọn'
  const salesKpis = useMemo(() => buildSalesKpis(metrics, revenuePoints), [metrics, revenuePoints])
  const customerKpis = useMemo(() => buildCustomerKpis(metrics, topCustomers), [metrics, topCustomers])
  const activeTabMeta = useMemo(() => {
    switch (activeTab) {
      case 'customers':
        return {
          title: 'Báo cáo khách hàng',
          description: 'Tập trung vào nhóm khách chi tiêu cao, tần suất mua và quy mô tập khách.',
        }
      case 'purchase':
        return {
          title: 'Báo cáo mua hàng',
          description: 'Theo dõi nhà cung cấp, tổng chi mua và điểm cần xử lý trong vận hành nhập hàng.',
        }
      case 'inventory':
        return {
          title: 'Báo cáo kho',
          description: 'Tập trung vào mặt hàng sắp thiếu, mức độ thiếu và chi nhánh đang cần bổ sung.',
        }
      case 'debt':
        return {
          title: 'Báo cáo công nợ',
          description: 'Tổng hợp công nợ khách hàng và nhà cung cấp để ưu tiên thu hồi và đối soát.',
        }
      case 'cashbook':
        return {
          title: 'Báo cáo sổ quỹ',
          description: 'Theo dõi dòng tiền, giao dịch gần nhất và điều hướng sang workspace đối soát chi tiết.',
        }
      case 'sales':
      default:
        return {
          title: 'Báo cáo bán hàng',
          description: 'Đi sâu vào doanh thu theo kỳ, biến động theo ngày và nhóm sản phẩm đóng góp.',
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
          'Hạng': index + 1,
          'Mã KH': item.customer?.customerCode ?? 'KH',
          'Khách hàng': item.customer?.fullName ?? 'Khách lẻ / đã xóa',
          'Số đơn': item.orderCount,
          'Tổng chi tiêu': item.totalSpent,
        }))
      case 'purchase':
        return (supplierAnalytics?.data ?? []).map((supplier, index) => ({
          'Hạng': index + 1,
          'Mã NCC': supplier.code ?? 'NCC',
          'Nhà cung cấp': supplier.name,
          'Tổng phiếu': supplier.stats.totalOrders,
          'Tổng chi': supplier.stats.totalSpent,
          'Công nợ': supplier.stats.totalDebt,
          'Điểm đánh giá': supplier.evaluation.score,
          'Nhận xét': supplier.evaluation.label,
        }))
      case 'inventory':
        return inventorySuggestions.map((item, index) => ({
          'Hạng': index + 1,
          'Sản phẩm': item.product?.name ?? 'Sản phẩm',
          'Biến thể': getLowStockVariantLabel(item),
          'SKU': item.product?.sku ?? 'N/A',
          'Chi nhánh': item.branch?.name ?? '',
          'Tồn hiện tại': item.stock,
          'Min tồn': item.minStock,
          'Thiếu hụt': item.shortage,
        }))
      case 'debt':
        return [
          ...customerDebtRows.map((item, index) => ({
            'Loại': 'Khách hàng',
            'Hạng': index + 1,
            'Mã': item.customerCode ?? 'KH',
            'Tên': item.fullName,
            'Giá trị công nợ': Number(item.debt ?? 0),
            'Ghi chú': `${item.phone ?? 'Chưa có SĐT'} • ${formatNumber(item._count?.orders ?? 0)} đơn`,
          })),
          ...(supplierAnalytics?.data ?? [])
            .filter((supplier) => supplier.stats.totalDebt > 0)
            .map((supplier, index) => ({
              'Loại': 'Nhà cung cấp',
              'Hạng': index + 1,
              'Mã': supplier.code ?? 'NCC',
              'Tên': supplier.name,
              'Giá trị công nợ': supplier.stats.totalDebt,
              'Ghi chú': `${supplier.evaluation.label} • ${formatNumber(supplier.stats.totalOrders)} phiếu`,
            })),
        ]
      case 'cashbook':
        return (cashbookSummary?.transactions ?? []).map((transaction, index) => ({
          'Hạng': index + 1,
          'Số phiếu': transaction.voucherNumber,
          'Loại': transaction.type === 'INCOME' ? 'Thu' : 'Chi',
          'Số tiền': transaction.amount,
          'Mô tả': transaction.description,
          'Nguồn': transaction.source,
          'Thời gian': formatDateTimeForExport(transaction.date),
          'Chi nhánh': transaction.branchName ?? '',
        }))
      case 'sales':
      default:
        return revenuePoints.map((item, index) => ({
          'Hạng': index + 1,
          'Ngày': formatShortDate(item.date),
          'Doanh thu': item.revenue,
          'Doanh thu hôm nay': metrics?.todayRevenue ?? 0,
          'Doanh thu tháng': metrics?.monthRevenue ?? 0,
        }))
    }
  }, [activeTab, cashbookSummary?.transactions, customerDebtRows, inventorySuggestions, metrics?.monthRevenue, metrics?.todayRevenue, revenuePoints, supplierAnalytics?.data, topCustomers])

  const handleExport = async () => {
    if (exportRows.length === 0) return

    const branchSlug = (currentBranchName || 'chi-nhanh')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const fileName = `bao-cao-${activeTab}-${branchSlug || 'chi-nhanh'}-${todayString().replaceAll('-', '')}.xlsx`

    const sheets: Array<{ name: string; rows: Record<string, string | number | boolean | null | undefined>[] }> = [
      { name: 'Báo cáo', rows: exportRows },
    ]

    if (activeTab === 'sales' && serviceRevenue?.details?.length) {
      const serviceRows = serviceRevenue.details.map((item, index) => ({
        '#': index + 1,
        'Order': item.orderNumber,
        'Date': formatShortDate(item.date),
        'Service group': item.type === 'HOTEL' ? 'Hotel' : 'Grooming/SPA',
        'Line': item.label,
        'Package/day type': item.type === 'HOTEL' ? (item.dayType === 'HOLIDAY' ? 'Holiday' : 'Regular') : (item.packageCode ?? ''),
        'Weight band': item.weightBandLabel,
        'Qty/days': item.quantity,
        'Revenue': item.revenue,
      }))
      sheets.push({ name: 'Service revenue', rows: serviceRows })
    }

    await exportMultiSheetToExcel(sheets, fileName)
  }

  if (isAuthLoading) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Đang kiểm tra quyền truy cập...</div>
  }

  if (!canAccessReports) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Đang chuyển hướng...</div>
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
              Xuất XLSX
            </button>
          </div>
        }
      />



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
              serviceRevenue={serviceRevenue}
              kpis={salesKpis}
              isLoading={dashboardQuery.isLoading || revenueQuery.isLoading || productsQuery.isLoading || serviceRevenueQuery.isLoading}
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
  serviceRevenue,
  kpis,
  isLoading,
}: {
  metrics?: DashboardMetrics
  revenuePoints: RevenuePoint[]
  topProducts: TopProduct[]
  serviceRevenue?: ServiceRevenueReport
  kpis: Array<{ label: string; value: string; hint: string; tone: 'primary' | 'emerald' | 'amber' | 'blue' }>
  isLoading: boolean
}) {
  if (isLoading && revenuePoints.length === 0 && topProducts.length === 0) {
    return <LoadingPanel message="Đang tải báo cáo bán hàng..." />
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

      <ServiceRevenuePanel report={serviceRevenue} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionCard title="Biểu đồ doanh thu" description="So sánh biến động doanh thu theo ngày trong kỳ đang chọn.">
            <RevenueChartPanel data={revenuePoints} variant="line" />
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard title="Điểm nhấn trong kỳ" description="Những mốc cần xem kỹ hơn khi đọc báo cáo bán hàng.">
            <div className="space-y-3">
              <InsightRow
                icon={<TrendingUp size={16} className="text-primary-500" />}
                title="Ngày cao nhất"
                value={strongestDay ? `${formatCurrency(strongestDay.revenue)}` : '0'}
                description={strongestDay ? `Đạt đỉnh vào ngày ${formatShortDate(strongestDay.date)}.` : 'Chưa có dữ liệu để xác định.'}
              />
              <InsightRow
                icon={<BarChart3 size={16} className="text-blue-500" />}
                title="Ngày thấp nhất"
                value={weakestDay ? `${formatCurrency(weakestDay.revenue)}` : '0'}
                description={weakestDay ? `Cần đối chiếu ngày ${formatShortDate(weakestDay.date)} để tìm nguyên nhân.` : 'Chưa có dữ liệu để xác định.'}
              />
              <InsightRow
                icon={<Wallet size={16} className="text-emerald-500" />}
                title="Doanh thu ngày gần nhất"
                value={formatCurrency(latestRevenue)}
                description={`Hôm nay: ${formatCurrency(metrics?.todayRevenue ?? 0)} • Tháng này: ${formatCurrency(metrics?.monthRevenue ?? 0)}.`}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionCard title="Sản phẩm / dịch vụ đóng góp doanh thu" description="Xếp hạng theo doanh thu và sản lượng bán.">
            <TopProductsList data={topProducts} showRevenueBar />
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard title="Top ngày doanh thu" description="Danh sách ngày có doanh thu cao nhất trong kỳ.">
            {revenueRows.length > 0 ? (
              <div className="space-y-3">
                {revenueRows.map((row, index) => (
                  <div key={`${row.date}-${index}`} className="rounded-2xl border border-border/50 bg-background-base p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-foreground-base">#{index + 1} {formatShortDate(row.date)}</div>
                        <div className="mt-1 text-xs text-foreground-muted">
                          {strongestDay?.revenue ? `${Math.round((row.revenue / strongestDay.revenue) * 100)}% so với đỉnh kỳ` : 'Chưa có mốc so sánh'}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-primary-500">{formatCurrency(row.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Chưa có dữ liệu theo ngày." />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function ServiceRevenuePanel({ report }: { report?: ServiceRevenueReport }) {
  const summary = report?.summary
  const hasData = Boolean(summary && summary.totalRevenue > 0)

  return (
    <SectionCard
      title="Doanh thu SPA / Hotel theo snapshot"
      description="Đọc từ order items đã chốt, không tính lại theo bảng giá hiện hành."
    >
      {!hasData ? (
        <EmptyState message="Chưa có doanh thu SPA / Hotel trong kỳ đã chọn." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Tổng SPA / Hotel" value={formatCurrency(summary?.totalRevenue ?? 0)} hint={`${formatNumber(summary?.orderCount ?? 0)} đơn có dịch vụ`} tone="primary" />
            <MetricCard label="Hotel" value={formatCurrency(summary?.hotelRevenue ?? 0)} hint={`${formatNumber(summary?.hotelDays ?? 0)} ngày tính phí`} tone="blue" />
            <MetricCard label="Grooming / SPA" value={formatCurrency(summary?.groomingRevenue ?? 0)} hint={`${formatNumber(summary?.groomingQuantity ?? 0)} lượt`} tone="emerald" />
            <MetricCard label="Dòng snapshot" value={formatNumber(summary?.itemCount ?? 0)} hint="Dùng cho đối soát export" tone="amber" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ServiceRevenueGroupList title="Hotel theo ngày thường / ngày lễ" rows={report?.hotel.byDayType ?? []} quantityLabel="ngày" />
            <ServiceRevenueGroupList title="Hotel theo hạng cân" rows={report?.hotel.byWeightBand ?? []} quantityLabel="ngày" />
            <ServiceRevenueGroupList title="SPA theo gói" rows={report?.grooming.byPackage ?? []} quantityLabel="lượt" />
            <ServiceRevenueGroupList title="SPA theo hạng cân" rows={report?.grooming.byWeightBand ?? []} quantityLabel="lượt" />
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function ServiceRevenueGroupList({
  title,
  rows,
  quantityLabel,
}: {
  title: string
  rows: Array<{ key: string; label: string; quantity: number; revenue: number; count: number }>
  quantityLabel: string
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-foreground-muted">
        {title}: chưa có dữ liệu.
      </div>
    )
  }

  const maxRevenue = rows.reduce((current, row) => Math.max(current, row.revenue), 0)

  return (
    <div className="rounded-2xl border border-border/50 bg-background-base p-4">
      <div className="mb-3 text-sm font-bold text-foreground-base">{title}</div>
      <div className="space-y-3">
        {rows.map((row) => {
          const width = maxRevenue > 0 ? Math.max(6, (row.revenue / maxRevenue) * 100) : 0
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-foreground-base">{row.label}</span>
                <span className="font-bold text-primary-500">{formatCurrency(row.revenue)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-foreground-muted">
                <span>{formatNumber(row.quantity)} {quantityLabel}</span>
                <span>{formatNumber(row.count)} dòng</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                <div className="h-full rounded-full bg-primary-500" style={{ width: `${width}%` }} />
              </div>
            </div>
          )
        })}
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
    return <LoadingPanel message="Đang tải báo cáo khách hàng..." />
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
          <SectionCard title="Top khách hàng" description="Bảng xếp hạng khách hàng có tổng chi tiêu cao nhất." action={<Link href={customersHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mở khách hàng</Link>}>
            <TopCustomersList data={topCustomers} showSpendBar />
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard title="Góc nhìn nhanh" description="Chỉ số tham khảo để chốt chương trình chăm sóc khách hàng.">
            <div className="space-y-3">
              <InsightRow
                icon={<Crown size={16} className="text-amber-500" />}
                title="Khách mới tháng này"
                value={formatNumber(metrics?.newCustomersThisMonth ?? 0)}
                description="Nguồn đầu vào mới cho remarketing và nhắc lịch."
              />
              <InsightRow
                icon={<Users size={16} className="text-primary-500" />}
                title="Tổng khách đang lưu"
                value={formatNumber(metrics?.totalCustomers ?? 0)}
                description="Quy mô tập khách có thể tiếp cận lại."
              />
              <InsightRow
                icon={<PiggyBank size={16} className="text-emerald-500" />}
                title="Chi tiêu top 1"
                value={formatCurrency(leadingCustomer?.totalSpent ?? 0)}
                description="Mốc tham chiếu để xây tier và ưu đãi."
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <SectionCard title="Tiếp cận nhóm VIP" description="Tập trung vào quy mô và tần suất mua của nhóm đầu bảng.">
            <div className="grid grid-cols-1 gap-3">
              <MetricCard label="Tổng chi tiêu top nhóm" value={formatCurrency(totalSpent)} hint={`${formatNumber(topCustomers.length)} khách được xếp hạng`} tone="primary" />
              <MetricCard label="Đơn trung bình / khách" value={formatNumber(Math.round(averageOrderPerTopCustomer))} hint={`${formatNumber(totalOrders)} đơn trong nhóm`} tone="blue" />
              <MetricCard label="Khách dẫn đầu" value={leadingCustomer?.customer?.fullName ?? 'Chưa có'} hint={formatCurrency(leadingCustomer?.totalSpent ?? 0)} tone="amber" />
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-3">
          <SectionCard title="Điểm cần hành động" description="Hướng để biến báo cáo thành hành động bán hàng và chăm sóc.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InsightRow
                icon={<Users size={16} className="text-primary-500" />}
                title="Nhắc lịch chăm sóc"
                value={formatNumber(metrics?.newCustomersThisMonth ?? 0)}
                description="Dùng danh sách khách mới làm tệp remarketing 7-14 ngày."
              />
              <InsightRow
                icon={<TrendingUp size={16} className="text-emerald-500" />}
                title="Upsell nhóm đầu"
                value={formatNumber(topCustomers.length)}
                description="Tạo gói ưu đãi riêng cho nhóm có tần suất và chi tiêu cao."
              />
              <InsightRow
                icon={<PiggyBank size={16} className="text-amber-500" />}
                title="Giá trị tham chiếu"
                value={formatCurrency(topCustomers[2]?.totalSpent ?? leadingCustomer?.totalSpent ?? 0)}
                description="Lấy top 3 làm mốc để định tier VIP/thân thiết."
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
    return <LoadingPanel message="Đang tải báo cáo mua hàng..." />
  }

  const suppliers = supplierAnalytics?.data ?? []
  const summary = supplierAnalytics?.summary
  const topSpendSuppliers = suppliers.slice().sort((left, right) => right.stats.totalSpent - left.stats.totalSpent).slice(0, 6)
  const riskSuppliers = suppliers.slice().sort((left, right) => left.evaluation.score - right.evaluation.score).slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng nhà cung cấp" value={formatNumber(summary?.totalSuppliers ?? 0)} hint={`${formatNumber(summary?.activeSuppliers ?? 0)} đang hoạt động`} />
        <MetricCard label="Chi mua theo kỳ" value={formatCurrency(summary?.spendLast30Days ?? 0)} hint="Tổng chi mua trong khoảng ngày đang chọn" tone="blue" />
        <MetricCard label="NCC còn công nợ" value={formatNumber(summary?.suppliersWithDebt ?? 0)} hint={formatCurrency(summary?.totalDebt ?? 0)} tone="amber" />
        <MetricCard label="Điểm đánh giá TB" value={formatNumber(summary?.avgEvaluationScore ?? 0)} hint="Chất lượng quan hệ NCC" tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionCard title="Nhà cung cấp chi mua cao nhất" description="Tập trung vào đối tác đang đóng góp chi mua lớn nhất." action={<Link href={suppliersHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mở nhà cung cấp</Link>}>
            <SupplierSpendList suppliers={topSpendSuppliers} />
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard title="NCC cần theo dõi" description="Sắp xếp theo điểm đánh giá thấp để ưu tiên xử lý.">
            {riskSuppliers.length > 0 ? (
              <div className="space-y-3">
                {riskSuppliers.map((supplier) => (
                  <InsightRow
                    key={supplier.id}
                    icon={<Truck size={16} className="text-amber-500" />}
                    title={supplier.name}
                    value={`${formatNumber(supplier.evaluation.score)}/100`}
                    description={`${supplier.evaluation.label} • Công nợ ${formatCurrency(supplier.stats.totalDebt)}.`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="Chưa có dữ liệu nhà cung cấp." />
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
    return <LoadingPanel message="Đang tải báo cáo kho..." />
  }

  const totalShortage = suggestions.reduce((sum, item) => sum + Math.max(0, item.shortage), 0)
  const zeroStockCount = suggestions.filter((item) => Number(item.stock) <= 0).length
  const affectedBranches = new Set(suggestions.map((item) => item.branch?.name).filter(Boolean)).size
  const sortedSuggestions = suggestions.slice().sort((left, right) => right.shortage - left.shortage)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Mặt hàng cần bổ sung" value={formatNumber(suggestions.length)} hint={`${formatNumber(affectedBranches)} chi nhánh bị ảnh hưởng`} />
        <MetricCard label="Tổng thiếu hụt" value={formatNumber(totalShortage)} hint="Số lượng cần bổ sung tối thiểu" tone="amber" />
        <MetricCard label="Hết hàng" value={formatNumber(zeroStockCount)} hint="Cần xử lý ưu tiên" tone="primary" />
        <MetricCard label="Cảnh báo kho" value={formatNumber(sortedSuggestions[0]?.shortage ?? 0)} hint={sortedSuggestions[0]?.product?.name ?? 'Chưa có'} tone="blue" />
      </div>

      <SectionCard title="Danh sách sắp thiếu hàng" description="Xếp theo mức độ thiếu hụt để nhập kho bổ sung." action={<Link href={inventoryHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mở kho</Link>}>
        {sortedSuggestions.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {sortedSuggestions.slice(0, 12).map((item) => {
              const variantLabel = getLowStockVariantLabel(item)

              return (
              <div key={item.id} className="rounded-2xl border border-border/50 bg-background-base p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground-base">
                      {item.product?.name ?? 'Sản phẩm'}
                      {variantLabel ? ` • ${variantLabel}` : ''}
                    </div>
                    <div className="mt-1 text-xs text-foreground-muted">
                      {(item.product?.sku ?? 'N/A')} • {item.branch?.name ?? 'Chưa rõ chi nhánh'}
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold text-amber-500">Thiếu {formatNumber(item.shortage)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-foreground-muted">
                  <span>Tồn hiện tại: {formatNumber(item.stock)}</span>
                  <span>Min: {formatNumber(item.minStock)}</span>
                </div>
              </div>
              )
            })}
          </div>
        ) : (
          <EmptyState message="Không có mặt hàng cảnh báo trong kho." />
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
    return <LoadingPanel message="Đang tải báo cáo công nợ..." />
  }

  const supplierDebts = (supplierAnalytics?.data ?? []).filter((supplier) => supplier.stats.totalDebt > 0)
  const totalCustomerDebt = customerDebts.reduce((sum, item) => sum + Number(item.debt ?? 0), 0)
  const totalSupplierDebt = supplierDebts.reduce((sum, item) => sum + item.stats.totalDebt, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Công nợ khách hàng" value={formatCurrency(totalCustomerDebt)} hint={`${formatNumber(customerDebts.length)} khách đang nợ`} tone="primary" />
        <MetricCard label="Công nợ nhà cung cấp" value={formatCurrency(totalSupplierDebt)} hint={`${formatNumber(supplierDebts.length)} NCC đang nợ`} tone="amber" />
        <MetricCard label="Tổng đối tượng cần xử lý" value={formatNumber(customerDebts.length + supplierDebts.length)} hint="Danh sách ưu tiên đối soát" tone="blue" />
        <MetricCard label="Cảnh báo lớn nhất" value={formatCurrency(Math.max(customerDebts[0]?.debt ?? 0, supplierDebts[0]?.stats.totalDebt ?? 0))} hint="Giá trị nợ cao nhất hiện tại" tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Khách hàng còn nợ" description="Danh sách khách đang có công nợ lớn nhất." action={canReadCustomerDebt ? <Link href={customersHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mở khách hàng</Link> : undefined}>
          {canReadCustomerDebt ? <CustomerDebtList customers={customerDebts.slice(0, 10)} /> : <EmptyState message="Bạn không có quyền đọc dữ liệu khách hàng." />}
        </SectionCard>

        <SectionCard title="Nhà cung cấp còn nợ" description="Theo dõi NCC đang có công nợ để ưu tiên thanh toán." action={canReadSupplierDebt ? <Link href={suppliersHref} className="text-sm font-semibold text-primary-500 hover:text-primary-400">Mở nhà cung cấp</Link> : undefined}>
          {canReadSupplierDebt ? <SupplierDebtList suppliers={supplierDebts.slice(0, 10)} /> : <EmptyState message="Bạn không có quyền đọc dữ liệu nhà cung cấp." />}
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
    return <LoadingPanel message="Đang tải tổng hợp sổ quỹ..." />
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Tổng hợp dòng tiền"
        description="Trang này giữ vai trò tổng hợp. Khi cần đối soát, sửa phiếu hoặc xem dòng tiền tài khoản, mở sang sổ quỹ."
        action={
          <Link
            href={financeHref}
            className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-500/15"
          >
            Mở sổ quỹ
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
    return <EmptyState message="Chưa có dữ liệu doanh thu trong khoảng thời gian này." />
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
    return <EmptyState message="Chưa có dữ liệu khách hàng nổi bật." />
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
                  #{index + 1} {item.customer?.fullName ?? 'Khách lẻ / đã xóa'}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {(item.customer?.customerCode ?? 'KH')} • {formatNumber(item.orderCount)} đơn
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
    return <EmptyState message="Chưa có dữ liệu sản phẩm bán chạy." />
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
                  #{index + 1} {item.product?.name ?? 'Sản phẩm đã xóa'}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {(item.product?.sku ?? 'N/A')} • {formatNumber(item.totalQuantity)} lượt bán
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
    return <EmptyState message="Chưa có dữ liệu nhà cung cấp để phân tích." />
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
                  {(supplier.code ?? 'NCC')} • {formatNumber(supplier.stats.totalOrders)} phiếu • {formatNumber(supplier.stats.uniqueProducts)} mặt hàng
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
    return <EmptyState message="Không có khách hàng còn công nợ." />
  }

  return (
    <div className="space-y-3">
      {customers.map((customer, index) => (
        <div key={customer.id} className="rounded-2xl border border-border/50 bg-background-base p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground-base">#{index + 1} {customer.fullName}</div>
              <div className="mt-1 text-xs text-foreground-muted">
                {(customer.customerCode ?? 'KH')} • {customer.phone ?? 'Chưa có SĐT'} • {formatNumber(customer._count?.orders ?? 0)} đơn
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
    return <EmptyState message="Không có nhà cung cấp còn công nợ." />
  }

  return (
    <div className="space-y-3">
      {suppliers.map((supplier, index) => (
        <div key={supplier.id} className="rounded-2xl border border-border/50 bg-background-base p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground-base">#{index + 1} {supplier.name}</div>
              <div className="mt-1 text-xs text-foreground-muted">
                {(supplier.code ?? 'NCC')} • {supplier.evaluation.label} • {formatNumber(supplier.stats.totalOrders)} phiếu
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
    return <EmptyState message="Chưa có dữ liệu sổ quỹ trong khoảng thời gian này." />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Số dư đầu kỳ" value={formatCurrency(summary.openingBalance)} tone="blue" />
        <MetricCard label="Tổng thu" value={formatCurrency(summary.totalIncome)} tone="emerald" />
        <MetricCard label="Tổng chi" value={formatCurrency(summary.totalExpense)} tone="amber" />
        <MetricCard label="Số dư cuối kỳ" value={formatCurrency(summary.closingBalance)} />
      </div>

      {!compact ? (
        <div className="space-y-3">
          <div className="text-sm font-bold text-foreground-base">Giao dịch gần nhất</div>
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
            <EmptyState message="Không có giao dịch phù hợp bộ lọc hiện tại." />
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
      label: 'Doanh thu theo kỳ',
      value: formatCurrency(totalRevenue),
      hint: `${formatCompactCurrency(averageRevenue)}/ngày`,
      tone: 'primary' as const,
    },
    {
      label: 'Đỉnh doanh thu ngày',
      value: formatCurrency(bestDayRevenue),
      hint: 'Mốc doanh thu cao nhất',
      tone: 'blue' as const,
    },
    {
      label: 'Doanh thu hôm nay',
      value: formatCurrency(metrics?.todayRevenue ?? 0),
      hint: `${formatNumber(metrics?.todayOrderCount ?? 0)} đơn hôm nay`,
      tone: 'emerald' as const,
    },
    {
      label: 'Doanh thu tháng',
      value: formatCurrency(metrics?.monthRevenue ?? 0),
      hint: `${formatNumber(metrics?.monthOrderCount ?? 0)} đơn trong tháng`,
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
      label: 'Tổng khách hàng',
      value: formatNumber(metrics?.totalCustomers ?? 0),
      hint: `${formatNumber(metrics?.newCustomersThisMonth ?? 0)} mới trong tháng`,
      tone: 'primary' as const,
    },
    {
      label: 'Top spender bình quân',
      value: formatCurrency(averageTopCustomerSpent),
      hint: `${formatNumber(topCustomers.length)} khách nổi bật`,
      tone: 'emerald' as const,
    },
    {
      label: 'Tổng đơn top khách',
      value: formatNumber(topCustomerOrders),
      hint: 'Mốc để so sánh tần suất mua lại',
      tone: 'blue' as const,
    },
    {
      label: 'Chi tiêu top 1',
      value: formatCurrency(topCustomers[0]?.totalSpent ?? 0),
      hint: topCustomers[0]?.customer?.fullName ?? 'Chưa có dữ liệu',
      tone: 'amber' as const,
    },
  ]
}
