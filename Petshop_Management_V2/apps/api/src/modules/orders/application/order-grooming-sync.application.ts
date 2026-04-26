import type { OrderItemService } from '../domain/order-item.service.js';

type RefreshGroomingSessionItem = {
  id: string;
  description?: string | null;
  unitPrice?: number | null;
  quantity?: number | null;
  discountItem?: number | null;
  serviceId?: string | null;
  sku?: string | null;
  pricingSnapshot?: unknown;
};

type GroomingOrderItemSnapshotReader = Pick<
  OrderItemService,
  'getGroomingOrderItemRole' | 'getGroomingOrderItemSnapshot'
>;

export function buildGroomingSessionRefreshData(
  items: RefreshGroomingSessionItem[],
  orderItemService: GroomingOrderItemSnapshotReader,
) {
  const mainItem = items.find((item) => orderItemService.getGroomingOrderItemRole(item) !== 'EXTRA') ?? null;
  const sourceItem = mainItem ?? items[0];
  const sourceSnapshot = orderItemService.getGroomingOrderItemSnapshot(sourceItem);
  const grossAmount = items.reduce((sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0), 0);
  const discountAmount = items.reduce((sum, item) => sum + Number(item.discountItem ?? 0), 0);
  const extraServices = items
    .filter((item) => orderItemService.getGroomingOrderItemRole(item) === 'EXTRA')
    .map((item) => {
      const snapshot = orderItemService.getGroomingOrderItemSnapshot(item);
      const quantity = Number(item.quantity ?? 1);
      const price = Number(item.unitPrice ?? snapshot.price ?? 0);
      return {
        orderItemId: item.id,
        pricingRuleId: snapshot.pricingRuleId ?? snapshot.pricingSnapshot?.pricingRuleId ?? null,
        sku: item.sku ?? snapshot.sku ?? snapshot.pricingSnapshot?.sku ?? null,
        name: item.description ?? snapshot.serviceName ?? null,
        price,
        quantity,
        durationMinutes: snapshot.durationMinutes ?? snapshot.pricingSnapshot?.durationMinutes ?? null,
        discountItem: Number(item.discountItem ?? 0),
        total: price * quantity - Number(item.discountItem ?? 0),
      };
    });

  return {
    serviceId: mainItem?.serviceId ?? null,
    price: grossAmount,
    packageCode: mainItem ? sourceSnapshot.packageCode ?? null : null,
    weightAtBooking: mainItem ? sourceSnapshot.weightAtBooking ?? null : null,
    weightBandId: mainItem ? sourceSnapshot.weightBandId ?? null : null,
    pricingSnapshot: {
      ...sourceSnapshot,
      source: 'POS_GROOMING_GROUP',
      mainOrderItemId: mainItem?.id ?? null,
      mainService: mainItem
        ? {
            orderItemId: mainItem.id,
            name: mainItem.description,
            price: Number(mainItem.unitPrice ?? 0),
            quantity: Number(mainItem.quantity ?? 1),
            discountItem: Number(mainItem.discountItem ?? 0),
            serviceId: mainItem.serviceId ?? null,
          }
        : null,
      extraServices,
      grossAmount,
      discountAmount,
      totalAmount: Math.max(0, grossAmount - discountAmount),
      orderItemIds: items.map((item) => item.id),
    } as any,
  };
}
