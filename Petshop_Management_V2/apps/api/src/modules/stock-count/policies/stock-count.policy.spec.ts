import { BadRequestException } from '@nestjs/common'
import { buildSessionProgressUpdate, resolveCountedQuantity } from './stock-count.policy'

describe('stock count policy', () => {
  it('resolves counted quantity from system quantity and variance', () => {
    expect(resolveCountedQuantity(10, -3)).toBe(7)
    expect(resolveCountedQuantity(10, 2)).toBe(12)
  })

  it('blocks negative counted quantity', () => {
    expect(() => resolveCountedQuantity(2, -3)).toThrow(BadRequestException)
  })

  it('keeps draft session when at least one shift is still draft', () => {
    expect(
      buildSessionProgressUpdate({
        status: 'DRAFT',
        shifts: [
          { status: 'SUBMITTED', countedItems: 3 },
          { status: 'DRAFT', countedItems: 1 },
        ],
      }),
    ).toEqual({ countedProducts: 4, status: 'DRAFT' })
  })

  it('marks session submitted when all shifts are submitted or approved', () => {
    expect(
      buildSessionProgressUpdate({
        status: 'DRAFT',
        shifts: [
          { status: 'SUBMITTED', countedItems: 3 },
          { status: 'APPROVED', countedItems: 2 },
        ],
      }),
    ).toEqual({ countedProducts: 5, status: 'SUBMITTED' })
  })

  it('preserves terminal approved or rejected status', () => {
    expect(buildSessionProgressUpdate({ status: 'APPROVED', shifts: [] })).toEqual({
      countedProducts: 0,
      status: 'APPROVED',
    })
    expect(buildSessionProgressUpdate({ status: 'REJECTED', shifts: [] })).toEqual({
      countedProducts: 0,
      status: 'REJECTED',
    })
  })
})
