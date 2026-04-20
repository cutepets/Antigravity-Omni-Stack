import {
  createOrderTimelineEntry,
  createStockExportTimelineEntry,
} from './order-timeline.application'

describe('order-timeline.application', () => {
  it('creates a generic order timeline entry with nullable defaults', async () => {
    const writer = {
      create: jest.fn().mockResolvedValue({ id: 'timeline-1' }),
    }

    const result = await createOrderTimelineEntry(writer as any, {
      orderId: 'order-1',
      action: 'APPROVED',
      performedBy: 'staff-1',
    })

    expect(result).toEqual({ id: 'timeline-1' })
    expect(writer.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        action: 'APPROVED',
        fromStatus: null,
        toStatus: null,
        note: null,
        performedBy: 'staff-1',
        metadata: undefined,
      },
    })
  })

  it('creates a stock-exported timeline entry with note and metadata summary', async () => {
    const writer = {
      create: jest.fn().mockResolvedValue({ id: 'timeline-2' }),
    }

    await createStockExportTimelineEntry(writer as any, {
      orderId: 'order-1',
      fromStatus: 'PROCESSING',
      toStatus: 'COMPLETED',
      performedBy: 'staff-1',
      occurredAt: new Date('2026-04-20T10:15:00.000Z'),
      exportedItemCount: 3,
      pendingTempCount: 1,
      note: 'ghi chú thêm',
      metadata: { source: 'POS_COMPLETE' },
    })

    expect(writer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        action: 'STOCK_EXPORTED',
        fromStatus: 'PROCESSING',
        toStatus: 'COMPLETED',
        performedBy: 'staff-1',
        metadata: {
          source: 'POS_COMPLETE',
          exportedItemCount: 3,
          pendingTempCount: 1,
        },
      }),
    })
    const note = writer.create.mock.calls[0][0].data.note as string
    expect(note).toContain('3 sản phẩm được trừ kho')
    expect(note).toContain('1 sản phẩm tạm chưa đổi')
    expect(note).toContain('ghi chú thêm')
  })
})
