import { createHash } from 'crypto'
import {
  AppliedPromotion,
  PromotionGiftLine,
  PromotionPreviewContext,
  PromotionPreviewItem,
  PromotionPreviewResult,
  PromotionRule,
  PromotionVoucherRule,
} from './promotion-engine.types'

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const toDate = (value: string | Date | null | undefined) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizeCode = (value: string | null | undefined) => String(value ?? '').trim().toUpperCase()

function sameMonthDay(left: Date, right: Date, windowDays: number) {
  const currentYearBirthday = new Date(left)
  currentYearBirthday.setFullYear(right.getFullYear())
  currentYearBirthday.setHours(0, 0, 0, 0)
  const current = new Date(right)
  current.setHours(0, 0, 0, 0)
  const diffDays = Math.abs(current.getTime() - currentYearBirthday.getTime()) / 86_400_000
  return diffDays <= windowDays
}

function isoWeekday(date: Date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

function parseTimeMinutes(value: string | null | undefined) {
  const match = String(value ?? '').match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export class PromotionEngineService {
  preview(context: PromotionPreviewContext, promotions: PromotionRule[]): PromotionPreviewResult {
    const now = context.now ?? new Date()
    const subtotal = this.calculateSubtotal(context.items)
    const manualDiscount = Math.min(subtotal, Math.max(0, toNumber(context.manualDiscount)))

    if (context.featureEnabled === false) {
      return this.buildResult({
        enabled: false,
        subtotal,
        manualDiscount,
        promotionDiscount: 0,
        appliedPromotions: [],
        rejectedPromotions: [],
        giftLines: [],
      })
    }

    const eligible: PromotionRule[] = []
    const rejectedPromotions: PromotionPreviewResult['rejectedPromotions'] = []

    for (const promotion of promotions) {
      const rejection = this.getRejectionReason(promotion, context, subtotal, now)
      if (rejection) {
        rejectedPromotions.push({ promotionId: promotion.id, code: promotion.code, reason: rejection })
      } else {
        eligible.push(promotion)
      }
    }

    const selected = this.selectPromotions(eligible)
    const appliedPromotions: AppliedPromotion[] = []
    const giftLines: PromotionGiftLine[] = []
    let promotionDiscount = 0

    for (const promotion of selected) {
      if (promotion.reward.type === 'FREE_ITEM') {
        const giftLine = this.buildGiftLine(promotion)
        if (giftLine) giftLines.push(giftLine)
        appliedPromotions.push(this.buildAppliedPromotion(promotion, 0, context.voucherCode))
        continue
      }

      const amount = Math.min(
        Math.max(0, subtotal - manualDiscount - promotionDiscount),
        this.calculateDiscountAmount(promotion, context.items, subtotal),
      )
      if (amount <= 0) continue
      promotionDiscount += amount
      appliedPromotions.push(this.buildAppliedPromotion(promotion, amount, context.voucherCode))
    }

    return this.buildResult({
      enabled: true,
      subtotal,
      manualDiscount,
      promotionDiscount,
      appliedPromotions,
      rejectedPromotions,
      giftLines,
    })
  }

  private calculateSubtotal(items: PromotionPreviewItem[]) {
    return items.reduce(
      (sum, item) =>
        sum +
        Math.max(0, toNumber(item.quantity)) *
          Math.max(0, toNumber(item.unitPrice) - toNumber(item.discountItem)),
      0,
    )
  }

  private getRejectionReason(
    promotion: PromotionRule,
    context: PromotionPreviewContext,
    subtotal: number,
    now: Date,
  ): string | null {
    if (promotion.status !== 'ACTIVE') return 'PROMOTION_INACTIVE'
    if (promotion.startsAt && toDate(promotion.startsAt)! > now) return 'PROMOTION_NOT_STARTED'
    if (promotion.endsAt && toDate(promotion.endsAt)! < now) return 'PROMOTION_EXPIRED'
    if (promotion.usageLimit != null && toNumber(promotion.redeemedCount) >= promotion.usageLimit) {
      return 'PROMOTION_USAGE_LIMIT_REACHED'
    }
    if (!this.matchesSchedules(promotion, now)) return 'SCHEDULE_NOT_MATCHED'
    if (promotion.branchIds?.length && context.branchId && !promotion.branchIds.includes(context.branchId)) {
      return 'BRANCH_NOT_ELIGIBLE'
    }

    const conditions = promotion.conditions ?? {}
    if (conditions.minOrderSubtotal != null && subtotal < conditions.minOrderSubtotal) {
      return 'MIN_ORDER_SUBTOTAL_NOT_MET'
    }
    const customerGroupIds = conditions.customerGroupIds ?? promotion.customerGroupIds
    if (
      customerGroupIds?.length &&
      (!context.customer?.groupId || !customerGroupIds.includes(context.customer.groupId))
    ) {
      return 'CUSTOMER_GROUP_NOT_ELIGIBLE'
    }
    if (
      conditions.customerTiers?.length &&
      (!context.customer?.tier || !conditions.customerTiers.includes(context.customer.tier))
    ) {
      return 'CUSTOMER_TIER_NOT_ELIGIBLE'
    }
    if (promotion.type === 'VOUCHER') {
      const voucherRejection = this.getVoucherRejectionReason(promotion.voucherCodes ?? [], context, now)
      if (voucherRejection) return voucherRejection
    }
    if (promotion.type === 'BUY_X_GET_Y' && !this.hasRequiredBuyItems(promotion, context.items)) {
      return 'BUY_ITEMS_NOT_MET'
    }
    if (conditions.birthdayTarget && !this.matchesBirthday(context, conditions.birthdayTarget, conditions.birthdayWindowDays ?? 0, now)) {
      return 'BIRTHDAY_NOT_MATCHED'
    }

    return null
  }

  private matchesSchedules(promotion: PromotionRule, now: Date) {
    const schedules = promotion.schedules ?? []
    if (!schedules.length) return true

    return schedules.some((schedule) => {
      if (schedule.months?.length && !schedule.months.includes(now.getMonth() + 1)) return false
      if (schedule.monthDays?.length && !schedule.monthDays.includes(now.getDate())) return false
      if (schedule.weekdays?.length && !schedule.weekdays.includes(isoWeekday(now))) return false
      if (!schedule.timeRanges?.length) return true

      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      return schedule.timeRanges.some((range) => {
        const start = parseTimeMinutes(range.start)
        const end = parseTimeMinutes(range.end)
        if (start == null || end == null || end < start) return false
        return currentMinutes >= start && currentMinutes <= end
      })
    })
  }

  private getVoucherRejectionReason(vouchers: PromotionVoucherRule[], context: PromotionPreviewContext, now: Date) {
    if (!vouchers.length) return null
    const code = normalizeCode(context.voucherCode)
    if (!code) return 'VOUCHER_CODE_REQUIRED'
    const voucher = vouchers.find((item) => normalizeCode(item.code) === code)
    if (!voucher) return 'VOUCHER_NOT_FOUND'
    if (voucher.status !== 'ACTIVE') return 'VOUCHER_INACTIVE'
    if (voucher.customerId && voucher.customerId !== context.customer?.id) return 'VOUCHER_CUSTOMER_MISMATCH'
    if (voucher.startsAt && toDate(voucher.startsAt)! > now) return 'VOUCHER_NOT_STARTED'
    if (voucher.endsAt && toDate(voucher.endsAt)! < now) return 'VOUCHER_EXPIRED'
    if (voucher.usageLimit != null && toNumber(voucher.redeemedCount) >= voucher.usageLimit) {
      return 'VOUCHER_USAGE_LIMIT_REACHED'
    }
    return null
  }

  private hasRequiredBuyItems(promotion: PromotionRule, items: PromotionPreviewItem[]) {
    const conditions = promotion.conditions ?? {}
    const requiredQuantity = Math.max(1, toNumber(conditions.buyQuantity, 1))
    const quantity = items.reduce((sum, item) => {
      const productMatch =
        !conditions.buyProductIds?.length || (item.productId && conditions.buyProductIds.includes(item.productId))
      const variantMatch =
        !conditions.buyProductVariantIds?.length ||
        (item.productVariantId && conditions.buyProductVariantIds.includes(item.productVariantId))
      return productMatch && variantMatch ? sum + Math.max(0, toNumber(item.quantity)) : sum
    }, 0)
    return quantity >= requiredQuantity
  }

  private matchesBirthday(
    context: PromotionPreviewContext,
    target: NonNullable<NonNullable<PromotionRule['conditions']>['birthdayTarget']>,
    windowDays: number,
    now: Date,
  ) {
    const dates: Array<string | Date | null | undefined> = []
    if (target === 'CUSTOMER' || target === 'CUSTOMER_OR_PET') dates.push(context.customer?.dateOfBirth)
    if (target === 'PET' || target === 'CUSTOMER_OR_PET') dates.push(...(context.pets ?? []).map((pet) => pet.dateOfBirth))
    return dates.some((value) => {
      const date = toDate(value)
      return date ? sameMonthDay(date, now, Math.max(0, windowDays)) : false
    })
  }

  private selectPromotions(promotions: PromotionRule[]) {
    const sorted = [...promotions].sort((left, right) => {
      const byPriority = toNumber(right.priority) - toNumber(left.priority)
      if (byPriority !== 0) return byPriority
      return right.id.localeCompare(left.id)
    })
    if (sorted.some((promotion) => !promotion.allowStacking)) {
      return sorted.slice(0, 1)
    }
    return sorted
  }

  private calculateDiscountAmount(promotion: PromotionRule, items: PromotionPreviewItem[], subtotal: number) {
    const scopeBase = promotion.reward.scope === 'ORDER' ? subtotal : this.calculateScopedSubtotal(promotion, items)
    const value = Math.max(0, toNumber(promotion.reward.value))
    const raw = promotion.reward.type === 'PERCENT_OFF' ? Math.round(scopeBase * value / 100) : value
    return promotion.reward.maxDiscount != null ? Math.min(raw, Math.max(0, promotion.reward.maxDiscount)) : raw
  }

  private calculateScopedSubtotal(promotion: PromotionRule, items: PromotionPreviewItem[]) {
    const conditions = promotion.conditions ?? {}
    return this.calculateSubtotal(
      items.filter((item) => {
        if (conditions.productIds?.length && (!item.productId || !conditions.productIds.includes(item.productId))) return false
        if (
          conditions.productVariantIds?.length &&
          (!item.productVariantId || !conditions.productVariantIds.includes(item.productVariantId))
        ) return false
        if (conditions.serviceIds?.length && (!item.serviceId || !conditions.serviceIds.includes(item.serviceId))) return false
        if (conditions.categories?.length && (!item.category || !conditions.categories.includes(item.category))) return false
        return true
      }),
    )
  }

  private buildGiftLine(promotion: PromotionRule): PromotionGiftLine | null {
    const quantity = Math.max(1, toNumber(promotion.reward.quantity, 1))
    const isService = Boolean(promotion.reward.serviceId || promotion.reward.serviceVariantId)
    return {
      id: `gift-${promotion.id}`,
      promotionId: promotion.id,
      promotionCode: promotion.code,
      description: promotion.reward.description || promotion.name,
      productId: promotion.reward.productId ?? null,
      productVariantId: promotion.reward.productVariantId ?? null,
      serviceId: promotion.reward.serviceId ?? null,
      serviceVariantId: promotion.reward.serviceVariantId ?? null,
      quantity,
      unitPrice: 0,
      originalUnitPrice: Math.max(0, toNumber(promotion.reward.unitPrice)),
      type: isService ? 'service' : 'product',
    }
  }

  private buildAppliedPromotion(promotion: PromotionRule, discountAmount: number, voucherCode?: string | null): AppliedPromotion {
    return {
      promotionId: promotion.id,
      code: promotion.code,
      name: promotion.name,
      type: promotion.type,
      rewardType: promotion.reward.type,
      discountAmount,
      voucherCode: promotion.type === 'VOUCHER' ? normalizeCode(voucherCode) || null : null,
    }
  }

  private buildResult(params: Omit<PromotionPreviewResult, 'discountTotal' | 'finalTotal' | 'previewToken'>) {
    const discountTotal = Math.min(params.subtotal, params.manualDiscount + params.promotionDiscount)
    const finalTotal = Math.max(0, params.subtotal - discountTotal)
    const previewToken = createHash('sha256')
      .update(JSON.stringify({
        enabled: params.enabled,
        subtotal: params.subtotal,
        discountTotal,
        giftLines: params.giftLines,
        applied: params.appliedPromotions.map((promotion) => promotion.promotionId),
      }))
      .digest('hex')
      .slice(0, 24)

    return {
      ...params,
      discountTotal,
      finalTotal,
      previewToken,
    }
  }
}
