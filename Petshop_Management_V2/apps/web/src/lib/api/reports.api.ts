import { api } from '@/lib/api'

export type DashboardMetrics = {
  todayRevenue: number
  todayOrderCount: number
  monthRevenue: number
  monthOrderCount: number
  totalCustomers: number
  newCustomersThisMonth: number
  lowStockCount: number
  pendingGrooming: number
  activeHotelStays: number
}

export type RevenuePoint = {
  date: string
  revenue: number
}

export type TopCustomer = {
  customer: {
    id: string
    fullName: string
    phone?: string
    customerCode?: string
  } | null
  totalSpent: number
  orderCount: number
}

export type TopProduct = {
  product: {
    id: string
    name: string
    sku?: string
  } | null
  totalQuantity: number
  totalRevenue: number
}

export type ServiceRevenueGroup = {
  key: string
  label: string
  quantity: number
  revenue: number
  count: number
}

export type ServiceRevenueDetail = {
  type: 'HOTEL' | 'GROOMING'
  orderNumber: string
  date: string
  label: string
  packageCode?: string | null
  dayType?: 'REGULAR' | 'HOLIDAY' | null
  weightBandLabel: string
  quantity: number
  revenue: number
}

export type ServiceRevenueReport = {
  summary: {
    totalRevenue: number
    hotelRevenue: number
    groomingRevenue: number
    hotelDays: number
    groomingQuantity: number
    orderCount: number
    itemCount: number
  }
  hotel: {
    byDayType: ServiceRevenueGroup[]
    byWeightBand: ServiceRevenueGroup[]
  }
  grooming: {
    byPackage: ServiceRevenueGroup[]
    byWeightBand: ServiceRevenueGroup[]
  }
  details: ServiceRevenueDetail[]
}

export type ReportsCashbookSummary = {
  transactions: Array<{
    id: string
    voucherNumber: string
    type: 'INCOME' | 'EXPENSE'
    amount: number
    description: string
    date: string
    source: string
    payerName?: string | null
    branchName?: string | null
  }>
  total: number
  openingBalance: number
  totalIncome: number
  totalExpense: number
  closingBalance: number
}

export type SupplierAnalyticsSummary = {
  totalSuppliers: number
  activeSuppliers: number
  suppliersWithDebt: number
  totalDebt: number
  spendLast30Days: number
  avgEvaluationScore: number
}

export type SupplierAnalyticsItem = {
  id: string
  code?: string | null
  name: string
  phone?: string | null
  debt?: number
  stats: {
    totalOrders: number
    totalSpent: number
    totalDebt: number
    spendLast30Days: number
    avgOrderValue: number
    lastOrderAt?: string | null
    uniqueProducts: number
  }
  evaluation: {
    score: number
    label: string
    summary: string
    debtRatio?: number
  }
}

export type SupplierAnalyticsResponse = {
  data: SupplierAnalyticsItem[]
  summary: SupplierAnalyticsSummary
}

export type LowStockSuggestion = {
  id: string
  stock: number
  minStock: number
  shortage: number
  branch?: {
    id: string
    name: string
  } | null
  product?: {
    id: string
    name: string
    sku?: string | null
    unit?: string | null
  } | null
  variant?: {
    id: string
    name: string
    variantLabel?: string | null
    unitLabel?: string | null
  } | null
}

export type CustomerDebtItem = {
  id: string
  fullName: string
  customerCode?: string | null
  phone?: string | null
  debt?: number | null
  totalSpent?: number | null
  branchId?: string | null
  _count?: {
    orders?: number
    hotelStays?: number
  }
}

export type ReportsDebtSummary = {
  customers: CustomerDebtItem[]
  suppliers: SupplierAnalyticsItem[]
  summary: {
    totalCustomerDebt: number
    totalSupplierDebt: number
    customersWithDebt: number
    suppliersWithDebt: number
    highestDebt: number
  }
}

