jest.mock('./order-create.application.js', () => ({
  applyCreateOrderPostActions: jest.fn().mockResolvedValue(undefined),
}));

import { BadRequestException } from '@nestjs/common';
import { applyCreateOrderPostActions } from './order-create.application.js';
import { OrderCreateService } from './order-create.service.js';

describe('OrderCreateService', () => {
  it('rejects empty item lists', async () => {
    const service = new OrderCreateService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

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
          items: [
            {
              id: 'item-1',
              productId: 'product-1',
              productVariantId: null,
              quantity: 2,
              subtotal: 50_000,
            },
          ],
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
        {
          productId: 'product-1',
          quantity: 2,
          unitPrice: 25_000,
          subtotal: 50_000,
          type: 'product',
        },
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

    const service = new OrderCreateService(prisma as any, orderItemService as any, numberingService as any, paymentService as any, inventoryService as any, syncService as any);

    const result = await service.createOrder(
      {
        customerName: 'Khach A',
        branchId: 'branch-1',
        items: [
          {
            type: 'product',
            description: 'Pate',
            quantity: 2,
            unitPrice: 25_000,
            productId: 'product-1',
          },
        ],
        payments: [],
        discount: 0,
        shippingFee: 0,
      } as any,
      'staff-1',
    );

    expect(numberingService.generateOrderNumber).toHaveBeenCalledWith(tx);
    expect(orderItemService.validateAndNormalizeCreateItems).toHaveBeenCalledWith(tx, expect.any(Array));
    expect(tx.order.create).toHaveBeenCalled();
    expect(applyCreateOrderPostActions).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('order-1');
  });

  it('does not deduct branch stock immediately for processing product orders', async () => {
    const tx = {
      order: {
        create: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'DH0001',
          createdAt: new Date('2026-04-26T08:00:00.000Z'),
          completedAt: null,
          branchId: 'branch-1',
          items: [
            {
              id: 'item-1',
              productId: 'product-1',
              productVariantId: null,
              quantity: 2,
              subtotal: 50_000,
            },
          ],
          payments: [],
          customer: null,
        }),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 'product-1' }),
      },
      orderItem: {
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(tx)),
    };
    const orderItemService = {
      validateAndNormalizeCreateItems: jest.fn().mockResolvedValue([
        {
          productId: 'product-1',
          quantity: 2,
          unitPrice: 25_000,
          subtotal: 50_000,
          type: 'product',
        },
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

    const service = new OrderCreateService(prisma as any, orderItemService as any, numberingService as any, paymentService as any, inventoryService as any, syncService as any);

    await service.createOrder(
      {
        customerName: 'Khach A',
        branchId: 'branch-1',
        items: [
          {
            type: 'product',
            description: 'Pate',
            quantity: 2,
            unitPrice: 25_000,
            productId: 'product-1',
          },
        ],
        payments: [],
        discount: 0,
        shippingFee: 0,
      } as any,
      'staff-1',
    );

    const deps = (applyCreateOrderPostActions as jest.Mock).mock.calls.at(-1)[1];
    await deps.handleQuickProductItem({
      item: { productId: 'product-1', quantity: 2 },
      orderItem: { id: 'item-1' },
      order: { id: 'order-1', orderNumber: 'DH0001' },
      branchId: 'branch-1',
      orderStatus: 'PROCESSING',
      staffId: 'staff-1',
    });

    expect(inventoryService.deductProductBranchStock).not.toHaveBeenCalled();
    expect(tx.orderItem.update).not.toHaveBeenCalled();
  });

  it('retries when a generated order number collides', async () => {
    const uniqueOrderNumberError = {
      code: 'P2002',
      meta: { target: ['orderNumber'] },
    };
    const tx = {
      order: {
        create: jest
          .fn()
          .mockRejectedValueOnce(uniqueOrderNumberError)
          .mockResolvedValueOnce({
            id: 'order-2',
            orderNumber: 'DH260428002',
            createdAt: new Date('2026-04-28T08:00:00.000Z'),
            completedAt: null,
            branchId: 'branch-1',
            items: [
              {
                id: 'item-1',
                productId: 'product-1',
                productVariantId: null,
                quantity: 1,
                subtotal: 10_000,
              },
            ],
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
        {
          productId: 'product-1',
          quantity: 1,
          unitPrice: 10_000,
          subtotal: 10_000,
          type: 'product',
        },
      ]),
      buildOrderItemData: jest.fn().mockReturnValue({
        type: 'product',
        description: 'Pate',
        quantity: 1,
        unitPrice: 10_000,
        subtotal: 10_000,
        productId: 'product-1',
      }),
    };
    const numberingService = {
      generateOrderNumber: jest.fn().mockResolvedValueOnce('DH260428001').mockResolvedValueOnce('DH260428002'),
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

    const service = new OrderCreateService(prisma as any, orderItemService as any, numberingService as any, paymentService as any, inventoryService as any, syncService as any);

    const result = await service.createOrder(
      {
        branchId: 'branch-1',
        items: [
          {
            type: 'product',
            description: 'Pate',
            quantity: 1,
            unitPrice: 10_000,
            productId: 'product-1',
          },
        ],
        payments: [],
        discount: 0,
        shippingFee: 0,
      } as any,
      'staff-1',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(numberingService.generateOrderNumber).toHaveBeenCalledTimes(2);
    expect(tx.order.create).toHaveBeenCalledTimes(2);
    expect(result.orderNumber).toBe('DH260428002');
  });
});
