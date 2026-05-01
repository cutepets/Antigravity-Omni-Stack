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

export interface CreateCustomerDto {
  fullName: string
  phone: string
  email?: string
  address?: string
  dateOfBirth?: string
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
