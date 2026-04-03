import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@Injectable()
export class OrdersService {
  constructor(private prisma: DatabaseService) {}

  async getProducts() {
    return this.prisma.product.findMany({ where: { isActive: true } });
  }

  async getServices() {
    return this.prisma.service.findMany({ where: { isActive: true } });
  }

  async createOrder(data: CreateOrderDto, staffId: string) {
    const { items, payments = [], discount = 0, shippingFee = 0 } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    let subtotal = 0;
    
    // Check inventory stock and calculate subtotal
    for (const item of items) {
      const itemSubtotal = (item.unitPrice * item.quantity) - (item.discountItem || 0);
      subtotal += itemSubtotal;
    }

    const total = subtotal - discount + shippingFee;
    
    let paidAmount = 0;
    for (const p of payments) {
      paidAmount += p.amount;
    }

    const remainingAmount = total - paidAmount;
    
    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'COMPLETED' = 'UNPAID';
    if (paidAmount > 0) {
      paymentStatus = paidAmount >= total ? 'PAID' : 'PARTIAL';
    }

    const orderNumber = `ORD${Date.now()}`;

    // Perform database transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: data.customerName,
          customerId: data.customerId ?? null,
          staffId,
          subtotal,
          discount,
          shippingFee,
          total,
          paidAmount,
          remainingAmount,
          paymentStatus,
          status: 'COMPLETED', // Auto complete for POS
          notes: data.notes ?? null,
          
          items: {
            create: items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountItem: item.discountItem ?? 0,
              subtotal: (item.unitPrice * item.quantity) - (item.discountItem ?? 0),
              type: item.type,
              productId: item.productId ?? null,
              productVariantId: item.productVariantId ?? null,
              serviceId: item.serviceId ?? null,
              hotelStayId: item.hotelStayId ?? null,
              groomingSessionId: item.groomingSessionId ?? null,
            }))
          },

          payments: {
            create: payments.map(p => ({
              method: p.method,
              amount: p.amount,
            }))
          }
        },
        include: {
          items: true,
          payments: true
        }
      });

      // 2. Reduce product stock if it's a product
      for (const item of items) {
        if (item.type === 'product' && item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) {
            throw new BadRequestException(`Product ${item.productId} not found`);
          }
          if (product.stock < item.quantity) {
            throw new BadRequestException(`Not enough stock for product ${product.name}`);
          }
          
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: product.stock - item.quantity }
          });
          
          // Also create stock transaction
          await tx.stockTransaction.create({
            data: {
              productId: item.productId,
              type: 'OUT',
              quantity: item.quantity,
              reason: `Bán lẻ xuất kho cho hóa đơn ${orderNumber}`,
              referenceId: order.id,
            }
          });
        }

        // 3. Link orderId back to Grooming/Hotel sessions
        if (item.type === 'grooming' && item.groomingSessionId) {
          await tx.groomingSession.update({
            where: { id: item.groomingSessionId },
            data: { orderId: order.id, status: 'COMPLETED' }
          });
        }

        if (item.type === 'hotel' && item.hotelStayId) {
          await tx.hotelStay.update({
            where: { id: item.hotelStayId },
            data: { orderId: order.id, status: 'CHECKED_OUT', checkOut: new Date() }
          });
        }
      }

      return order;
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        staff: true,
        items: true,
      }
    });
  }

  async findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        staff: true,
        items: true,
        payments: true,
      }
    });
  }
}
