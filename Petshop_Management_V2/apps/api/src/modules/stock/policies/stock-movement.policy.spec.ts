import { BadRequestException } from '@nestjs/common'
import { assertSufficientBranchStock } from './stock-movement.policy'

describe('stock movement policy', () => {
  it('allows inbound stock movement without existing stock row', () => {
    expect(() => assertSufficientBranchStock(null, 5)).not.toThrow()
  })

  it('allows outbound stock movement when branch stock is enough', () => {
    expect(() => assertSufficientBranchStock({ stock: 8 }, -3)).not.toThrow()
  })

  it('blocks outbound stock movement when branch stock is missing or too low', () => {
    expect(() => assertSufficientBranchStock(null, -1)).toThrow(BadRequestException)
    expect(() => assertSufficientBranchStock({ stock: 2 }, -3)).toThrow(BadRequestException)
  })
})
