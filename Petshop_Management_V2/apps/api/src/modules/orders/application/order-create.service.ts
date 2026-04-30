import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { OrderItemService } from '../domain/order-item.service.js';
import { OrderNumberingService } from '../domain/order-numbering.service.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { applyCreateOrderPostActions } from './order-create.application.js';
import { OrderInventoryService } from './order-inventory.service.js';
import { OrderPaymentService } from './order-payment.service.js';
import { OrderServiceSyncService } from './order-service-sync.service.js';
import { buildCreateOrderDraft } from './order-workflow.application.js';
import { createOrderFinanceTransaction } from './order-finance.application.js';
import { PromotionApplicationService } from '../../promotions/promotion-application.service.js';

@Injectable()
export class OrderCreateService {
  private static readonly ORDER_NUMBER_RETRY_LIMIT = 3;

  constructor(
    private readonly prisma: DatabaseService,
    private readonly orderItemService: OrderItemService,
    private readonly numberingService: OrderNumberingService,
    private readonly paymentService: OrderPaymentService,
    private readonly inventoryService: OrderInventoryService,
    private readonly syncService: OrderServiceSyncService,
    private readonly promotionApplication?: PromotionApplicationService,
  ) {}

  private async generateOrderNumberFor(prisma: Pick<DatabaseService, 'order'>): Promise<string> {
    return this.numberingService.generateOrderNumber(prisma);
  }

  private isOrderNumberUniqueError(error: unknown): boolean {
    const prismaError = error as {
      code?: string;
      meta?: { target?: string[] | string };
    };
    const target = prismaError?.meta?.target;
    const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
    return prismaError?.code === 'P2002' && fields.includes('orderNumber');
  }

  async createOrder(data: CreateOrderDto, staffId: string): Promise<any> {
    const { items, payments = [], discount = 0, shippingFee = 0 } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Don hang phai co it nhat 1 san pham');
    }

    const normalizedPayments = await this.paymentService.normalizePayments(this.prisma as any, payments);
    const promotionDraft = this.promotionApplication
      ? await this.promotionApplication.applyToOrderDraft({
      branchId: data.branchId ?? null,
      customerId: data.customerId ?? null,
      items: items as any,
      manualDiscount: data.manualDiscount ?? discount,
      voucherCode: data.voucherCode ?? null,
    })
      : {
        result: { enabled: false, previewToken: '', promotionDiscount: 0 } as any,
        discount,
        promotionDiscount: 0,
        manualDiscount: discount,
        items,
      };
    const orderItems = promotionDraft.items as CreateOrderDto['items'];

    const { orderType, orderStatus, paymentStatus, subtotal, total, totalPaid, remainingAmount } = buildCreateOrderDraft({
      items: orderItems,
      payments: normalizedPayments,
      discount: promotionDraft.discount,
      shippingFee,
    });

