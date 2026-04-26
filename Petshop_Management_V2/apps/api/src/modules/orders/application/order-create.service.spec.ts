jest.mock('./order-create.application.js', () => ({
  applyCreateOrderPostActions: jest.fn().mockResolvedValue(undefined),
}));

import { BadRequestException } from '@nestjs/common';
import { applyCreateOrderPostActions } from './order-create.application.js';
import { OrderCreateService } from './order-create.service.js';

describe('OrderCreateService', () => {
  it('rejects empty item lists', async () => {
    const service = new OrderCreateService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.createOrder({ items: [] } as any, 'staff-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an order with normalized items and runs post actions', async () => {
    const tx = {
      order: {
        create: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'DH0001',
          createdAt: new Date('2026-04-26T08:00:00.000Z'),
          completedAt: null,
          branchId: 'branch-1',
          items: [{ id: 'item-1', productId: 'product-1', productVariantId: null, quantity: 2, subtotal: 50_000 }],
          payments: [],
          customer: null,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(tx)),
    };
    const orderItemService = {
      validateAndNormalizeCreateItems: jest.fn().mockResolvedValue([
        { productId: 'product-1', quantity: 2, unitPrice: 25_000, subtotal: 50_000, type: 'product' },
      ]),
      buildOrderItemData: jest.fn().mockReturnValue({
        type: 'product',
        description: 'Pate',
        quantity: 2,
        unitPrice: 25_000,
        subtotal: 50_000,
        productId: 'product-1',
      }),
    };
    const numberingService = {
      generateOrderNumber: jest.fn().mockResolvedValue('DH0001'),
    };
    const paymentService = {
      normalizePayments: jest.fn().mockResolvedValue([]),
      incrementCustomerStats: jest.fn(),
      getPaymentLabel: jest.fn(),
      buildServiceTraceTags: jest.fn(),
      mergeTransactionNotes: jest.fn(),
      generateVoucherNumberFor: jest.fn(),
    };
    const inventoryService = {
      deductProductBranchStock: jest.fn(),
      applyCompletedProductSalesDelta: jest.fn(),
    };
    const syncService = {
      syncGroomingSession: jest.fn(),
      syncHotelStay: jest.fn(),
      syncGroupedHotelStay: jest.fn(),
    };

    const service = new OrderCreateService(
      prisma as any,
      orderItemService as any,
      numberingService as any,
      paymentService as any,
      inventoryService as any,
      syncService as any,
    );

    const result = await service.createOrder({
      customerName: 'Khach A',
      branchId: 'branch-1',
      items: [{ type: 'product', description: 'Pate', quantity: 2, unitPrice: 25_000, productId: 'product-1' }],
      payments: [],
      discount: 0,
      shippingFee: 0,
    } as any, 'staff-1');

    expect(numberingService.generateOrderNumber).toHaveBeenCalledWith(prisma);
    expect(orderItemService.validateAndNormalizeCreateItems).toHaveBeenCalledWith(tx, expect.any(Array));
    expect(tx.order.create).toHaveBeenCalled();
    expect(applyCreateOrderPostActions).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('order-1');
  });
});
