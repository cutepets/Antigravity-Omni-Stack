import type { PaymentMethod, PaymentEntry } from './order.types'

export type PriceBookPriceMap = Record<string, number>

export interface CustomerPricingProfile {
  groupId?: string
  groupName?: string
  groupColor?: string
  priceBookId?: string
  priceBookName?: string
  discountRate?: number
}

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
  weightBandLabel?: string
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
  baseUnit?: string
  baseUnitPrice?: number
  priceBookPrices?: PriceBookPriceMap | null
  basePriceBookPrices?: PriceBookPriceMap | null
  baseSku?: string
  image?: string
  variantName?: string
  variantLabel?: string
  unitLabel?: string
  variants?: any[]
  groomingDetails?: {
    petId: string
    performerId?: string
    startTime?: string
    notes?: string
    serviceItems?: string
    packageCode?: string
    weightAtBooking?: number
    weightBandId?: string
    weightBandLabel?: string
    pricingPrice?: number
    pricingSnapshot?: any
  }
  hotelDetails?: {
    petId: string
    checkIn: string
    checkOut: string
    stayId?: string
    lineType: 'REGULAR' | 'HOLIDAY'
    tableName?: string
    bookingGroupKey?: string
    chargeLineIndex?: number
    chargeLineLabel?: string
    chargeDayType?: 'REGULAR' | 'HOLIDAY'
    chargeQuantityDays?: number
    chargeUnitPrice?: number
    chargeSubtotal?: number
    chargeWeightBandId?: string | null
    chargeWeightBandLabel?: string | null
    pricingPreview?: any
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
  customerPoints?: number
  customerPricing?: CustomerPricingProfile | null
  productSearch: string
  cart: CartItem[]
  payments: PaymentEntry[]
  manualDiscountTotal?: number
  roundingDiscountTotal?: number
  discountTotal: number
  shippingFee: number
  notes: string
  activePetIds: string[]
  linkedOrderId?: string
  linkedOrderNumber?: string
  linkedPaymentStatus?: string
  linkedAmountPaid?: number
  branchId?: string
}
