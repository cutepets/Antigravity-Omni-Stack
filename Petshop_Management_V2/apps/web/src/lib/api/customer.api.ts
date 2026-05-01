import { api } from '@/lib/api'
import type { Customer } from '@petshop/shared'

// ── Query Params ───────────────────────────────────────────────────────────────
export interface FindCustomersParams {
  search?: string
  page?: number
  limit?: number
  tier?: string
  groupId?: string
  isActive?: boolean
  minSpent?: number
  maxSpent?: number
  branchId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ── Response Shapes ───────────────────────────────────────────────────────────
export interface ApiListResult<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiSingleResult<T> {
  success: boolean
  data: T
}

export interface BulkDeleteResult {
  success: boolean
  deletedIds: string[]
  blocked: Array<{ id: string; reason: string }>
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
export interface CreateCustomerDto {
  fullName: string
  phone: string
  email?: string
  address?: string
  dateOfBirth?: string
  notes?: string
  tier?: string
  groupId?: string
  branchId?: string
  debt?: number
  taxCode?: string
  description?: string
  isActive?: boolean
  isSupplier?: boolean
  supplierCode?: string
  companyName?: string
  companyAddress?: string
  representativeName?: string
  representativePhone?: string
  bankAccount?: string
  bankName?: string
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  points?: number
}
export type BulkUpdateCustomerDto = Partial<Pick<UpdateCustomerDto, 'branchId' | 'groupId' | 'tier' | 'isActive'>>

export interface CustomerPointHistoryEntry {
  id: string
  customerId: string
  actorId?: string | null
  delta: number
  balanceBefore: number
  balanceAfter: number
  source: string
  reason?: string | null
  createdAt: string
  actor?: { id: string; fullName: string; staffCode: string } | null
}

export interface AdjustCustomerPointsDto {
  delta: number
  reason?: string
}

// ── API ───────────────────────────────────────────────────────────────────────
export const customerApi = {
  /** Danh sách có phân trang + tìm kiếm không dấu */
  getCustomers: async (params: FindCustomersParams = {}): Promise<ApiListResult<Customer>> => {
    // Map legacy 'q' param → 'search'
    const { data } = await api.get<ApiListResult<Customer>>('/customers', { params })
    return data
  },

  /** Chi tiết theo ID hoặc mã KH000001 */
  getCustomer: async (id: string, months?: number): Promise<ApiSingleResult<Customer>> => {
    const { data } = await api.get<ApiSingleResult<Customer>>(`/customers/${id}`, {
      params: months ? { months } : undefined,
    })
    return data
  },

  /** Tạo mới */
  createCustomer: async (payload: CreateCustomerDto) => {
    const { data } = await api.post<ApiSingleResult<Customer>>('/customers', payload)
    return data
  },

  /** Cập nhật */
  updateCustomer: async (id: string, payload: UpdateCustomerDto) => {
    const { data } = await api.put<ApiSingleResult<Customer>>(`/customers/${id}`, payload)
    return data
  },

  /** Xoá (safe — backend kiểm tra quan hệ) */
  deleteCustomer: async (id: string) => {
    const { data } = await api.delete<{ success: boolean; message?: string }>(`/customers/${id}`)
    return data
  },

  bulkDeleteCustomers: async (ids: string[]) => {
    const { data } = await api.post<BulkDeleteResult>('/customers/bulk-delete', { ids })
    return data
  },

  bulkUpdateCustomers: async (ids: string[], updates: BulkUpdateCustomerDto) => {
    const { data } = await api.patch<{ success: boolean; updatedIds: string[]; updatedCount: number }>('/customers/bulk-update', { ids, updates })
    return data
  },

  getPointHistory: async (id: string) => {
    const { data } = await api.get<{ success: boolean; data: CustomerPointHistoryEntry[] }>(`/customers/${id}/points-history`)
    return data
  },

  adjustPoints: async (id: string, payload: AdjustCustomerPointsDto) => {
    const { data } = await api.post<{ success: boolean; data: { customer: Customer; history: CustomerPointHistoryEntry } }>(
      `/customers/${id}/points-adjustments`,
      payload,
    )
    return data
  },

}
