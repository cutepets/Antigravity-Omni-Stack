import { createStockExportTimelineEntry } from './order-timeline.application.js';

type OrderServiceAutoExportDb = {
  order: {
    findUnique(args: Record<string, unknown>): Promise<any>;
    update(args: Record<string, unknown>): Promise<any>;
  };
  orderTimeline: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

const GROOMING_READY_STATUSES = ['COMPLETED', 'RETURNED', 'CANCELLED'];
const HOTEL_READY_STATUSES = ['CHECKED_OUT', 'CANCELLED'];
const AUTO_EXPORTABLE_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING'];

function isServiceItemReady(item: any) {
  if (item.groomingSession?.status) {
    return GROOMING_READY_STATUSES.includes(item.groomingSession.status);
  }

  if (item.hotelStay?.status) {
    return HOTEL_READY_STATUSES.includes(item.hotelStay.status);
  }

  return true;
}

export async function autoExportPaidServiceOnlyOrder(
  db: OrderServiceAutoExportDb,
  params: {
    orderId?: string | null;
    staffId?: string | null;
    source: string;
    occurredAt?: Date;
  },
) {
  if (!params.orderId || !params.staffId) return false;

  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: {
      items: {
        include: {
          groomingSession: { select: { status: true } },
          hotelStay: { select: { status: true } },
        },
      },
    },
  });

  if (!order) return false;
  if (!AUTO_EXPORTABLE_ORDER_STATUSES.includes(order.status)) return false;
  if (order.stockExportedAt) return false;
  if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'COMPLETED') return false;

  const items = order.items ?? [];
  const hasServiceItems = items.some((item: any) =>
    item.type === 'service'
    || item.type === 'grooming'
    || item.type === 'hotel'
    || Boolean(item.groomingSessionId)
    || Boolean(item.hotelStayId)
    || Boolean(item.groomingSession)
    || Boolean(item.hotelStay),
  );
  const hasPhysicalProductItems = items.some((item: any) =>
    item.type === 'product'
    && Boolean(item.productId)
    && item.isTemp !== true,
  );

  if (!hasServiceItems || hasPhysicalProductItems) return false;
  if (!items.every(isServiceItemReady)) return false;

  const now = params.occurredAt ?? new Date();
  await db.order.update({
    where: { id: order.id },
    data: {
      status: 'COMPLETED',
      completedAt: now,
      stockExportedAt: now,
      stockExportedBy: params.staffId,
    },
  });
  await createStockExportTimelineEntry(db.orderTimeline, {
    orderId: order.id,
    fromStatus: order.status,
    toStatus: 'COMPLETED',
    performedBy: params.staffId,
    occurredAt: now,
    exportedItemCount: 0,
    pendingTempCount: items.filter((item: any) => item.type === 'product' && item.isTemp === true).length,
    metadata: { source: params.source, hasServiceItems: true },
  });

  return true;
}
