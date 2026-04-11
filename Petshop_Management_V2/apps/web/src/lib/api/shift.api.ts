import { api } from '@/lib/api'

export type ShiftStatus = 'OPEN' | 'CLOSED'
export type ShiftReviewStatus = 'PENDING' | 'CHECKED' | 'APPROVED' | 'REJECTED'

export type CashDenomination = {
  value: number
  quantity: number
}
export type ShiftDenominations = Record<string, number>

export type ShiftPaymentSummary = {
  label: string
  income: number
  expense: number
  count: number
}

export type ShiftSummary = {
  openedAt: string
  closedAt?: string | null
  calculatedUntil: string
  openAmount: number
  closeAmount?: number | null
  cashIncome: number
  cashExpense: number
  manualCashIncome: number
  manualCashExpense: number
  orderCashIncome: number
  orderCashExpense: number
  nonCashIncome: number
  nonCashExpense: number
  expectedCloseAmount: number
  differenceAmount?: number | null
  orderCount: number
  refundCount: number
  manualIncomeCount: number
  manualExpenseCount: number
  transactionCount: number
  otherPayments: ShiftPaymentSummary[]
}

export type CashShift = {
  id: string
  branchId: string
  branchName?: string | null
  staffId: string
  staffName?: string | null
  openAmount: number
  closeAmount?: number | null
  expectedCloseAmount?: number | null
  differenceAmount?: number | null
  cashIncomeAmount: number
  cashExpenseAmount: number
  orderCount: number
  refundCount: number
  manualIncomeCount: number
  manualExpenseCount: number
  nonCashSummary?: ShiftPaymentSummary[] | null
  openDenominations?: CashDenomination[] | ShiftDenominations | null
  closeDenominations?: CashDenomination[] | ShiftDenominations | null
  summarySnapshot?: ShiftSummary | null
  openedAt: string
  closedAt?: string | null
  lastReclosedAt?: string | null
  closeCount: number
  employeeNote?: string | null
  managerNote?: string | null
  managerConclusion?: string | null
  reviewStatus: ShiftReviewStatus
  reviewedAt?: string | null
  reviewedById?: string | null
  notes?: string | null
  status: ShiftStatus
  canRecloseToday: boolean
  summary?: ShiftSummary | null
}
export type ShiftSession = CashShift

export type ShiftListResponse = {
  shifts: CashShift[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type ShiftListParams = {
  page?: number
  limit?: number
  branchId?: string
  staffId?: string
  status?: ShiftStatus | 'ALL'
  reviewStatus?: ShiftReviewStatus | 'ALL'
  dateFrom?: string
  dateTo?: string
}

const branchScopedHeaders = {
  'X-Use-Branch-Scope': 'true',
}

export const shiftApi = {
  getCurrent: () =>
    api
      .get('/shifts/current', { headers: branchScopedHeaders })
      .then((response) => response.data.data as CashShift | null),

  current: () =>
    api
      .get('/shifts/current', { headers: branchScopedHeaders })
      .then((response) => response.data.data as CashShift | null),

  list: (params: ShiftListParams) =>
    api
      .get('/shifts', { params, headers: branchScopedHeaders })
      .then((response) => response.data.data as ShiftListResponse),

  start: (payload: {
    branchId?: string
    openAmount: number
    openDenominations?: CashDenomination[] | ShiftDenominations
    employeeNote?: string
    notes?: string
  }) => api.post('/shifts/start', payload).then((response) => response.data.data as CashShift),

  end: (
    id: string,
    payload: {
      closeAmount: number
      closeDenominations?: CashDenomination[] | ShiftDenominations
      employeeNote?: string
      notes?: string
    },
  ) => api.post(`/shifts/${id}/end`, payload).then((response) => response.data.data as CashShift),

  getSummary: (id: string) =>
    api
      .get(`/shifts/${id}/summary`, { headers: branchScopedHeaders })
      .then((response) => response.data.data as CashShift),

  summary: (id: string) =>
    api
      .get(`/shifts/${id}/summary`, { headers: branchScopedHeaders })
      .then((response) => response.data.data as CashShift),

  update: (
    id: string,
    payload: Partial<{
      openAmount: number
      closeAmount: number | null
      openDenominations: CashDenomination[] | ShiftDenominations
      closeDenominations: CashDenomination[] | ShiftDenominations
      employeeNote: string | null
      managerNote: string | null
      managerConclusion: string | null
      reviewStatus: ShiftReviewStatus
      notes: string | null
    }>,
  ) => api.patch(`/shifts/${id}`, payload).then((response) => response.data.data as CashShift),

  remove: (id: string) =>
    api
      .delete(`/shifts/${id}`, { headers: branchScopedHeaders })
      .then((response) => response.data.data as { id: string }),
}
