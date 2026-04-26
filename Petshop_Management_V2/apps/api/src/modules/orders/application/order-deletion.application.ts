import { BadRequestException } from '@nestjs/common';

export async function collectOrderDeleteGraph(
  tx: Pick<any, 'order' | 'orderReturnRequest'>,
  seedOrderIds: string[],
): Promise<{ orderIds: string[]; returnRequestIds: string[] }> {
  const orderIds = new Set(seedOrderIds.filter(Boolean));
  const returnRequestIds = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    const currentOrderIds = [...orderIds];
    const currentReturnRequestIds = [...returnRequestIds];

    const orders = currentOrderIds.length > 0
      ? await (tx as any).order.findMany({
          where: { id: { in: currentOrderIds } },
          select: { id: true, linkedReturnId: true },
        })
      : [];

    for (const order of orders) {
      if (order.linkedReturnId && !returnRequestIds.has(order.linkedReturnId)) {
        returnRequestIds.add(order.linkedReturnId);
        changed = true;
      }
    }

    const returnWhere: any[] = [];
    if (currentOrderIds.length > 0) returnWhere.push({ orderId: { in: currentOrderIds } });
    if (currentReturnRequestIds.length > 0) returnWhere.push({ id: { in: currentReturnRequestIds } });

    const returnRequests = returnWhere.length > 0
      ? await (tx as any).orderReturnRequest.findMany({
          where: { OR: returnWhere },
          select: { id: true, orderId: true },
        })
      : [];

    for (const request of returnRequests) {
      if (!returnRequestIds.has(request.id)) {
        returnRequestIds.add(request.id);
        changed = true;
      }
      if (request.orderId && !orderIds.has(request.orderId)) {
        orderIds.add(request.orderId);
        changed = true;
      }
    }

    const nextReturnRequestIds = [...returnRequestIds];
    const exchangeOrders = nextReturnRequestIds.length > 0
      ? await (tx as any).order.findMany({
          where: { linkedReturnId: { in: nextReturnRequestIds } },
          select: { id: true },
        })
      : [];

    for (const order of exchangeOrders) {
      if (!orderIds.has(order.id)) {
        orderIds.add(order.id);
        changed = true;
      }
    }
  }

  return { orderIds: [...orderIds], returnRequestIds: [...returnRequestIds] };
}

export async function reverseOrderStockTransactions(tx: any, orderIds: string[]) {
  const stockTransactions = await (tx as any).stockTransaction.findMany({
    where: {
      referenceType: 'ORDER',
      referenceId: { in: orderIds },
    },
    select: {
      id: true,
      productId: true,
      productVariantId: true,
      sourceProductVariantId: true,
      branchId: true,
      type: true,
      quantity: true,
      sourceQuantity: true,
      actionQuantity: true,
    },
  });

  for (const movement of stockTransactions) {
    const type = String(movement.type ?? '').toUpperCase();
    if (type !== 'IN' && type !== 'OUT') continue;

    const quantity = Math.abs(Number(movement.sourceQuantity ?? movement.quantity ?? movement.actionQuantity ?? 0));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (!movement.branchId) {
      throw new BadRequestException('Khong the dao ton kho cua giao dich thieu chi nhanh');
    }

    const productVariantId = movement.sourceProductVariantId ?? movement.productVariantId ?? null;
    let branchStock = await (tx as any).branchStock.findFirst({
      where: {
        branchId: movement.branchId,
        productId: movement.productId,
        productVariantId,
      },
    });

    if (!branchStock && productVariantId !== null) {
      branchStock = await (tx as any).branchStock.findFirst({
        where: {
          branchId: movement.branchId,
          productId: movement.productId,
          productVariantId: null,
        },
      });
    }

    if (!branchStock && productVariantId === null) {
      branchStock = await (tx as any).branchStock.findFirst({
        where: {
          branchId: movement.branchId,
          productId: movement.productId,
        },
      });
    }

    if (type === 'OUT') {
      if (branchStock) {
        await (tx as any).branchStock.update({
          where: { id: branchStock.id },
          data: { stock: { increment: quantity } },
        });
      } else {
        await (tx as any).branchStock.create({
          data: {
            branchId: movement.branchId,
            productId: movement.productId,
            productVariantId,
            stock: quantity,
            reservedStock: 0,
            minStock: 5,
          } as any,
        });
      }
    } else {
      if (!branchStock || Number(branchStock.stock ?? 0) < quantity) {
        throw new BadRequestException('Ton kho khong du de dao giao dich nhap kho cua don hang');
      }
      await (tx as any).branchStock.update({
        where: { id: branchStock.id },
        data: { stock: { decrement: quantity } },
      });
    }
  }

  if (stockTransactions.length > 0) {
    await (tx as any).stockTransaction.deleteMany({
      where: { id: { in: stockTransactions.map((movement: any) => movement.id) } },
    });
  }
}

