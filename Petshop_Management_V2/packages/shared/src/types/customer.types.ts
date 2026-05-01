import type { CustomerTier } from './core.types'

export interface Customer {
  id: string
  customerCode: string
  fullName: string
  phone: string
  branchId?: string | null
  email?: string | null
  address?: string | null
  dateOfBirth?: Date | null
  tier: CustomerTier
  points: number
  pointsUsed?: number
  groupId?: string | null
  notes?: string | null
  taxCode?: string | null
  description?: string | null
  debt?: number
  totalSpent?: number
  totalOrders?: number
  isActive?: boolean
  isSupplier?: boolean
  supplierCode?: string | null
  companyName?: string | null
  companyAddress?: string | null
  representativeName?: string | null
  representativePhone?: string | null
  bankAccount?: string | null
  bankName?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CustomerGroup {
  id: string
  name: string
  color: string
  pricePolicy?: string | null
  discount: number
  description?: string | null
  createdAt: Date
  updatedAt: Date
}
