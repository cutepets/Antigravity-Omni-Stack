import { OrderServiceSyncService } from './order-service-sync.service.js';

describe('OrderServiceSyncService', () => {
  it('refreshes grooming sessions from grouped order items', async () => {
    const numberingService = {};
    const orderItemService = {
      getGroomingOrderItemRole: jest.fn().mockImplementation((item: any) => item.id === 'item-2' ? 'EXTRA' : 'MAIN'),
      getGroomingOrderItemSnapshot: jest.fn().mockImplementation((item: any) => (
        item.id === 'item-2'
          ? { pricingRuleId: 'rule-extra', pricingSnapshot: {}, serviceName: 'Nail', price: 20_000 }
          : { packageCode: 'BATH', weightAtBooking: 5, weightBandId: 'wb-1', pricingSnapshot: {} }
      )),
    };
    const tx = {
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'item-1', serviceId: 'service-1', description: 'Tam', unitPrice: 100_000, quantity: 1, discountItem: 0 },
          { id: 'item-2', serviceId: null, description: 'Nail', unitPrice: 20_000, quantity: 1, discountItem: 0, sku: 'NAIL' },
        ]),
      },
      groomingSession: {
        update: jest.fn(),
      },
    };

    const service = new OrderServiceSyncService(numberingService as any, orderItemService as any);
    await service.refreshGroomingSessionFromOrderItems(tx as any, 'session-1');

    expect(tx.groomingSession.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session-1' },
      data: expect.objectContaining({
        serviceId: 'service-1',
        pricingSnapshot: expect.objectContaining({
          grossAmount: 120_000,
          extraServices: expect.any(Array),
        }),
      }),
    }));
  });
});
