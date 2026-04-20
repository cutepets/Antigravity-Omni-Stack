import { applyCreateOrderPostActions } from './order-create.application'

describe('order-create.application', () => {
  it('delegates create-order side effects to injected handlers', async () => {
    const deps = {
      handleQuickProductItem: jest.fn().mockResolvedValue(undefined),
      syncGroomingSession: jest.fn().mockResolvedValue('session-1'),
      syncHotelStay: jest.fn().mockResolvedValue('stay-1'),
      syncGroupedHotelStay: jest.fn().mockResolvedValue(undefined),
      recordInitialPayments: jest.fn().mockResolvedValue(undefined),
      incrementCustomerStats: jest.fn().mockResolvedValue(undefined),
      applyCompletedProductSalesDelta: jest.fn().mockResolvedValue(undefined),
      createQuickStockExportTimeline: jest.fn().mockResolvedValue(undefined),
    }

    await applyCreateOrderPostActions(
      {
        order: {
          id: 'order-1',
          orderNumber: 'DH001',
          createdAt: new Date('2026-04-20T08:00:00.000Z'),
          completedAt: new Date('2026-04-20T08:05:00.000Z'),
          branchId: 'branch-1',
          items: [
            { id: 'item-1', productId: 'product-1', productVariantId: 'variant-1', quantity: 2, subtotal: 100_000 },
            { id: 'item-2', productId: null, productVariantId: null, quantity: 1, subtotal: 200_000 },
            { id: 'item-3', productId: null, productVariantId: null, quantity: 2, subtotal: 300_000 },
          ],
        },
        normalizedItems: [
          { id: 'item-1', type: 'product', productId: 'product-1', productVariantId: 'variant-1', quantity: 2, description: 'P1' },
          {
            id: 'item-2',
            type: 'service',
            productId: null,
            productVariantId: null,
            quantity: 1,
            description: 'Spa',
            serviceId: 'service-1',
            groomingDetails: { petId: 'pet-1' },
          },
          {
            id: 'item-3',
            type: 'hotel',
            productId: null,
            productVariantId: null,
            quantity: 2,
            description: 'Hotel',
            petId: 'pet-2',
            hotelDetails: {
              bookingGroupKey: 'booking-1',
              checkInDate: '2026-04-20T08:00:00.000Z',
              checkOutDate: '2026-04-22T08:00:00.000Z',
            },
          },
        ] as any[],
        orderType: 'QUICK',
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
        normalizedPayments: [{ method: 'CASH', amount: 120_000 }],
        customerId: 'customer-1',
        branchId: 'branch-1',
        total: 600_000,
        notes: 'ghi chú',
        staffId: 'staff-1',
      },
      deps,
    )

    expect(deps.handleQuickProductItem).toHaveBeenCalledTimes(1)
    expect(deps.syncGroomingSession).toHaveBeenCalledTimes(1)
    expect(deps.syncHotelStay).not.toHaveBeenCalled()
    expect(deps.syncGroupedHotelStay).toHaveBeenCalledTimes(1)
    expect(deps.recordInitialPayments).toHaveBeenCalledWith({
      order: expect.objectContaining({ id: 'order-1' }),
      normalizedPayments: [{ method: 'CASH', amount: 120_000 }],
      notes: 'ghi chú',
      staffId: 'staff-1',
      serviceTraceParts: ['GROOMING_SESSION:session-1', 'HOTEL_GROUP:booking-1'],
    })
    expect(deps.incrementCustomerStats).toHaveBeenCalledWith('customer-1', 600_000)
    expect(deps.applyCompletedProductSalesDelta).toHaveBeenCalledTimes(1)
    expect(deps.createQuickStockExportTimeline).toHaveBeenCalledWith({
      order: expect.objectContaining({ id: 'order-1' }),
      physicalItemCount: 1,
      staffId: 'staff-1',
    })
  })
})
