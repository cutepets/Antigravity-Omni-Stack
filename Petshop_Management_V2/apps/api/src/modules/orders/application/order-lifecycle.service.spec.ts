import { BadRequestException } from '@nestjs/common';
import { OrderLifecycleService } from './order-lifecycle.service.js';

describe('OrderLifecycleService', () => {
  const buildService = () => {
    const prisma = {
      order: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
      groomingSession: { findUnique: jest.fn() },
      hotelStay: { findUnique: jest.fn() },
    };
    const accessService = { assertOrderScope: jest.fn() };
    const queryService = { findOne: jest.fn().mockResolvedValue({ id: 'order-1' }) };
    const paymentService = {
      normalizePayments: jest.fn().mockResolvedValue([]),
      buildOrderServiceTraceParts: jest.fn().mockReturnValue([]),
      recordOrderPayments: jest.fn(),
      resolvePaymentAccount: jest.fn(),
      createOrderTransaction: jest.fn(),
      updateCustomerDebt: jest.fn(),
      incrementCustomerStats: jest.fn(),
    };
    const paymentIntentService = { expirePendingPaymentIntents: jest.fn() };
    const inventoryService = {
      deductProductBranchStock: jest.fn(),
      restoreProductBranchStock: jest.fn(),
      applyCompletedProductSalesDelta: jest.fn(),
    };
    const timelineService = {
      createTimelineEntry: jest.fn(),
      createStockExportTimelineEntry: jest.fn(),
    };

    return {
      prisma,
      queryService,
      timelineService,
      service: new OrderLifecycleService(
        prisma as any,
        accessService as any,
        queryService as any,
        paymentService as any,
        paymentIntentService as any,
        inventoryService as any,
        timelineService as any,
      ),
    };
  };

  it('rejects completing an already completed order', async () => {
    const { prisma, service } = buildService();
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DH1',
      status: 'COMPLETED',
      items: [],
      customer: null,
    });

    await expect(service.completeOrder('order-1', {} as any, 'staff-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves pending orders and reloads the enriched view', async () => {
    const { prisma, queryService, timelineService, service } = buildService();
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DH1',
      status: 'PENDING',
      branchId: 'branch-1',
      items: [],
    });
    prisma.$transaction.mockImplementation(async (callback: any) => callback({
      order: { update: jest.fn() },
    }));

    await service.approveOrder('order-1', { note: 'ok' }, 'staff-1', { userId: 'u1' } as any);

    expect(timelineService.createTimelineEntry).toHaveBeenCalled();
    expect(queryService.findOne).toHaveBeenCalledWith('order-1', { userId: 'u1' });
  });

  it('completes a paid service order when stock export finishes', async () => {
    const { prisma, queryService, timelineService, service } = buildService();
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DH260428003',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      branchId: 'branch-1',
      items: [
        {
          id: 'item-1',
          type: 'hotel',
          productId: null,
          groomingSession: null,
          hotelStay: { id: 'stay-1', status: 'CHECKED_OUT' },
        },
        {
          id: 'item-2',
          type: 'product',
          productId: 'product-1',
          productVariantId: null,
          quantity: 1,
          isTemp: false,
          stockExportedAt: null,
          groomingSession: null,
          hotelStay: null,
        },
      ],
    });
    const orderUpdate = jest.fn();
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { update: orderUpdate },
        orderItem: { update: jest.fn() },
      }),
    );

    await service.exportStock('DH260428003', { note: 'done' }, 'staff-1', { userId: 'u1' } as any);

    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        stockExportedAt: expect.any(Date),
        stockExportedBy: 'staff-1',
      }),
    });
    expect(timelineService.createStockExportTimelineEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        fromStatus: 'PROCESSING',
        toStatus: 'COMPLETED',
        exportedItemCount: 1,
      }),
      expect.any(Object),
    );
    expect(queryService.findOne).toHaveBeenCalledWith('order-1', { userId: 'u1' });
  });

  it('marks a paid service-only grooming order exported and completed when the pet has been returned', async () => {
    const { prisma, queryService, timelineService, service } = buildService();
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DH260428002',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      branchId: 'branch-1',
      items: [
        {
          id: 'item-1',
          type: 'grooming',
          productId: null,
          groomingSession: { id: 'session-1', status: 'RETURNED' },
          hotelStay: null,
        },
      ],
    });
    const orderUpdate = jest.fn();
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { update: orderUpdate },
        orderItem: { update: jest.fn() },
      }),
    );

    await service.exportStock('DH260428002', { note: 'done' }, 'staff-1', { userId: 'u1' } as any);

    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        stockExportedAt: expect.any(Date),
        stockExportedBy: 'staff-1',
      }),
    });
    expect(timelineService.createStockExportTimelineEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        fromStatus: 'PROCESSING',
        toStatus: 'COMPLETED',
        exportedItemCount: 0,
        metadata: { hasServiceItems: true },
      }),
      expect.any(Object),
    );
    expect(queryService.findOne).toHaveBeenCalledWith('order-1', { userId: 'u1' });
  });
});
