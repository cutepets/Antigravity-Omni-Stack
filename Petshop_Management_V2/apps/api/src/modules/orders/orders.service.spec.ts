import { OrdersService } from './orders.service';

describe('OrdersService facade', () => {
  let service: OrdersService;
  let catalog: any;
  let query: any;
  let createService: any;
  let updateService: any;
  let payments: any;
  let paymentIntents: any;
  let lifecycle: any;
  let returns: any;
  let deletions: any;
  let swaps: any;
  let timeline: any;

  beforeEach(() => {
    catalog = {
      getProducts: jest.fn().mockResolvedValue(['product']),
      getServices: jest.fn().mockResolvedValue(['service']),
    };
    query = {
      findAll: jest.fn().mockResolvedValue({ data: [] }),
      findOne: jest.fn().mockResolvedValue({ id: 'order-1' }),
    };
    createService = {
      createOrder: jest.fn().mockResolvedValue({ id: 'order-created' }),
    };
    updateService = {
      updateOrder: jest.fn().mockResolvedValue({ id: 'order-updated' }),
    };
    payments = {
      payOrder: jest.fn().mockResolvedValue({ id: 'order-paid' }),
    };
    paymentIntents = {
      listPaymentIntents: jest.fn().mockResolvedValue([]),
      getPaymentIntentByCode: jest.fn().mockResolvedValue({ code: 'PI1' }),
      createPaymentIntent: jest.fn().mockResolvedValue({ code: 'PI2' }),
      confirmPaymentIntentPaidFromWebhook: jest.fn().mockResolvedValue({ outcome: 'APPLIED' }),
    };
    lifecycle = {
      completeOrder: jest.fn().mockResolvedValue({ id: 'order-completed' }),
      cancelOrder: jest.fn().mockResolvedValue({ id: 'order-cancelled' }),
      approveOrder: jest.fn().mockResolvedValue({ id: 'order-approved' }),
      exportStock: jest.fn().mockResolvedValue({ id: 'order-exported' }),
      settleOrder: jest.fn().mockResolvedValue({ id: 'order-settled' }),
    };
    returns = {
      refundOrder: jest.fn().mockResolvedValue({ id: 'order-refunded' }),
      removeOrderItem: jest.fn().mockResolvedValue({ id: 'order-item-removed' }),
      createReturnRequest: jest.fn().mockResolvedValue({ returnRequest: { id: 'return-1' } }),
    };
    deletions = {
      deleteOrderCascade: jest.fn().mockResolvedValue({ success: true, deletedIds: ['order-1'], deletedOrderNumbers: ['DH1'] }),
      bulkDeleteOrders: jest.fn().mockResolvedValue({ success: true }),
    };
    swaps = {
      swapTempItem: jest.fn().mockResolvedValue({ id: 'order-swapped-temp' }),
      swapGroomingService: jest.fn().mockResolvedValue({ id: 'order-swapped-grooming' }),
    };
    timeline = {
      getOrderTimeline: jest.fn().mockResolvedValue([]),
      getTimeline: jest.fn().mockResolvedValue([]),
    };

    service = new OrdersService(
      catalog,
      query,
      createService,
      updateService,
      payments,
      paymentIntents,
      lifecycle,
      returns,
      deletions,
      swaps,
      timeline,
    );
  });

  it('delegates catalog and query methods', async () => {
    await expect(service.getProducts()).resolves.toEqual(['product']);
    await expect(service.getServices()).resolves.toEqual(['service']);
    await expect(service.findAll({ page: 1 }, { userId: 'u1' } as any)).resolves.toEqual({ data: [] });
    await expect(service.findOne('order-1', { userId: 'u1' } as any)).resolves.toEqual({ id: 'order-1' });

    expect(catalog.getProducts).toHaveBeenCalledTimes(1);
    expect(catalog.getServices).toHaveBeenCalledTimes(1);
    expect(query.findAll).toHaveBeenCalledWith({ page: 1 }, { userId: 'u1' });
    expect(query.findOne).toHaveBeenCalledWith('order-1', { userId: 'u1' });
  });

  it('delegates create, update, and payment methods', async () => {
    const createDto = { items: [{ description: 'Pate', type: 'product', quantity: 1, unitPrice: 10_000, productId: 'p1' }] };
    const updateDto = { ...createDto, discount: 1_000 };
    const payDto = { payments: [{ method: 'CASH', amount: 9_000 }] };
    const intentDto = { paymentMethodId: 'pm-1', amount: 9_000 };

    await service.createOrder(createDto as any, 'staff-1');
    await service.updateOrder('order-1', updateDto as any, 'staff-1', { userId: 'u1' } as any);
    await service.payOrder('order-1', payDto as any, 'staff-1', { userId: 'u1' } as any);
    await service.listPaymentIntents('order-1', { userId: 'u1' } as any);
    await service.getPaymentIntentByCode('PI1', { userId: 'u1' } as any);
    await service.createPaymentIntent('order-1', intentDto as any, { userId: 'u1' } as any);

    expect(createService.createOrder).toHaveBeenCalledWith(createDto, 'staff-1');
    expect(updateService.updateOrder).toHaveBeenCalledWith('order-1', updateDto, 'staff-1', { userId: 'u1' });
    expect(payments.payOrder).toHaveBeenCalledWith('order-1', payDto, 'staff-1', { userId: 'u1' });
    expect(paymentIntents.listPaymentIntents).toHaveBeenCalledWith('order-1', { userId: 'u1' });
    expect(paymentIntents.getPaymentIntentByCode).toHaveBeenCalledWith('PI1', { userId: 'u1' });
    expect(paymentIntents.createPaymentIntent).toHaveBeenCalledWith('order-1', intentDto, { userId: 'u1' });
  });

  it('delegates lifecycle, return, deletion, swap, and timeline methods', async () => {
    const user = { userId: 'u1', role: 'MANAGER' } as any;

    await service.completeOrder('order-1', { forceComplete: true } as any, 'staff-1', user);
    await service.cancelOrder('order-1', { reason: 'Khach doi y' } as any, 'staff-1', user);
    await service.refundOrder('order-1', { status: 'PARTIALLY_REFUNDED', reason: 'Loi SP' } as any, 'staff-1', user);
    await service.removeOrderItem('order-1', 'item-1', user);
    await service.createReturnRequest('order-1', { type: 'PARTIAL', items: [] } as any, 'staff-1', user);
    await service.deleteOrderCascade('order-1', 'staff-1', user);
    await service.bulkDeleteOrders(['order-1'], 'staff-1', user);
    await service.approveOrder('order-1', { note: 'OK' }, 'staff-1', user);
    await service.exportStock('order-1', { note: 'Xuat' }, 'staff-1', user);
    await service.settleOrder('order-1', { note: 'Done' }, 'staff-1', user);
    await service.swapTempItem('order-1', 'item-1', { realProductId: 'p1', realProductVariantId: 'v1' }, 'staff-1', user);
    await service.swapGroomingService('order-1', 'item-2', { targetPricingRuleId: 'rule-2' } as any, 'staff-1', user);
    await service.getOrderTimeline('order-1', user);
    await service.getTimeline('order-1');

    expect(lifecycle.completeOrder).toHaveBeenCalledWith('order-1', { forceComplete: true }, 'staff-1', user);
    expect(lifecycle.cancelOrder).toHaveBeenCalledWith('order-1', { reason: 'Khach doi y' }, 'staff-1', user);
    expect(returns.refundOrder).toHaveBeenCalled();
    expect(returns.removeOrderItem).toHaveBeenCalledWith('order-1', 'item-1', user);
    expect(returns.createReturnRequest).toHaveBeenCalled();
    expect(deletions.deleteOrderCascade).toHaveBeenCalledWith('order-1', 'staff-1', user);
    expect(deletions.bulkDeleteOrders).toHaveBeenCalledWith(['order-1'], 'staff-1', user);
    expect(lifecycle.approveOrder).toHaveBeenCalledWith('order-1', { note: 'OK' }, 'staff-1', user);
    expect(lifecycle.exportStock).toHaveBeenCalledWith('order-1', { note: 'Xuat' }, 'staff-1', user);
    expect(lifecycle.settleOrder).toHaveBeenCalledWith('order-1', { note: 'Done' }, 'staff-1', user);
    expect(swaps.swapTempItem).toHaveBeenCalledWith('order-1', 'item-1', { realProductId: 'p1', realProductVariantId: 'v1' }, 'staff-1', user);
    expect(swaps.swapGroomingService).toHaveBeenCalled();
    expect(timeline.getOrderTimeline).toHaveBeenCalledWith('order-1', user);
    expect(timeline.getTimeline).toHaveBeenCalledWith('order-1');
  });

  it('keeps webhook confirmation on the payment intent service', async () => {
    const payload = { paymentIntentId: 'intent-1', bankTransactionId: 'bank-1' };
    await service.confirmPaymentIntentPaidFromWebhook(payload as any);
    expect(paymentIntents.confirmPaymentIntentPaidFromWebhook).toHaveBeenCalledWith(payload);
  });
});
