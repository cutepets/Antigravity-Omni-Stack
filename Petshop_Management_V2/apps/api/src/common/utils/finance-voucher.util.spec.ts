import { formatFinanceVoucherNumber, generateFinanceVoucherNumber } from './finance-voucher.util'

describe('finance voucher util', () => {
  it('formats income vouchers with a 3-digit daily sequence', () => {
    expect(formatFinanceVoucherNumber('INCOME', new Date('2026-04-08T10:00:00.000Z'), 1)).toBe('PT260408001')
  })

  it('formats expense vouchers with a 4-digit daily sequence', () => {
    expect(formatFinanceVoucherNumber('EXPENSE', new Date('2026-04-08T10:00:00.000Z'), 12)).toBe('PC2604080012')
  })

  it('increments from the latest voucher sharing the same prefix and date stem', async () => {
    const db = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue({ voucherNumber: 'PT260408009' }),
      },
    } as any

    await expect(generateFinanceVoucherNumber(db, 'INCOME', new Date('2026-04-08T12:30:00.000Z'))).resolves.toBe('PT260408010')
    expect(db.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          voucherNumber: expect.objectContaining({
            startsWith: 'PT260408',
          }),
        }),
      }),
    )
  })
})
