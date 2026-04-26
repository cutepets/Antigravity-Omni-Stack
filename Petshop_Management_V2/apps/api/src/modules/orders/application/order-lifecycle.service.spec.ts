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
});
