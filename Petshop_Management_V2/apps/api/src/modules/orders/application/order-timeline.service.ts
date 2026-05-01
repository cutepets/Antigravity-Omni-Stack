import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import {
  createOrderTimelineEntry,
  createStockExportTimelineEntry as createStockExportTimelineEntryRecord,
} from './order-timeline.application.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderTimelineService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly accessService: OrderAccessService,
  ) {}

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    this.accessService.assertOrderScope(order, user);
  }

  async createTimelineEntry(
    params: {
      orderId: string;
      action: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      note?: string | null;
      performedBy: string;
      metadata?: Record<string, any>;
    },
    db?: Pick<DatabaseService, 'orderTimeline'>,
  ) {
    const target = (db ?? this.prisma) as Pick<DatabaseService, 'orderTimeline'>;
    return createOrderTimelineEntry(target.orderTimeline as any, {
      orderId: params.orderId,
      action: params.action,
      fromStatus: params.fromStatus ?? undefined,
      toStatus: params.toStatus ?? undefined,
      note: params.note ?? undefined,
      performedBy: params.performedBy,
      metadata: params.metadata,
    });
  }

  async createStockExportTimelineEntry(
    params: Parameters<typeof createStockExportTimelineEntryRecord>[1],
    db?: Pick<DatabaseService, 'orderTimeline'>,
  ) {
    const target = (db ?? this.prisma) as Pick<DatabaseService, 'orderTimeline'>;
    return createStockExportTimelineEntryRecord(target.orderTimeline as any, params);
  }

  async getOrderTimeline(orderId: string, user: AccessUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, branchId: true, staffId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.assertOrderScope(order, user);

    const timelines = await this.prisma.orderTimeline.findMany({
      where: { orderId },
      include: {
        performedByUser: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return timelines.map((timeline: any) => ({
      ...timeline,
      performedByUser: timeline.performedByUser,
    }));
  }

  async getTimeline(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      select: { id: true },
    });
    if (!order) return [];
    return this.prisma.orderTimeline.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
      include: {
        performedByUser: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
    });
  }
}
