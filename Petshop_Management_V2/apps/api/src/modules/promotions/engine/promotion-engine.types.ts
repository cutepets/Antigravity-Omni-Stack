export type PromotionType = 'DISCOUNT' | 'BUY_X_GET_Y' | 'VOUCHER' | 'BIRTHDAY' | 'AUTO_VOUCHER'
export type PromotionStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'
export type RewardType = 'AMOUNT_OFF' | 'PERCENT_OFF' | 'FREE_ITEM' | 'VOUCHER_CODE'
export type RewardScope = 'ORDER' | 'ITEM' | 'PRODUCT' | 'SERVICE' | 'CATEGORY'
export type BirthdayTarget = 'CUSTOMER' | 'PET' | 'CUSTOMER_OR_PET'

export type PromotionPreviewItem = {
  lineId?: string
  productId?: string | null
  productVariantId?: string | null
  serviceId?: string | null
  serviceVariantId?: string | null
  category?: string | null
  type: string
  quantity: number
  unitPrice: number
  discountItem?: number | null
}

export type PromotionPreviewContext = {
  now?: Date
  featureEnabled?: boolean
  branchId?: string | null
  orderSource?: string | null
  customer?: {
    id?: string | null
    groupId?: string | null
    tier?: string | null
    dateOfBirth?: string | Date | null
  } | null
  pets?: Array<{
    id?: string | null
    dateOfBirth?: string | Date | null
  }>
  items: PromotionPreviewItem[]
  manualDiscount?: number
  voucherCode?: string | null
}

export type PromotionConditions = {
  minOrderSubtotal?: number | null
  branchIds?: string[] | null
  customerGroupIds?: string[] | null
  customerTiers?: string[] | null
  productIds?: string[] | null
  productVariantIds?: string[] | null
  serviceIds?: string[] | null
  categories?: string[] | null
  buyProductIds?: string[] | null
  buyProductVariantIds?: string[] | null
  buyQuantity?: number | null
  birthdayTarget?: BirthdayTarget | null
  birthdayWindowDays?: number | null
}

export type PromotionReward = {
  type: RewardType
  scope: RewardScope
  value?: number | null
  maxDiscount?: number | null
  productId?: string | null
  productVariantId?: string | null
  serviceId?: string | null
  serviceVariantId?: string | null
  description?: string | null
  quantity?: number | null
  unitPrice?: number | null
}

export type PromotionSchedule = {
  months?: number[] | null
  monthDays?: number[] | null
  weekdays?: number[] | null
  timeRanges?: Array<{ start: string; end: string }> | null
}

export type PromotionVoucherRule = {
  code: string
  status: 'ACTIVE' | 'LOCKED' | 'REDEEMED' | 'EXPIRED'
  customerId?: string | null
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  usageLimit?: number | null
  redeemedCount?: number | null
}

export type PromotionRule = {
  id: string
  code: string
  name: string
  type: PromotionType
  status: PromotionStatus
  priority?: number | null
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  branchIds?: string[] | null
  customerGroupIds?: string[] | null
  conditions?: PromotionConditions | null
  reward: PromotionReward
  allowStacking?: boolean | null
  usageLimit?: number | null
  redeemedCount?: number | null
  schedules?: PromotionSchedule[] | null
  voucherCodes?: PromotionVoucherRule[] | null
}

export type AppliedPromotion = {
  promotionId: string
  code: string
  name: string
  type: PromotionType
  rewardType: RewardType
  discountAmount: number
  voucherCode?: string | null
}

export type PromotionGiftLine = {
  id: string
  promotionId: string
  promotionCode: string
  description: string
  productId?: string | null
  productVariantId?: string | null
  serviceId?: string | null
  serviceVariantId?: string | null
  quantity: number
  unitPrice: number
  originalUnitPrice: number
  type: 'product' | 'service'
}

export type RejectedPromotion = {
  promotionId: string
  code: string
  reason: string
}

export type PromotionPreviewResult = {
  enabled: boolean
  subtotal: number
  manualDiscount: number
  promotionDiscount: number
  discountTotal: number
  finalTotal: number
  appliedPromotions: AppliedPromotion[]
  rejectedPromotions: RejectedPromotion[]
  giftLines: PromotionGiftLine[]
  previewToken: string
}
