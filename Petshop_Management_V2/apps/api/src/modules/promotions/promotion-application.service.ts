import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import { PromotionEngineService } from './engine/promotion-engine.service.js'
import type { PromotionPreviewContext, PromotionPreviewResult, PromotionRule } from './engine/promotion-engine.types.js'

type OrderDraftItem = PromotionPreviewContext['items'][number] & {
  id?: string
  petId?: string | null
}

export type ApplyPromotionDraftParams = {
  branchId?: string | null
  customerId?: string | null
  items: OrderDraftItem[]
  manualDiscount?: number
  voucherCode?: string | null
}

@Injectable()
export class PromotionApplicationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly engine: PromotionEngineService,
  ) {}

  async isEnabled() {
    const module = await (this.db as any).moduleConfig.findUnique({
      where: { key: 'promotions' },
      select: { isActive: true, isCore: true },
    })
    if (!module) return false
    return Boolean(module.isCore || module.isActive)
  }

  async preview(params: ApplyPromotionDraftParams): Promise<PromotionPreviewResult> {
    const featureEnabled = await this.isEnabled()
    const [customer, pets, promotions] = await Promise.all([
      params.customerId
        ? (this.db as any).customer.findUnique({
            where: { id: params.customerId },
            select: { id: true, groupId: true, tier: true, dateOfBirth: true },
          })
        : null,
      this.resolvePets(params.items),
      featureEnabled ? this.listActiveRules(params.voucherCode) : Promise.resolve([]),
    ])

    return this.engine.preview(
      {
        featureEnabled,
        branchId: params.branchId ?? null,
        customer,
        pets,
        items: params.items,
        manualDiscount: params.manualDiscount ?? 0,
        voucherCode: params.voucherCode ?? null,
      },
      promotions,
    )
  }

  async applyToOrderDraft(params: ApplyPromotionDraftParams) {
    const result = await this.preview(params)
    if (!result.enabled) {
      return {
        result,
        discount: Math.max(0, params.manualDiscount ?? 0),
        promotionDiscount: 0,
        manualDiscount: Math.max(0, params.manualDiscount ?? 0),
        items: params.items,
      }
    }

    const giftItems = result.giftLines.map((gift) => ({
      productId: gift.productId ?? undefined,
      productVariantId: gift.productVariantId ?? undefined,
      serviceId: gift.serviceId ?? undefined,
      serviceVariantId: gift.serviceVariantId ?? undefined,
      description: gift.description,
      quantity: gift.quantity,
      unitPrice: 0,
      discountItem: 0,
      vatRate: 0,
      type: gift.type,
      isPromotionGift: true,
      promotionSnapshot: gift,
    }))

    return {
      result,
      discount: result.discountTotal,
      promotionDiscount: result.promotionDiscount,
      manualDiscount: result.manualDiscount,
      items: [...params.items, ...giftItems],
    }
  }

  async recordRedemptions(tx: any, params: {
    order: { id: string; orderNumber: string; customerId?: string | null; branchId?: string | null }
    staffId?: string | null
    preview: PromotionPreviewResult
  }) {
    if (!params.preview.enabled || params.preview.appliedPromotions.length === 0) return
    const retainedRedemptionIds: string[] = []

    for (const applied of params.preview.appliedPromotions) {
      const voucher = applied.voucherCode
        ? await tx.promotionVoucherCode.findUnique({ where: { code: applied.voucherCode } })
        : null

      const existing = await tx.promotionRedemption.findFirst({
        where: {
          orderId: params.order.id,
          promotionId: applied.promotionId,
          voucherCodeId: voucher?.id ?? null,
        },
      })

      const redemptionData = {
        promotionId: applied.promotionId,
        voucherCodeId: voucher?.id ?? null,
        orderId: params.order.id,
        orderNumber: params.order.orderNumber,
        customerId: params.order.customerId ?? null,
        branchId: params.order.branchId ?? null,
        staffId: params.staffId ?? null,
        discountAmount: applied.discountAmount,
        giftValue: params.preview.giftLines
          .filter((gift) => gift.promotionId === applied.promotionId)
          .reduce((sum, gift) => sum + gift.originalUnitPrice * gift.quantity, 0),
        snapshot: params.preview as any,
        source: 'ORDER',
      }

      const redemption = existing
        ? await tx.promotionRedemption.update({ where: { id: existing.id }, data: redemptionData })
        : await tx.promotionRedemption.create({ data: redemptionData })
      retainedRedemptionIds.push(redemption.id)

      if (!existing) {
        await tx.promotion.update({
          where: { id: applied.promotionId },
          data: {
            redeemedCount: { increment: 1 },
            budgetUsed: { increment: applied.discountAmount },
          },
        })
        if (voucher) {
          await tx.promotionVoucherCode.update({
            where: { id: voucher.id },
            data: {
              redeemedCount: { increment: 1 },
              lastRedeemedAt: new Date(),
              ...(voucher.usageLimit <= voucher.redeemedCount + 1 ? { status: 'REDEEMED' } : {}),
            },
          })
        }
      }

      await tx.orderItem.updateMany({
        where: {
          orderId: params.order.id,
          isPromotionGift: true,
          promotionRedemptionId: null,
        },
        data: { promotionRedemptionId: redemption.id },
      })
    }

    await tx.promotionRedemption.deleteMany({
      where: {
        orderId: params.order.id,
        id: { notIn: retainedRedemptionIds },
      },
    })
  }

  private async resolvePets(items: OrderDraftItem[]) {
    const petIds = [...new Set(items.map((item) => item.petId).filter((value): value is string => Boolean(value)))]
    if (petIds.length === 0) return []
    return (this.db as any).pet.findMany({
      where: { id: { in: petIds } },
      select: { id: true, dateOfBirth: true },
    })
  }

  private async listActiveRules(voucherCode?: string | null): Promise<PromotionRule[]> {
    const promotions = await (this.db as any).promotion.findMany({
      where: { status: 'ACTIVE' },
      include: voucherCode
        ? { schedules: true, voucherCodes: { where: { code: String(voucherCode).trim().toUpperCase() } } }
        : { schedules: true, voucherCodes: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })

    return promotions.map((promotion: any) => ({
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      type: promotion.type,
      status: promotion.status,
      priority: promotion.priority,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      branchIds: Array.isArray(promotion.branchIds) ? promotion.branchIds : null,
      customerGroupIds: Array.isArray(promotion.customerGroupIds) ? promotion.customerGroupIds : null,
      conditions: promotion.conditions ?? {},
      reward: promotion.reward,
      allowStacking: promotion.allowStacking,
      usageLimit: promotion.usageLimit,
      redeemedCount: promotion.redeemedCount,
      schedules: promotion.schedules ?? [],
      voucherCodes: promotion.voucherCodes ?? [],
    }))
  }
}