export async function rollbackOrderCustomerAndSales(
  tx: any,
  params: {
    orders: any[];
    paymentsByOrderId: Map<string, any[]>;
    transactionsByOrderId: Map<string, any[]>;
    loyaltyPointValue: number;
  },
  dependencies: {
    applyCompletedProductSalesDelta: (tx: any, params: {
      completedAt: Date;
      branchId?: string | null;
      multiplier: 1 | -1;
      items: Array<{
        productId?: string | null;
        productVariantId?: string | null;
        quantity: number;
        subtotal: number;
      }>;
    }) => Promise<void>;
  },
) {
  for (const order of params.orders) {
    if (!order.customerId) continue;

    const isCompletedOrder = Boolean(order.completedAt) || ['COMPLETED', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED'].includes(String(order.status ?? ''));
    const pointsEarned = isCompletedOrder ? Math.floor(Number(order.total ?? 0) / 1000) : 0;
    const pointPaymentTotal = (params.paymentsByOrderId.get(order.id) ?? [])
      .filter((payment) => String(payment.method ?? '').toUpperCase() === 'POINTS')
      .reduce((sum, payment) => sum + Math.max(0, Number(payment.amount ?? 0)), 0);
    const pointsToRestore = pointPaymentTotal > 0 ? Math.ceil(pointPaymentTotal / params.loyaltyPointValue) : 0;
    const pointDelta = pointsToRestore - pointsEarned;

    const transactions = params.transactionsByOrderId.get(order.id) ?? [];
    const refundedOverpayment = transactions
      .filter((transaction) => (
        String(transaction.type ?? '').toUpperCase() === 'EXPENSE' &&
        String(transaction.source ?? '') === 'ORDER_ADJUSTMENT'
      ))
      .reduce((sum, transaction) => sum + Math.max(0, Number(transaction.amount ?? 0)), 0);
    const creditRollback = Math.max(0, Number(order.paidAmount ?? 0) - Number(order.total ?? 0) - refundedOverpayment);

    const data: Record<string, unknown> = {};
    if (isCompletedOrder) {
      data.totalSpent = { decrement: Number(order.total ?? 0) };
      data.totalOrders = { decrement: 1 };
    }
    if (pointDelta > 0) data.points = { increment: pointDelta };
    if (pointDelta < 0) data.points = { decrement: Math.abs(pointDelta) };
    if (pointsToRestore > 0) data.pointsUsed = { decrement: pointsToRestore };
    if (creditRollback > 0) data.debt = { increment: creditRollback };

    if (Object.keys(data).length > 0) {
      await (tx as any).customer.update({
        where: { id: order.customerId },
        data,
      });
    }

    if (isCompletedOrder) {
      await dependencies.applyCompletedProductSalesDelta(tx, {
        completedAt: order.completedAt ?? order.createdAt ?? new Date(),
        branchId: order.branchId ?? null,
        multiplier: -1,
        items: (order.items ?? []).map((item: any) => ({
          productId: item.productId ?? null,
          productVariantId: item.productVariantId ?? null,
          quantity: Number(item.quantity ?? 0),
          subtotal: Number(item.subtotal ?? 0),
        })),
      });
    }
  }
}
