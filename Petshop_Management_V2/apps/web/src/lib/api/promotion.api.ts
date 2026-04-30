import { api } from '@/lib/api'

export type PromotionPreviewItem = {
  lineId?: string
  productId?: string
  productVariantId?: string
  serviceId?: string
  serviceVariantId?: string
  category?: string
  type: string
  quantity: number
  unitPrice: number
  discountItem?: number
}

export type PromotionPreviewResult = {
  enabled: boolean
  subtotal: number
  manualDiscount: number
  promotionDiscount: number
  discountTotal: number
  finalTotal: number
  appliedPromotions: Array<{
    promotionId: string
    code: string
    name: string
    type: string
    rewardType: string
    discountAmount: number
    voucherCode?: string | null
  }>
  rejectedPromotions: Array<{ promotionId: string; code: string; reason: string }>
  giftLines: Array<{
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
  }>
  previewToken: string
}

export type Promotion = {
  id: string
  code: string
  name: string
  type: string
  status: string
  priority: number
  description?: string | null
  startsAt?: string | null
  endsAt?: string | null
  branchIds?: string[] | null
  customerGroupIds?: string[] | null
  reward: Record<string, unknown>
  conditions?: Record<string, unknown> | null
  schedules?: PromotionSchedule[] | null
  allowStacking?: boolean
  usageLimit?: number | null
  budgetLimit?: number | null
  redeemedCount: number
  budgetUsed: number
  _count?: {
    redemptions?: number
    voucherCodes?: number
  }
}

export type PromotionSchedule = {
  months?: number[] | null
  monthDays?: number[] | null
  weekdays?: number[] | null
  timeRanges?: Array<{ start: string; end: string }> | null
}

export type PromotionVoucherBatchPayload = {
  name: string
  prefix?: string
  quantity: number
  usageLimitPerCode?: number
  expiresAt?: string
  customerId?: string
}

export type PromotionPayload = Partial<Promotion> & {
  schedules?: PromotionSchedule[]
  voucherBatch?: PromotionVoucherBatchPayload
}

export type PromotionVoucherCode = {
  id: string
  promotionId: string
  batchId?: string | null
  code: string
  status: string
  customerId?: string | null
  startsAt?: string | null
  endsAt?: string | null
  usageLimit: number
  redeemedCount: number
  lastRedeemedAt?: string | null
}

export const promotionApi = {
  getFeature: async (): Promise<{ enabled: boolean }> => {
    const { data } = await api.get('/settings/features/promotions')
    return data.data
  },
  setFeature: async (enabled: boolean) => {
    const { data } = await api.patch('/settings/features/promotions', { enabled })
    return data.data
  },
  preview: async (payload: {
    branchId?: string
    customerId?: string
    voucherCode?: string
    manualDiscount?: number
    items: PromotionPreviewItem[]
  }): Promise<PromotionPreviewResult> => {
    const { data } = await api.post('/promotions/preview', payload)
    return data.data
  },
  list: async (params?: Record<string, unknown>): Promise<Promotion[]> => {
    const { data } = await api.get('/promotions', { params })
    return data.data ?? []
  },
  findOne: async (id: string): Promise<Promotion> => {
    const { data } = await api.get(`/promotions/${id}`)
    return data.data
  },
  create: async (payload: PromotionPayload) => {
    const { data } = await api.post('/promotions', payload)
    return data.data
  },
  update: async (id: string, payload: PromotionPayload) => {
    const { data } = await api.patch(`/promotions/${id}`, payload)
    return data.data
  },
  activate: async (id: string) => {
    const { data } = await api.post(`/promotions/${id}/activate`)
    return data.data
  },
  deactivate: async (id: string) => {
    const { data } = await api.post(`/promotions/${id}/deactivate`)
    return data.data
  },
  reportSummary: async () => {
    const { data } = await api.get('/promotions/reports/summary')
    return data.data
  },
  listVouchers: async (params?: Record<string, unknown>): Promise<PromotionVoucherCode[]> => {
    const { data } = await api.get('/promotions/vouchers', { params })
    return data.data ?? []
  },
  generateVouchers: async (payload: PromotionVoucherBatchPayload & { promotionId: string }) => {
    const { data } = await api.post('/promotions/vouchers/generate', payload)
    return data.data
  },
}
