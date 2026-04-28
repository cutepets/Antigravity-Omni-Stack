import { OrderServiceSyncService } from './order-service-sync.service.js';

describe('OrderServiceSyncService', () => {
  const buildService = () => {
    const numberingService = {
      generateHotelStayCode: jest.fn().mockResolvedValue('H2604NK001'),
    };
    const orderItemService = {
      buildHotelOrderItemPricingSnapshot: jest.fn().mockReturnValue({ source: 'TEST' }),
      getGroomingOrderItemRole: jest.fn(),
      getGroomingOrderItemSnapshot: jest.fn(),
    };

    return {
      numberingService,
      orderItemService,
      service: new OrderServiceSyncService(numberingService as any, orderItemService as any),
    };
  };

  it('does not send derived totalDays as a HotelStay column when syncing grouped hotel lines', async () => {
    const { service } = buildService();
    const tx = {
      branch: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'BR1', name: 'Branch 1' }),
      },
      pet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pet-1', name: 'Milu' }),
      },
      hotelStay: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'stay-1' }),
      },
      orderItem: {
        update: jest.fn(),
      },
    };

    await service.syncGroupedHotelStay(tx as any, {
      order: { id: 'order-1', createdAt: new Date('2026-04-28T04:10:37.683Z') },
      customerId: 'customer-1',
      branchId: 'branch-1',
      entries: [
        {
          orderItem: { id: 'item-1' },
          item: {
            description: 'Hotel lưu trú - Mèo',
            quantity: 1,
            unitPrice: 70_000,
            discountItem: 0,
            hotelDetails: {
              petId: 'pet-1',
              checkInDate: '2026-04-28T04:10:37.683Z',
              checkOutDate: '2026-04-29T04:10:37.683Z',
              lineType: 'REGULAR',
              chargeQuantityDays: 1,
              chargeUnitPrice: 70_000,
              chargeSubtotal: 70_000,
            },
          },
        },
      ],
    });

    expect(tx.hotelStay.create).toHaveBeenCalledTimes(1);
    expect(tx.hotelStay.create.mock.calls[0][0].data).not.toHaveProperty('totalDays');
    expect(tx.hotelStay.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ status: 'BOOKED' }),
    );
    expect(tx.hotelStay.create.mock.calls[0][0].data).not.toHaveProperty('checkedInAt');
    expect(tx.hotelStay.create.mock.calls[0][0].data.breakdownSnapshot).toEqual(
      expect.objectContaining({ totalDays: 1 }),
    );
  });

  it('creates grouped hotel stays as checked-in when POS create-service flow requests check-in now', async () => {
    const { service } = buildService();
    const tx = {
      branch: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'BR1', name: 'Branch 1' }),
      },
      pet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pet-1', name: 'Milu' }),
      },
      hotelStay: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'stay-1' }),
      },
      orderItem: {
        update: jest.fn(),
      },
    };

    await service.syncGroupedHotelStay(tx as any, {
      order: { id: 'order-1', createdAt: new Date('2026-04-28T04:10:37.683Z') },
      customerId: 'customer-1',
      branchId: 'branch-1',
      entries: [
        {
          orderItem: { id: 'item-1' },
          item: {
            description: 'Hotel lưu trú - Mèo',
            quantity: 1,
            unitPrice: 70_000,
            discountItem: 0,
            hotelDetails: {
              petId: 'pet-1',
              checkInDate: '2026-04-28T04:10:37.683Z',
              checkOutDate: '2026-04-29T04:10:37.683Z',
              checkInNow: true,
              lineType: 'REGULAR',
              chargeQuantityDays: 1,
              chargeUnitPrice: 70_000,
              chargeSubtotal: 70_000,
            },
          },
        },
      ],
    });

    expect(tx.hotelStay.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        status: 'CHECKED_IN',
        checkedInAt: expect.any(Date),
      }),
    );
  });

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
