import type { CartItem } from '@petshop/shared'

export type OrderWorkspaceMode = 'create' | 'detail'

export interface OrderDraft {
  branchId?: string
  customerId?: string
  customerName: string
  discount: number
  shippingFee: number
  notes: string
  items: CartItem[]
}

export interface OrderActionFlags {
  canAccessOrders: boolean
  canUpdateOrder: boolean
  canPayOrder: boolean
  canApproveOrder: boolean
  canExportStock: boolean
  canSettleOrder: boolean
  canEditCurrentOrder: boolean
  canApproveCurrentOrder: boolean
  canExportCurrentOrder: boolean
  canSettleCurrentOrder: boolean
  canPayCurrentOrder: boolean
  isOrderReadonly: boolean
}

export interface OrderPrintPayload {
  order: any
  branchName: string
  customerName: string
  customerPhone?: string
  items: CartItem[]
  subtotal: number
  discount: number
  shippingFee: number
  total: number
  amountPaid: number
  remainingAmount: number
  notes?: string
  paymentStatus?: string
  orderStatus?: string
}
