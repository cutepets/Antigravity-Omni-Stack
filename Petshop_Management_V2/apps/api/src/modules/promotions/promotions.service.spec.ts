import { PromotionsService } from './promotions.service'

describe('PromotionsService', () => {
  it('creates promotion schedules and optional voucher batch after creating a voucher promotion', async () => {
    const db: any = {
      promotion: {
        create: jest.fn().mockResolvedValue({ id: 'promo-1', code: 'PET10' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'promo-1' }),
      },
      promotionSchedule: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: any) =>
        callback({
          promotionVoucherBatch: {
            create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
          },
          promotionVoucherCode: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        }),
      ),
    }
    const service = new PromotionsService(db, {} as any)

    await service.create(
      {
        code: ' pet10 ',
        name: 'Pet 10',
        type: 'VOUCHER',
        reward: { type: 'AMOUNT_OFF', scope: 'ORDER', value: 10_000 },
        schedules: [{ weekdays: [1, 2], timeRanges: [{ start: '09:00', end: '18:00' }] }],
        voucherBatch: { name: 'Launch batch', prefix: 'PET', quantity: 2, usageLimitPerCode: 1 },
      } as any,
      'staff-1',
    )

    expect(db.promotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'PET10', name: 'Pet 10' }),
      }),
    )
    expect(db.promotionSchedule.createMany).toHaveBeenCalledWith({
      data: [
        {
          promotionId: 'promo-1',
          months: null,
          monthDays: null,
          weekdays: [1, 2],
          timeRanges: [{ start: '09:00', end: '18:00' }],
        },
      ],
    })
    expect(db.$transaction).toHaveBeenCalled()
  })
})