export type ReportsOverview = {
  scope: {
    requestedBranchId: string | null
    scopedBranchIds: string[] | null
    isAllBranches: boolean
    role: string
    canViewSensitive: boolean
  }
  range: {
    dateFrom: string
    dateTo: string
  }
  visibility: {
    sales: boolean
    customers: boolean
    inventory: boolean
    cashbook: boolean
    debt: boolean
    purchase: boolean
  }
  kpis: {
    revenue: number
    orderCount: number
    avgOrderValue: number
    newCustomers: number
    serviceOpenCount: number
    alertCount: number
  }
  revenueSeries: RevenuePoint[]
  services: {
    pendingGrooming: number
    inProgressGrooming: number
    activeHotelStays: number
    bookedHotelStays: number
    revenue: ServiceRevenueReport['summary'] | null
  }
  inventory: {
    totalItems: number
    outOfStockCount: number
    totalShortage: number
    affectedBranches: number
    items: LowStockSuggestion[]
  }
  sales?: {
    topProducts: TopProduct[]
  }
  customers: {
    newCustomers: number
    topCustomers: TopCustomer[]
  }
  cashbook?: ReportsCashbookSummary
  debt?: ReportsDebtSummary['summary']
  purchase?: SupplierAnalyticsSummary
  workQueue: Array<{
    id: string
    label: string
    value: number
    href: string
    tone: string
  }>
}

type CashbookSummaryParams = {
  dateFrom?: string
  dateTo?: string
  limit?: number
}

type ReportRangeParams = {
  dateFrom?: string
  dateTo?: string
}

const branchScopedGet = async <T>(url: string, params?: Record<string, string | number | boolean | undefined>) => {
  const response = await api.get(url, {
    params,
    headers: {
      'X-Use-Branch-Scope': 'true',
    },
  })

  return response.data.data as T
}

export const reportsApi = {
  getOverview: (params: ReportRangeParams & { branchId?: string }) =>
    api
      .get('/reports/overview', {
        params: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          branchId: params.branchId || undefined,
        },
      })
      .then((response) => response.data.data as ReportsOverview),

  getDashboard: () => branchScopedGet<DashboardMetrics>('/reports/dashboard'),

  getRevenueChart: ({ days, dateFrom, dateTo }: ReportRangeParams & { days?: number }) =>
    branchScopedGet<RevenuePoint[]>('/reports/revenue-chart', { days, dateFrom, dateTo }),

  getTopCustomers: (limit = 10, params?: ReportRangeParams) =>
    branchScopedGet<TopCustomer[]>('/reports/top-customers', { limit, ...params }),

  getTopProducts: (limit = 10, params?: ReportRangeParams) =>
    branchScopedGet<TopProduct[]>('/reports/top-products', { limit, ...params }),

  getServiceRevenue: (params?: ReportRangeParams) =>
    branchScopedGet<ServiceRevenueReport>('/reports/service-revenue', params),

  getCashbookSummary: ({ dateFrom, dateTo, limit = 5 }: CashbookSummaryParams) =>
    branchScopedGet<ReportsCashbookSummary>('/reports/transactions', {
      dateFrom,
      dateTo,
      limit,
      includeMeta: false,
    }),

  getPurchaseSummary: async (params?: ReportRangeParams) => {
    const data = await branchScopedGet<{ suppliers: SupplierAnalyticsItem[]; summary: SupplierAnalyticsSummary }>(
      '/reports/purchases/summary',
      params,
    )
    return {
      data: data.suppliers,
      summary: data.summary,
    } satisfies SupplierAnalyticsResponse
  },

  getInventoryHealth: async () => {
    const data = await branchScopedGet<{ items: LowStockSuggestion[] }>('/reports/inventory/health')
    return data.items
  },

  getDebtSummary: (limit = 100, params?: ReportRangeParams) =>
    branchScopedGet<ReportsDebtSummary>('/reports/debts/summary', { limit, ...params }),
}
