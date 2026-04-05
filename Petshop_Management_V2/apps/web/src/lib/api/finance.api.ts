import { api } from '@/lib/api'

export type FinanceTransactionType = 'INCOME' | 'EXPENSE'
export type FinanceTransactionSource =
  | 'MANUAL'
  | 'ORDER_PAYMENT'
  | 'ORDER_ADJUSTMENT'
  | 'STOCK_RECEIPT'
  | 'HOTEL'
  | 'GROOMING'
  | 'OTHER'

export interface FinanceTransaction {
  id: string
  voucherNumber: string
  type: FinanceTransactionType
  amount: number
  description: string
  category?: string | null
  paymentMethod?: string | null
  branchId?: string | null
  branchName?: string | null
  payerId?: string | null
  payerName?: string | null
  refType?: string | null
  refId?: string | null
  refNumber?: string | null
  notes?: string | null
  tags?: string | null
  source: FinanceTransactionSource | string
  isManual: boolean
  date: string
  createdAt: string
  updatedAt: string
  createdBy?: { id: string; name: string } | null
}

export interface FinanceListParams {
  page?: number
  limit?: number
  type?: 'ALL' | FinanceTransactionType
  dateFrom?: string
  dateTo?: string
  search?: string
  branchId?: string
  paymentMethod?: string
  createdById?: string
  source?: FinanceTransactionSource | 'ALL'
  refNumber?: string
  description?: string
  payerName?: string
  includeMeta?: boolean
}

export interface FinanceListResponse {
  transactions: FinanceTransaction[]
  total: number
  page: number
  limit: number
  totalPages: number
  openingBalance: number
  totalIncome: number
  totalExpense: number
  closingBalance: number
  meta?: {
    branches: Array<{ id: string; name: string }>
    paymentMethods: string[]
    creators: Array<{ id: string; name: string }>
    sources: string[]
  }
}

export interface CreateFinanceTransactionInput {
  type: FinanceTransactionType
  amount: number
  description: string
  category?: string
  paymentMethod?: string
  branchId?: string
  branchName?: string
  payerName?: string
  payerId?: string
  refType?: 'MANUAL'
  refId?: string
  refNumber?: string
  notes?: string
  tags?: string
  date?: string
}

export const financeApi = {
  list: (params: FinanceListParams) =>
    api.get('/reports/transactions', { params }).then((r) => r.data.data as FinanceListResponse),

  create: (data: CreateFinanceTransactionInput) =>
    api.post('/reports/transactions', data).then((r) => r.data.data as FinanceTransaction),

  update: (id: string, data: Partial<CreateFinanceTransactionInput>) =>
    api.patch(`/reports/transactions/${id}`, data).then((r) => r.data.data as FinanceTransaction),

  remove: (id: string) => api.delete(`/reports/transactions/${id}`).then((r) => r.data),

  getByVoucher: (voucherNumber: string) =>
    api.get(`/reports/transactions/${voucherNumber}`).then((r) => r.data.data as FinanceTransaction),
}
