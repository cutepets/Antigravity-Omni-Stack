import type { OrderStatus, PaymentStatus } from './core.types'

export interface Order {
  id: string
  orderNumber: string
  customerId?: string | null
  customerName: string
  staffId: string
  branchId?: string | null
  status: OrderStatus
  paymentStatus: PaymentStatus
  subtotal: number
  discount: number
  shippingFee: number
  total: number
  paidAmount: number
  remainingAmount: number
  notes?: string | null
  createdAt: Date
  updatedAt: Date
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  orderId: string
  productId?: string | null
  productVariantId?: string | null
  serviceId?: string | null
  serviceVariantId?: string | null
  petId?: string | null
  groomingSessionId?: string | null
  hotelStayId?: string | null
  description: string
  quantity: number
  unitPrice: number
  discountItem: number
  vatRate: number
  subtotal: number
  type: 'product' | 'service'
}

export interface PaymentEntry {
  method: PaymentMethod
  amount: number
  note?: string
  paymentAccountId?: string
  paymentAccountLabel?: string
}

export type PaymentMethod = 'CASH' | 'BANK' | 'EWALLET' | 'MOMO' | 'VNPAY' | 'CARD' | 'POINTS'
