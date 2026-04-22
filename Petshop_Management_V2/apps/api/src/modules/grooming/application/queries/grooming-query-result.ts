export const groomingOrderInclude = {
  select: {
    id: true,
    orderNumber: true,
    status: true,
    paymentStatus: true,
    total: true,
    paidAmount: true,
    remainingAmount: true,
  },
} as const;

export const groomingOrderItemsInclude = {
  select: {
    id: true,
    description: true,
    unitPrice: true,
    quantity: true,
    discountItem: true,
    type: true,
    serviceId: true,
    sku: true,
    petId: true,
    pricingSnapshot: true,
  },
} as const;

function normalizeExtraServicesSnapshot(pricingSnapshot: unknown) {
  const snapshot = ((pricingSnapshot as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  return Array.isArray(snapshot.extraServices) ? snapshot.extraServices : [];
}

export function mapGroomingSessionResult<T extends { pricingSnapshot?: unknown }>(session: T) {
  return {
    ...session,
    extraServices: normalizeExtraServicesSnapshot(session.pricingSnapshot),
  };
}
