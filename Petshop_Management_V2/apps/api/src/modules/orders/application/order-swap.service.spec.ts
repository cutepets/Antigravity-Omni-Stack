import { BadRequestException } from '@nestjs/common';
import { OrderSwapService } from './order-swap.service.js';

describe('OrderSwapService', () => {
  const buildService = () => {
    const prisma = {
      order: { findUnique: jest.fn(), findFirst: jest.fn() },
      productVariant: { findUnique: jest.fn() },
      pet: { findUnique: jest.fn() },
      spaPriceRule: { findUnique: jest.fn() },
      service: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    const accessService = { assertOrderScope: jest.fn() };
    const orderItemService = {
      getGroomingOrderItemRole: jest.fn().mockReturnValue('MAIN'),
      getGroomingOrderItemSnapshot: jest.fn().mockReturnValue({ pricingRuleId: 'rule-1', weightAtBooking: 5 }),
    };
    const paymentHelperService = {
      calculatePaymentStatus: jest.fn().mockReturnValue('PAID'),
      calculateRemainingAmount: jest.fn().mockReturnValue(0),
    };
    const paymentService = { resolvePaymentAccount: jest.fn(), createOrderTransaction: jest.fn() };
    const queryService = { findOne: jest.fn().mockResolvedValue({ id: 'order-1' }) };
    const syncService = { refreshGroomingSessionFromOrderItems: jest.fn() };
    const timelineService = { createTimelineEntry: jest.fn() };

    return {
      prisma,
      orderItemService,
      service: new OrderSwapService(
        prisma as any,
        accessService as any,
        orderItemService as any,
        paymentHelperService as any,
        paymentService as any,
        queryService as any,
        syncService as any,
        timelineService as any,
      ),
    };
  };

  it('rejects swapping a non-temp item', async () => {
    const { prisma, service } = buildService();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      items: [{ id: 'item-1', type: 'product', productId: 'product-1', productVariantId: 'variant-1' }],
    });

    await expect(service.swapTempItem('order-1', 'item-1', { realProductId: 'p1', realProductVariantId: 'v1' }, 'staff-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects swapping an extra grooming line', async () => {
    const { prisma, orderItemService, service } = buildService();
    orderItemService.getGroomingOrderItemRole.mockReturnValue('EXTRA');
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DH1',
      status: 'PENDING',
      discount: 0,
      shippingFee: 0,
      paidAmount: 0,
      items: [{ id: 'item-1', type: 'grooming', groomingSessionId: 'gs-1' }],
      customer: null,
    });

    await expect(service.swapGroomingService('order-1', 'item-1', { targetPricingRuleId: 'rule-2' } as any, 'staff-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