    for (let attempt = 1; attempt <= OrderCreateService.ORDER_NUMBER_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const normalizedItems = await this.orderItemService.validateAndNormalizeCreateItems(tx as any, orderItems);
          const orderNumber = await this.generateOrderNumberFor(tx as any);

          const order = await tx.order.create({
            data: {
              orderNumber,
              customerName: data.customerName,
              customerId: data.customerId ?? null,
              staffId,
              branchId: data.branchId ?? null,
              status: orderStatus as any,
              paymentStatus: paymentStatus as any,
              completedAt: orderStatus === 'COMPLETED' ? new Date() : null,
              stockExportedAt: orderStatus === 'COMPLETED' ? new Date() : null,
              stockExportedBy: orderStatus === 'COMPLETED' ? staffId : null,
              subtotal,
              discount: promotionDraft.discount,
              manualDiscount: promotionDraft.manualDiscount,
              promotionDiscount: promotionDraft.promotionDiscount,
              promotionSnapshot: promotionDraft.result as any,
              promotionPreviewToken: promotionDraft.result.previewToken,
              shippingFee,
              total,
              paidAmount: totalPaid,
              remainingAmount,
              notes: data.notes ?? null,
              items: {
                create: normalizedItems.map((item) => this.orderItemService.buildOrderItemData(item)),
              },
              payments: {
                create: normalizedPayments.map((payment) => ({
                  method: payment.method,
                  amount: payment.amount,
                  note: payment.note ?? null,
                  paymentAccountId: payment.paymentAccountId ?? null,
                  paymentAccountLabel: payment.paymentAccountLabel ?? null,
                })),
              },
            } as any,
            include: {
              items: true,
              payments: true,
              customer: true,
            },
          });

          await applyCreateOrderPostActions(
            {
              order: {
                id: order.id,
                orderNumber: order.orderNumber,
                createdAt: order.createdAt,
                completedAt: order.completedAt,
                branchId: order.branchId ?? null,
                items: (order as any).items.map((item: any) => ({
                  id: item.id,
                  productId: item.productId ?? null,
                  productVariantId: item.productVariantId ?? null,
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                })),
              },
              normalizedItems,
              orderType,
              orderStatus,
              paymentStatus,
              normalizedPayments,
              customerId: data.customerId ?? null,
              branchId: data.branchId ?? null,
              total,
              notes: data.notes ?? null,
              staffId,
            },
            {
              handleQuickProductItem: async ({ item, orderItem, order, branchId, orderStatus, staffId }) => {
                const product = await tx.product.findUnique({
                  where: { id: item.productId },
                });
                if (!product) throw new BadRequestException(`San pham ${item.productId} khong ton tai`);

                if (orderStatus === 'COMPLETED') {
                  await this.inventoryService.deductProductBranchStock(tx as any, {
                    branchId,
                    productId: item.productId,
                    productVariantId: item.productVariantId ?? null,
                    quantity: item.quantity,
                    orderId: order.id,
                    staffId,
                    reason: `Ban hang don ${order.orderNumber}`,
                  });

                  await tx.orderItem.update({
                    where: { id: orderItem.id },
                    data: {
                      stockExportedAt: order.completedAt ?? new Date(),
                      stockExportedBy: staffId,
                    } as any,
                  });
                }
              },
              syncGroomingSession: ({ item, orderItem, order, customerId, branchId, staffId }) =>
                this.syncService.syncGroomingSession(tx as any, {
                  orderId: order.id,
                  orderItemId: orderItem.id,
                  customerId,
                  branchId,
                  serviceId: item.serviceId ?? null,
                  orderCreatedAt: order.createdAt,
                  staffId,
                  item,
                }),
              syncHotelStay: ({ item, orderItem, order, customerId, branchId }) =>
                this.syncService.syncHotelStay(tx as any, {
                  orderId: order.id,
                  orderItemId: orderItem.id,
                  customerId,
                  branchId,
                  orderCreatedAt: order.createdAt,
                  item,
                }),
              syncGroupedHotelStay: ({ entries, order, customerId, branchId }) =>
                this.syncService.syncGroupedHotelStay(tx as any, {
                  entries,
                  order,
                  customerId,
                  branchId,
                }),
              recordInitialPayments: async ({ order, normalizedPayments, notes, staffId, serviceTraceParts }) => {
                const pointPaymentTotal = normalizedPayments.filter((payment) => payment.method === 'POINTS').reduce((sum, payment) => sum + payment.amount, 0);
                if (pointPaymentTotal > 0) {
                  if (!data.customerId) {
                    throw new BadRequestException('Phai thiet lap khach hang de thanh toan bang diem');
                  }
                  const customer = await (tx as any).customer.findUnique({
                    where: { id: data.customerId },
                  });
                  const sysConfig = await (tx as any).systemConfig.findFirst({
                    select: { loyaltyPointValue: true },
                  });
                  const pointRedemptionRate = Number(sysConfig?.loyaltyPointValue ?? 1) || 1;
                  const pointsToDeduct = Math.ceil(pointPaymentTotal / pointRedemptionRate);
                  if (!customer || customer.points < pointsToDeduct) {
                    throw new BadRequestException('Khach hang khong du diem de thanh toan');
                  }
                  await (tx as any).customer.update({
                    where: { id: customer.id },
                    data: {
                      points: { decrement: pointsToDeduct },
                      pointsUsed: { increment: pointsToDeduct },
                    },
                  });
                }

                for (const payment of normalizedPayments) {
                  if (payment.amount <= 0) continue;

                  if (payment.method !== 'POINTS') {
                    const label = this.paymentService.getPaymentLabel(payment.method);
                    await createOrderFinanceTransaction(
                      tx as any,
                      {
                        getPaymentLabel: (method) => this.paymentService.getPaymentLabel(method),
                        buildServiceTraceTags: (parts) => this.paymentService.buildServiceTraceTags(parts),
                        mergeTransactionNotes: (note, parts) => this.paymentService.mergeTransactionNotes(note, parts),
                        generateVoucherNumber: () => this.paymentService.generateVoucherNumberFor(tx as any, 'INCOME'),
                      },
                      {
                        order: {
                          id: order.id,
                          orderNumber: order.orderNumber,
                          branchId: data.branchId ?? null,
                          customerId: data.customerId ?? null,
                          customerName: data.customerName,
                        },
                        type: 'INCOME',
                        amount: payment.amount,
                        paymentMethod: payment.method,
                        paymentAccountId: payment.paymentAccountId ?? null,
                        paymentAccountLabel: payment.paymentAccountLabel ?? null,
                        description: `Thu tu don hang ${order.orderNumber} - ${label}`,
                        note: payment.note ?? notes ?? null,
                        source: 'ORDER_PAYMENT',
                        staffId,
                        traceParts: serviceTraceParts,
                      },
                    );
                  }

                  if (payment.method === 'POINTS') {
                    await (tx as any).orderPayment.create({
                      data: {
                        orderId: order.id,
                        method: payment.method,
                        amount: payment.amount,
                        note: payment.note ?? notes ?? null,
                        paymentAccountId: payment.paymentAccountId ?? null,
                        paymentAccountLabel: payment.paymentAccountLabel ?? null,
                      },
                    });
                  }
                }
              },
              incrementCustomerStats: (customerId, total) => this.paymentService.incrementCustomerStats(tx as any, customerId, total),
              applyCompletedProductSalesDelta: ({ order }) =>
                this.inventoryService.applyCompletedProductSalesDelta(tx as any, {
                  completedAt: order.completedAt ?? order.createdAt,
                  branchId: order.branchId ?? null,
                  items: order.items.map((item) => ({
                    productId: item.productId ?? null,
                    productVariantId: item.productVariantId ?? null,
                    quantity: item.quantity,
                    subtotal: item.subtotal,
                  })),
                }),
              createQuickStockExportTimeline: async ({ order, physicalItemCount, staffId }) => {
                await tx.orderTimeline.create({
                  data: {
                    orderId: order.id,
                    action: 'STOCK_EXPORTED',
                    fromStatus: null,
                    toStatus: 'COMPLETED',
                    note: `Xuat kho ${physicalItemCount} san pham`,
                    performedBy: staffId,
                    metadata: { source: 'POS_CREATE' },
                    createdAt: order.completedAt ?? new Date(),
                  } as any,
                });
              },
            },
          );

          await this.promotionApplication?.recordRedemptions(tx as any, {
            order: {
              id: order.id,
              orderNumber: order.orderNumber,
              customerId: order.customerId ?? null,
              branchId: order.branchId ?? null,
            },
            staffId,
            preview: promotionDraft.result,
          });

          return order;
        });
      } catch (error) {
        if (!this.isOrderNumberUniqueError(error) || attempt === OrderCreateService.ORDER_NUMBER_RETRY_LIMIT) {
          throw error;
        }
      }
    }

    throw new BadRequestException('Khong the tao ma don hang moi');
  }
}
