type CreateOrderPostActionOrder = {
  id: string
  orderNumber: string
  createdAt: Date
  completedAt?: Date | null
  branchId?: string | null
  items: Array<{
    id: string
    productId?: string | null
    productVariantId?: string | null
    quantity: number
    subtotal: number
  }>
}

type CreateOrderPostActionParams = {
  order: CreateOrderPostActionOrder
  normalizedItems: any[]
  orderType: string
  orderStatus: string
  paymentStatus: string
  normalizedPayments: Array<{ method: string; amount: number; note?: string | null; paymentAccountId?: string | null; paymentAccountLabel?: string | null }>
  customerId?: string | null
  branchId?: string | null
  total: number
  notes?: string | null
  staffId: string
}

type CreateOrderPostActionDeps = {
  handleQuickProductItem: (params: { item: any; orderItem: any; order: CreateOrderPostActionOrder; branchId?: string | null; orderStatus: string; staffId: string }) => Promise<void>
  syncGroomingSession: (params: { item: any; orderItem: any; order: CreateOrderPostActionOrder; customerId?: string | null; branchId?: string | null }) => Promise<string | null>
  syncHotelStay: (params: { item: any; orderItem: any; order: CreateOrderPostActionOrder; customerId?: string | null; branchId?: string | null }) => Promise<string | null>
  syncGroupedHotelStay: (params: { entries: Array<{ item: any; orderItem: any }>; order: CreateOrderPostActionOrder; customerId?: string | null; branchId?: string | null }) => Promise<string[] | void>
  recordInitialPayments: (params: { order: CreateOrderPostActionOrder; normalizedPayments: CreateOrderPostActionParams['normalizedPayments']; notes?: string | null; staffId: string; serviceTraceParts: string[] }) => Promise<void>
  incrementCustomerStats: (customerId: string, total: number) => Promise<void>
  applyCompletedProductSalesDelta: (params: { order: CreateOrderPostActionOrder }) => Promise<void>
  createQuickStockExportTimeline: (params: { order: CreateOrderPostActionOrder; physicalItemCount: number; staffId: string }) => Promise<void>
}

function ensureHotelDetails(item: any, createdAt: Date) {
  if (item.type !== 'hotel' || item.hotelDetails || !item.petId) return item

  const checkIn = new Date(createdAt)
  const checkOut = new Date(createdAt)
  checkOut.setDate(checkOut.getDate() + (item.quantity ?? 1))

  return {
    ...item,
    hotelDetails: {
      petId: item.petId,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      checkInDate: checkIn.toISOString(),
      checkOutDate: checkOut.toISOString(),
      chargeQuantityDays: item.quantity ?? 1,
      lineType: 'REGULAR',
    },
  }
}

export async function applyCreateOrderPostActions(
  params: CreateOrderPostActionParams,
  deps: CreateOrderPostActionDeps,
) {
  const serviceTraceParts: string[] = []
  const hotelStayGroups = new Map<string, Array<{ item: any; orderItem: any }>>()

  for (let idx = 0; idx < params.normalizedItems.length; idx++) {
    const rawItem = params.normalizedItems[idx]
    const item = ensureHotelDetails(rawItem, params.order.createdAt)
    const orderItem = params.order.items[idx]
    if (!orderItem) continue

    if (item.productId && params.orderType === 'QUICK') {
      await deps.handleQuickProductItem({
        item,
        orderItem,
        order: params.order,
        branchId: params.branchId ?? null,
        orderStatus: params.orderStatus,
        staffId: params.staffId,
      })
    }

    if (item.groomingDetails) {
      const sessionId = await deps.syncGroomingSession({
        item,
        orderItem,
        order: params.order,
        customerId: params.customerId ?? null,
        branchId: params.branchId ?? null,
      })
      if (sessionId) serviceTraceParts.push(`GROOMING_SESSION:${sessionId}`)
    }

    if (item.hotelDetails) {
      const groupKey = item.hotelDetails.bookingGroupKey ?? orderItem.id
      const group = hotelStayGroups.get(groupKey) ?? []
      group.push({ item, orderItem })
      hotelStayGroups.set(groupKey, group)
    }
  }

  for (const [groupKey, entries] of hotelStayGroups.entries()) {
    const traceParts = await deps.syncGroupedHotelStay({
      entries,
      order: params.order,
      customerId: params.customerId ?? null,
      branchId: params.branchId ?? null,
    })
    serviceTraceParts.push(...(traceParts && traceParts.length > 0 ? traceParts : [`HOTEL_GROUP:${groupKey}`]))
  }

  await deps.recordInitialPayments({
    order: params.order,
    normalizedPayments: params.normalizedPayments,
    notes: params.notes ?? null,
    staffId: params.staffId,
    serviceTraceParts,
  })

  if (params.customerId && params.orderType === 'QUICK' && params.paymentStatus === 'PAID') {
    await deps.incrementCustomerStats(params.customerId, params.total)
  }

  if (params.orderStatus === 'COMPLETED') {
    await deps.applyCompletedProductSalesDelta({ order: params.order })
    const physicalItemCount = params.order.items.filter((item) => item.productId).length
    if (physicalItemCount > 0) {
      await deps.createQuickStockExportTimeline({
        order: params.order,
        physicalItemCount,
        staffId: params.staffId,
      })
    }
  }
}
