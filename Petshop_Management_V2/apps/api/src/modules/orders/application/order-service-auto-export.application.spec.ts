import { autoExportPaidServiceOnlyOrder } from './order-service-auto-export.application';

describe('autoExportPaidServiceOnlyOrder', () => {
  it('completes a paid service-only grooming order when the pet has been returned', async () => {
    const now = new Date('2026-04-28T10:00:00.000Z');
    const db = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: 'PROCESSING',
          paymentStatus: 'PAID',
          stockExportedAt: null,
          items: [
            {
              id: 'item-1',
              type: 'grooming',
              productId: null,
              groomingSession: { status: 'RETURNED' },
              hotelStay: null,
            },
          ],
        }),
        update: jest.fn(),
      },
      orderTimeline: {
        create: jest.fn(),
      },
    };

    await expect(
      autoExportPaidServiceOnlyOrder(db as any, {
        orderId: 'order-1',
        staffId: 'staff-1',
        source: 'GROOMING_RETURNED_AUTO_EXPORT',
        occurredAt: now,
      }),
    ).resolves.toBe(true);

    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        stockExportedAt: now,
        stockExportedBy: 'staff-1',
      },
    });
    expect(db.orderTimeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          action: 'STOCK_EXPORTED',
          fromStatus: 'PROCESSING',
          toStatus: 'COMPLETED',
          performedBy: 'staff-1',
          metadata: expect.objectContaining({
            source: 'GROOMING_RETURNED_AUTO_EXPORT',
            hasServiceItems: true,
            exportedItemCount: 0,
          }),
        }),
      }),
    );
  });

  it('does not auto-export when the order still has physical products', async () => {
    const db = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: 'PROCESSING',
          paymentStatus: 'PAID',
          stockExportedAt: null,
          items: [
            { id: 'item-1', type: 'grooming', groomingSession: { status: 'RETURNED' } },
            { id: 'item-2', type: 'product', productId: 'product-1', isTemp: false },
          ],
        }),
        update: jest.fn(),
      },
      orderTimeline: {
        create: jest.fn(),
      },
    };

    await expect(
      autoExportPaidServiceOnlyOrder(db as any, {
        orderId: 'order-1',
        staffId: 'staff-1',
        source: 'GROOMING_RETURNED_AUTO_EXPORT',
      }),
    ).resolves.toBe(false);

    expect(db.order.update).not.toHaveBeenCalled();
    expect(db.orderTimeline.create).not.toHaveBeenCalled();
  });
});
