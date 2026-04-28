import { OrderPaymentService } from './order-payment.service.js';

describe('OrderPaymentService', () => {
  const buildService = (prismaOverrides: Record<string, unknown> = {}) => {
    const prisma = {
      paymentIntent: {
        updateMany: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      ...prismaOverrides,
    };
    const accessService = {
      assertOrderScope: jest.fn(),
    };
    const numberingService = {
      generateFinanceVoucherNumber: jest.fn().mockResolvedValue('PT260428001'),
    };
    const paymentHelperService = {
      getPaymentLabel: jest.fn((method: string) => method),
    };
    const inventoryService = {
      deductProductBranchStock: jest.fn(),
    };

    return {
      prisma,
      accessService,
      service: new OrderPaymentService(
        prisma as any,
        accessService as any,
        numberingService as any,
        paymentHelperService as any,
        inventoryService as any,
      ),
    };
  };

  it('finds an order by orderNumber when recording a payment', async () => {
    const order = {
      id: 'order-1',
      orderNumber: 'DH260428003',
      status: 'PROCESSING',
      stockExportedAt: null,
      total: 1_490_000,
      paidAmount: 0,
      customerId: null,
      customerName: 'Khach le',
      branchId: 'branch-1',
      paymentStatus: 'UNPAID',
      customer: null,
      items: [],
      hotelStays: [],
    };
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(order),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback({})),
    };
    const accessService = {
      assertOrderScope: jest.fn(),
    };
    const service = new OrderPaymentService(
      prisma as any,
      accessService as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const normalizedPayments = [{ method: 'CARD', amount: 1_490_000 }];
    jest.spyOn(service, 'normalizePayments').mockResolvedValue(normalizedPayments as any);
    jest.spyOn(service, 'applyPaymentsToOrder').mockResolvedValue({ id: 'order-1', paymentStatus: 'PAID' } as any);

    await service.payOrder(
      'DH260428003',
      { payments: [{ method: 'CARD', amount: 1_490_000 }] } as any,
      'staff-1',
      { userId: 'staff-1' } as any,
    );

    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: 'DH260428003' }, { orderNumber: 'DH260428003' }] },
      include: expect.any(Object),
    });
    expect(accessService.assertOrderScope).toHaveBeenCalledWith(order, { userId: 'staff-1' });
    expect(service.applyPaymentsToOrder).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        order: expect.objectContaining({
          id: 'order-1',
          orderNumber: 'DH260428003',
        }),
        payments: normalizedPayments,
        staffId: 'staff-1',
      }),
    );
  });

  it('auto-completes a service order when payment becomes fully paid after export', async () => {
    const now = new Date('2026-04-28T09:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const { prisma, service } = buildService({
      transaction: {
        create: jest.fn(),
      },
      orderPayment: {
        create: jest.fn(),
      },
      orderTimeline: {
        create: jest.fn(),
      },
    });
    (prisma.order as any).update.mockResolvedValue({ id: 'order-1', status: 'COMPLETED' });

    await service.applyPaymentsToOrder(prisma as any, {
      order: {
        id: 'order-1',
        orderNumber: 'DH260428003',
        status: 'PROCESSING',
        stockExportedAt: new Date('2026-04-28T08:00:00.000Z'),
        total: 1_490_000,
        paidAmount: 0,
        customerId: null,
        customerName: 'Khach le',
        branchId: 'branch-1',
        paymentStatus: 'UNPAID',
        items: [{ id: 'item-1', type: 'hotel', quantity: 1, hotelStayId: 'stay-1' }],
        hotelStays: [{ id: 'stay-1', stayCode: 'H2604NK001' }],
      },
      payments: [{ method: 'CARD', amount: 1_490_000 }],
      staffId: 'staff-1',
    });

    expect((prisma.order as any).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: now,
          paidAmount: 1_490_000,
          remainingAmount: 0,
          paymentStatus: 'PAID',
        }),
      }),
    );
    expect(((prisma as any).orderTimeline as any).create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        action: 'SETTLED',
        fromStatus: 'PROCESSING',
        toStatus: 'COMPLETED',
        performedBy: 'staff-1',
        createdAt: now,
      }),
    });

    jest.useRealTimers();
  });

  it('auto-exports and completes a paid service-only order when service work is finished', async () => {
    const now = new Date('2026-04-28T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const { prisma, service } = buildService({
      transaction: {
        create: jest.fn(),
      },
      orderPayment: {
        create: jest.fn(),
      },
      orderTimeline: {
        create: jest.fn(),
      },
    });
    (prisma.order as any).update.mockResolvedValue({ id: 'order-1', status: 'COMPLETED' });

    await service.applyPaymentsToOrder(prisma as any, {
      order: {
        id: 'order-1',
        orderNumber: 'DH260428002',
        status: 'PROCESSING',
        stockExportedAt: null,
        total: 410_000,
        paidAmount: 0,
        customerId: null,
        customerName: 'Ly Huong',
        branchId: 'branch-1',
        paymentStatus: 'UNPAID',
        items: [
          {
            id: 'item-1',
            type: 'grooming',
            quantity: 1,
            groomingSessionId: 'session-1',
            groomingSession: { status: 'RETURNED' },
          } as any,
        ],
        hotelStays: [],
      },
      payments: [{ method: 'CASH', amount: 410_000 }],
      staffId: 'staff-1',
    });

    expect((prisma.order as any).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: now,
          stockExportedAt: now,
          stockExportedBy: 'staff-1',
          paidAmount: 410_000,
          remainingAmount: 0,
          paymentStatus: 'PAID',
        }),
      }),
    );
    expect(((prisma as any).orderTimeline as any).create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        action: 'STOCK_EXPORTED',
        fromStatus: 'PROCESSING',
        toStatus: 'COMPLETED',
        performedBy: 'staff-1',
        metadata: { source: 'PAYMENT_SERVICE_AUTO_EXPORT' },
        createdAt: now,
      }),
    });

    jest.useRealTimers();
  });
});
