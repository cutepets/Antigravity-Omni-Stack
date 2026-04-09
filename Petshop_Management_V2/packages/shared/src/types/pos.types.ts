import type { PaymentMethod, PaymentEntry } from './order.types.js'

// POS-specific types (frontend only, not stored in DB directly)
export interface CartItem {
  id: string
  orderItemId?: string
  productId?: string
  productVariantId?: string
  serviceId?: string
  serviceVariantId?: string
  description: string
  sku?: string
  barcode?: string
  quantity: number
  unitPrice: number
  discountItem: number
  vatRate: number
  petId?: string
  petName?: string
  petImage?: string
  type: 'product' | 'service' | 'hotel' | 'grooming'
  serviceType?: string
  unit: string
  baseUnitPrice?: number
  baseSku?: string
  image?: string
  variantName?: string
  variants?: any[]
  groomingDetails?: {
    petId: string
    performerId?: string
    startTime?: string
    notes?: string
    serviceItems?: string
  }
  hotelDetails?: {
    petId: string
    checkIn: string
    checkOut: string
    stayId?: string
    lineType: 'REGULAR' | 'HOLIDAY'
    tableName?: string
  }
  itemNotes?: string
  isTempItem?: boolean
  stock?: number
  availableStock?: number
  trading?: number
  reserved?: number
  branchStocks?: any[]
}

export interface OrderTab {
  id: string
  title: string
  customerId?: string
  customerName: string
  productSearch: string
  cart: CartItem[]
  payments: PaymentEntry[]
  discountTotal: number
  shippingFee: number
  notes: string
  activePetIds: string[]
  existingOrderId?: string
  existingOrderNumber?: string
  existingPaymentStatus?: string
  existingAmountPaid?: number
  branchId?: string
}
