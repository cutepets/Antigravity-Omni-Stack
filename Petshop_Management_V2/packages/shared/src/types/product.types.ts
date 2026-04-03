import type { ServiceType } from './core.types.js'

export interface Product {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  category?: string | null
  brand?: string | null
  description?: string | null
  price: number
  costPrice?: number | null
  stock: number
  reservedStock: number
  minStock: number
  unit: string
  image?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  sku?: string | null
  price: number
  stock: number
  reservedStock: number
  isActive: boolean
}

export interface Service {
  id: string
  name: string
  code?: string | null
  type: ServiceType
  description?: string | null
  price: number
  duration?: number | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  variants?: ServiceVariant[]
}

export interface ServiceVariant {
  id: string
  serviceId: string
  name: string
  price: number
  duration?: number | null
  isActive: boolean
}
