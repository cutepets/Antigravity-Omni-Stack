import { BadRequestException, NotFoundException } from '@nestjs/common'
import { normalizeBulkDeleteIds, runBulkDelete } from './bulk-delete.util.js'

describe('bulk-delete utilities', () => {
  it('deduplicates ids and rejects empty payloads', () => {
    expect(normalizeBulkDeleteIds(['a', 'a', ' b '])).toEqual(['a', 'b'])
    expect(() => normalizeBulkDeleteIds([])).toThrow(BadRequestException)
  })

  it('rejects oversized batches', () => {
    expect(() => normalizeBulkDeleteIds(Array.from({ length: 101 }, (_, index) => `id-${index}`))).toThrow(BadRequestException)
  })

  it('returns partial success with blocked reasons', async () => {
    const result = await runBulkDelete(['ok', 'missing'], async (id) => {
      if (id === 'missing') throw new NotFoundException('Khong tim thay')
    })

    expect(result).toEqual({
      success: true,
      deletedIds: ['ok'],
      blocked: [{ id: 'missing', reason: 'Khong tim thay' }],
    })
  })
})
