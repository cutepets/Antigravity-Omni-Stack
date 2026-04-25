import { Injectable } from '@nestjs/common';
import {
  generateGroomingSessionCode as formatGroomingSessionCode,
  generateHotelStayCode as formatHotelStayCode,
  generateOrderNumber as formatOrderNumber,
} from '@petshop/shared';
import { generateFinanceVoucherNumber } from '../../../common/utils/finance-voucher.util.js';
import { DatabaseService } from '../../../database/database.service.js';

@Injectable()
export class OrderNumberingService {
  async generateOrderNumber(prisma: Pick<DatabaseService, 'order'>): Promise<string> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const count = await prisma.order.count({
      where: { createdAt: { gte: startOfDay } },
    });
    return formatOrderNumber(today, count + 1);
  }

  async generateVoucherNumber(prisma: Pick<DatabaseService, 'transaction'>): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const count = await prisma.transaction.count({
      where: { createdAt: { gte: startOfDay } },
    });
    return `VCH-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async generateHotelStayCode(
    db: Pick<DatabaseService, 'hotelStay'>,
    createdAt: Date,
    branchCode: string,
  ): Promise<string> {
    const startOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1);
    const endOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 1);
    const codePrefix = formatHotelStayCode(createdAt, branchCode, 0).slice(0, -3);
    const count = await db.hotelStay.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
        stayCode: {
          startsWith: codePrefix,
        } as any,
      },
    });
    return formatHotelStayCode(createdAt, branchCode, count + 1);
  }

  async generateGroomingSessionCode(
    db: Pick<DatabaseService, 'groomingSession'>,
    createdAt: Date,
    branchCode: string,
  ): Promise<string> {
    const startOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1);
    const endOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 1);
    const codePrefix = formatGroomingSessionCode(createdAt, branchCode, 0).slice(0, -3);
    const count = await db.groomingSession.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
        sessionCode: {
          startsWith: codePrefix,
        } as any,
      },
    });
    return formatGroomingSessionCode(createdAt, branchCode, count + 1);
  }

  async generateFinanceVoucherNumber(
    db: DatabaseService,
    type: 'INCOME' | 'EXPENSE',
  ): Promise<string> {
    return generateFinanceVoucherNumber(db as any, type);
  }
}
