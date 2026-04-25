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
  notes?: string
  tier?: string
  groupId?: string
  debt?: number
  taxCode?: string
  description?: string
  isActive?: boolean
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

export interface ImportCustomerRow {
  fullName: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  tier?: string
  taxCode?: string
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

  /** Export toàn bộ */
  exportCustomers: async (params?: { tier?: string; isActive?: boolean }) => {
    const { data } = await api.get<ApiListResult<Customer>>('/customers/export', { params })
    return data
  },

  /** Import batch từ JSON rows */
  importCustomers: async (rows: ImportCustomerRow[]) => {
    const { data } = await api.post<{
      success: boolean
      data: { created: number; updated: number; errors: string[] }
    }>('/customers/import', { rows })
    return data
  },
}
