import type { CustomerTier } from './core.types'

export interface Customer {
  id: string
  customerCode: string
  fullName: string
  phone: string
  branchId?: string | null
  email?: string | null
  address?: string | null
  tier: CustomerTier
  points: number
  groupId?: string | null
  notes?: string | null
  debt?: number
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
