import { PromotionEngineService } from './promotion-engine.service'
import type { PromotionRule, PromotionPreviewContext } from './promotion-engine.types'

const baseContext = (overrides: Partial<PromotionPreviewContext> = {}): PromotionPreviewContext => ({
  now: new Date('2026-05-10T10:00:00.000Z'),
  branchId: 'branch-1',
  customer: {
    id: 'customer-1',
    groupId: 'vip',
    tier: 'GOLD',
    dateOfBirth: '1990-05-10T00:00:00.000Z',
  },
  pets: [{ id: 'pet-1', dateOfBirth: '2020-05-10T00:00:00.000Z' }],
  items: [
    {
      lineId: 'line-1',
      productId: 'product-1',
      productVariantId: 'variant-1',
      category: 'food',
      type: 'product',
      quantity: 2,
      unitPrice: 100_000,
      discountItem: 0,
    },
    {
      lineId: 'line-2',
      productId: 'product-2',
      productVariantId: 'variant-2',
      category: 'toy',
      type: 'product',
      quantity: 1,
      unitPrice: 50_000,
      discountItem: 0,
    },
  ],
  manualDiscount: 0,
  voucherCode: undefined,
  ...overrides,
})

const activeRule = (overrides: Partial<PromotionRule>): PromotionRule => ({
  id: 'promo-1',
  code: 'PROMO1',
  name: 'Promo 1',
  type: 'DISCOUNT',
  status: 'ACTIVE',
  priority: 10,
  startsAt: '2026-05-01T00:00:00.000Z',
  endsAt: '2026-05-31T23:59:59.000Z',
  branchIds: ['branch-1'],
  customerGroupIds: ['vip'],
  conditions: { minOrderSubtotal: 100_000 },
  reward: { type: 'PERCENT_OFF', scope: 'ORDER', value: 10, maxDiscount: 20_000 },
  allowStacking: false,
  usageLimit: null,
  redeemedCount: 0,
  ...overrides,
})

describe('PromotionEngineService', () => {
  const engine = new PromotionEngineService()

  it('applies the highest priority eligible order discount with max cap', () => {
    const result = engine.preview(baseContext(), [
      activeRule({ id: 'low', priority: 1, reward: { type: 'AMOUNT_OFF', scope: 'ORDER', value: 5_000 } }),
      activeRule({ id: 'high', priority: 20, reward: { type: 'PERCENT_OFF', scope: 'ORDER', value: 10, maxDiscount: 20_000 } }),
    ])

    expect(result.enabled).toBe(true)
    expect(result.discountTotal).toBe(20_000)
    expect(result.finalTotal).toBe(230_000)
    expect(result.appliedPromotions).toEqual([
      expect.objectContaining({ promotionId: 'high', discountAmount: 20_000 }),
    ])
  })

  it('adds free gift lines for buy-x-get-y rules', () => {
    const result = engine.preview(baseContext(), [
      activeRule({
        id: 'gift',
        type: 'BUY_X_GET_Y',
        conditions: { buyProductIds: ['product-1'], buyQuantity: 2 },
        reward: {
          type: 'FREE_ITEM',
          scope: 'ITEM',
          productId: 'product-2',
          productVariantId: 'variant-2',
          description: 'Toy gift',
          quantity: 1,
          unitPrice: 50_000,
        },
      }),
    ])

    expect(result.giftLines).toEqual([
      expect.objectContaining({
        productId: 'product-2',
        productVariantId: 'variant-2',
        quantity: 1,
        unitPrice: 0,
        originalUnitPrice: 50_000,
        promotionId: 'gift',
      }),
    ])
  })

  it('requires voucher code when a voucher promotion has codes', () => {
    const voucherRule = activeRule({
      id: 'voucher-promo',
      type: 'VOUCHER',
      voucherCodes: [
        { code: 'PET10', status: 'ACTIVE', customerId: 'customer-1', redeemedCount: 0, usageLimit: 1 },
      ],
      reward: { type: 'AMOUNT_OFF', scope: 'ORDER', value: 30_000 },
    })

    expect(engine.preview(baseContext(), [voucherRule]).discountTotal).toBe(0)
    expect(engine.preview(baseContext({ voucherCode: 'PET10' }), [voucherRule]).discountTotal).toBe(30_000)
  })

  it('supports customer and pet birthday conditions', () => {
    const result = engine.preview(baseContext(), [
      activeRule({
        id: 'birthday',
        type: 'BIRTHDAY',
        conditions: { birthdayTarget: 'CUSTOMER_OR_PET', birthdayWindowDays: 0 },
        reward: { type: 'AMOUNT_OFF', scope: 'ORDER', value: 15_000 },
      }),
    ])

    expect(result.discountTotal).toBe(15_000)
  })

  it('applies promotions only when schedule month, weekday, and time range match', () => {
    const scheduledRule = activeRule({
      id: 'scheduled',
      schedules: [
        {
          months: [5],
          weekdays: [7],
          timeRanges: [{ start: '16:00', end: '18:00' }],
        },
      ],
      reward: { type: 'AMOUNT_OFF', scope: 'ORDER', value: 25_000 },
    })

    expect(
      engine.preview(baseContext({ now: new Date(2026, 4, 10, 17, 0, 0) }), [scheduledRule])
        .discountTotal,
    ).toBe(25_000)
    expect(
      engine.preview(baseContext({ now: new Date(2026, 4, 10, 19, 0, 0) }), [scheduledRule])
        .rejectedPromotions,
    ).toEqual([expect.objectContaining({ promotionId: 'scheduled', reason: 'SCHEDULE_NOT_MATCHED' })])
  })

  it('returns a disabled result without applying promotions when module is off', () => {
    const result = engine.preview(baseContext({ featureEnabled: false }), [
      activeRule({ id: 'disabled' }),
    ])

    expect(result.enabled).toBe(false)
    expect(result.appliedPromotions).toEqual([])
    expect(result.discountTotal).toBe(0)
    expect(result.finalTotal).toBe(250_000)
  })
})
