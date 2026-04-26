import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { runBulkDelete } from '../../../common/utils/bulk-delete.util.js';
import {
  collectOrderDeleteGraph,
  reverseOrderStockTransactions,
  rollbackOrderCustomerAndSales,
} from './order-deletion.application.js';
import { OrderInventoryService } from './order-inventory.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderDeletionService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly inventoryService: OrderInventoryService,
  ) {}

  private assertCanPermanentlyDeleteOrder(user?: AccessUser) {
    if (user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Chi SUPER_ADMIN moi duoc xoa vinh vien don hang');
    }
  }

  async deleteOrderCascade(id: string, staffId: string, user?: AccessUser): Promise<{ success: true; deletedIds: string[]; deletedOrderNumbers: string[] }> {
    void staffId;
    this.assertCanPermanentlyDeleteOrder(user);

    const rootOrder = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      select: { id: true },
    });
    if (!rootOrder) throw new NotFoundException('Khong tim thay don hang');

    return this.prisma.$transaction(async (tx) => {
      const graph = await collectOrderDeleteGraph(tx as any, [rootOrder.id]);
      const orders = await (tx as any).order.findMany({
        where: { id: { in: graph.orderIds } },
        include: { items: true },
      });

      const orderIds = orders.map((order: any) => order.id);
      const orderNumbers = orders.map((order: any) => order.orderNumber).filter(Boolean);
      if (orderIds.length === 0) throw new NotFoundException('Khong tim thay don hang');

      const [payments, transactions, paymentIntents, systemConfig] = await Promise.all([
        (tx as any).orderPayment.findMany({ where: { orderId: { in: orderIds } } }),
        (tx as any).transaction.findMany({
          where: {
            OR: [
              { orderId: { in: orderIds } },
              { refType: 'ORDER', refId: { in: orderIds } },
            ],
          },
        }),
        (tx as any).paymentIntent.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true },
        }),
        (tx as any).systemConfig.findFirst({ select: { loyaltyPointValue: true } }),
      ]);

      const paymentsByOrderId = new Map<string, any[]>();
      for (const payment of payments) {
        const entries = paymentsByOrderId.get(payment.orderId) ?? [];
        entries.push(payment);
        paymentsByOrderId.set(payment.orderId, entries);
      }

      const transactionsByOrderId = new Map<string, any[]>();
      for (const transaction of transactions) {
        const transactionOrderId = transaction.orderId ?? (transaction.refType === 'ORDER' ? transaction.refId : null);
        if (!transactionOrderId) continue;
        const entries = transactionsByOrderId.get(transactionOrderId) ?? [];
        entries.push(transaction);
        transactionsByOrderId.set(transactionOrderId, entries);
      }

      await reverseOrderStockTransactions(tx as any, orderIds);
      await rollbackOrderCustomerAndSales(tx as any, {
        orders,
        paymentsByOrderId,
        transactionsByOrderId,
        loyaltyPointValue: Number(systemConfig?.loyaltyPointValue ?? 1000) || 1000,
      }, {
        applyCompletedProductSalesDelta: (transaction, payload) => this.inventoryService.applyCompletedProductSalesDelta(transaction, payload),
      });

      const paymentIntentIds = paymentIntents.map((intent: any) => intent.id);
      const webhookConditions: any[] = [{ matchedOrderId: { in: orderIds } }];
      const bankConditions: any[] = [{ matchedOrderId: { in: orderIds } }];
      if (paymentIntentIds.length > 0) {
        webhookConditions.push({ matchedPaymentIntentId: { in: paymentIntentIds } });
        bankConditions.push({ matchedPaymentIntentId: { in: paymentIntentIds } });
      }

      await (tx as any).paymentWebhookEvent.deleteMany({ where: { OR: webhookConditions } });
      await (tx as any).bankTransaction.deleteMany({ where: { OR: bankConditions } });

      if (paymentIntentIds.length > 0) {
        await (tx as any).paymentIntent.deleteMany({ where: { id: { in: paymentIntentIds } } });
      }

      await (tx as any).transaction.deleteMany({
        where: {
          OR: [
            { orderId: { in: orderIds } },
            { refType: 'ORDER', refId: { in: orderIds } },
          ],
        },
      });

      if (graph.returnRequestIds.length > 0) {
        await (tx as any).orderReturnItem.deleteMany({
          where: { returnRequestId: { in: graph.returnRequestIds } },
        });
        await (tx as any).orderReturnRequest.deleteMany({
          where: { id: { in: graph.returnRequestIds } },
        });
      }

      await (tx as any).orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await (tx as any).groomingSession.deleteMany({ where: { orderId: { in: orderIds } } });
      await (tx as any).hotelStay.deleteMany({ where: { orderId: { in: orderIds } } });
      await (tx as any).order.deleteMany({ where: { id: { in: orderIds } } });

      return {
        success: true,
        deletedIds: orderIds,
        deletedOrderNumbers: orderNumbers,
      };
    });
  }

  async bulkDeleteOrders(ids: string[], staffId: string, user?: AccessUser) {
    this.assertCanPermanentlyDeleteOrder(user);
    return runBulkDelete(ids, (orderId) => this.deleteOrderCascade(orderId, staffId, user));
  }
}
