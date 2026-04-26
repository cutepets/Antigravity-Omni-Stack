export async function loadOrderServiceReadiness(prisma: any, items: any[]) {
  const groomingSessions = (
    await Promise.all(
      items
        .filter((item) => item.groomingSessionId)
        .map((item) =>
          prisma.groomingSession.findUnique({
            where: { id: item.groomingSessionId! },
            select: { id: true, status: true, sessionCode: true },
          }),
        ),
    )
  ).filter(Boolean) as Array<{ id: string; status: string; sessionCode?: string | null }>;

  const hotelStays = (
    await Promise.all(
      items
        .filter((item) => item.hotelStayId)
        .map((item) =>
          prisma.hotelStay.findUnique({
            where: { id: item.hotelStayId! },
            select: { id: true, status: true },
          }),
        ),
    )
  ).filter(Boolean) as Array<{ id: string; status: string }>;

  return { groomingSessions, hotelStays };
}

export async function exportCompletedOrderItems(
  tx: any,
  params: {
    items: any[];
    branchId?: string | null;
    orderId: string;
    orderNumber: string;
    staffId: string;
    exportedAt: Date;
  },
  dependencies: {
    deductProductBranchStock: (tx: any, params: {
      branchId?: string | null;
      productId: string;
      productVariantId?: string | null;
      quantity: number;
      orderId: string;
      staffId: string;
      reason: string;
    }) => Promise<void>;
  },
) {
  const exportedProductItems: any[] = [];

  for (const item of params.items) {
    if (!item.productId) continue;
    await dependencies.deductProductBranchStock(tx, {
      branchId: params.branchId ?? null,
      productId: item.productId,
      productVariantId: item.productVariantId ?? null,
      quantity: item.quantity,
      orderId: params.orderId,
      staffId: params.staffId,
      reason: `Hoan thanh don ${params.orderNumber}`,
    });
    await tx.orderItem.update({
      where: { id: item.id },
      data: {
        stockExportedAt: params.exportedAt,
        stockExportedBy: params.staffId,
      } as any,
    });
    exportedProductItems.push(item);
  }

  return exportedProductItems;
}

export async function cancelLinkedOrderServices(tx: any, items: any[]) {
  for (const item of items) {
    if (item.groomingSessionId) {
      await tx.groomingSession.update({
        where: { id: item.groomingSessionId },
        data: { status: 'CANCELLED' },
      });
    }
    if (item.hotelStayId) {
      const stay = await tx.hotelStay.findUnique({ where: { id: item.hotelStayId } });
      if (stay && !['CHECKED_OUT', 'CANCELLED'].includes(stay.status)) {
        await tx.hotelStay.update({
          where: { id: item.hotelStayId },
          data: { status: 'CANCELLED' },
        });
      }
    }
  }
}
