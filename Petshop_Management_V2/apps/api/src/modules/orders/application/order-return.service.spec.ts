import { BadRequestException } from '@nestjs/common';
import { OrderReturnService } from './order-return.service.js';

describe('OrderReturnService', () => {
  const buildService = () => {
    const prisma = {
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
      systemConfig: { findFirst: jest.fn() },
    };
    const accessService = { assertOrderScope: jest.fn() };
    const numberingService = { generateOrderNumber: jest.fn() };
    const orderItemService = {
      validateAndNormalizeCreateItems: jest.fn(),
      buildOrderItemData: jest.fn(),
    };
    const inventoryService = { restoreProductBranchStock: jest.fn(), deductProductBranchStock: jest.fn() };
    const timelineService = { createTimelineEntry: jest.fn(), createStockExportTimelineEntry: jest.fn() };

    return {
      prisma,
      timelineService,
      service: new OrderReturnService(
        prisma as any,
        accessService as any,
        numberingService as any,
        orderItemService as any,
        inventoryService as any,
        timelineService as any,
      ),
    };
  };

  it('rejects removing items from completed orders', async () => {
    const { prisma, service } = buildService();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'COMPLETED',
      items: [{ id: 'item-1' }],
    });

    await expect(service.removeOrderItem('order-1', 'item-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes an item and recalculates totals', async () => {
    const { prisma, service } = buildService();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      shippingFee: 5_000,
      discount: 1_000,
      paidAmount: 10_000,
      items: [
        { id: 'item-1', subtotal: 20_000, groomingSessionId: 'gs-1', hotelStayId: null },
        { id: 'item-2', subtotal: 15_000, groomingSessionId: null, hotelStayId: null },
      ],
    });
    prisma.$transaction.mockImplementation(async (callback: any) => callback({
      groomingSession: { update: jest.fn() },
      hotelStay: { findUnique: jest.fn(), update: jest.fn() },
      orderItem: { delete: jest.fn() },
      order: { update: jest.fn().mockResolvedValue({ id: 'order-1', total: 19_000, remainingAmount: 9_000 }) },
    }));

    const result = await service.removeOrderItem('order-1', 'item-1');

    expect(result.total).toBe(19_000);
    expect(result.remainingAmount).toBe(9_000);
  });
});
