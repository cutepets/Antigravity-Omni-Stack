type OrderTimelineWriter = {
  create(args: { data: Record<string, unknown> }): Promise<unknown>
}

type CreateOrderTimelineEntryParams = {
  orderId: string
  action: string
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
  performedBy: string
  metadata?: Record<string, unknown>
}

type CreateStockExportTimelineEntryParams = {
  orderId: string
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
  performedBy: string
  occurredAt: Date
  exportedItemCount: number
  pendingTempCount?: number
  metadata?: Record<string, unknown>
}

export async function createOrderTimelineEntry(
  writer: OrderTimelineWriter,
  params: CreateOrderTimelineEntryParams,
) {
  return writer.create({
    data: {
      orderId: params.orderId,
      action: params.action,
      fromStatus: params.fromStatus ?? null,
      toStatus: params.toStatus ?? null,
      note: params.note ?? null,
      performedBy: params.performedBy,
      metadata: params.metadata ?? undefined,
    },
  })
}

export async function createStockExportTimelineEntry(
  writer: OrderTimelineWriter,
  params: CreateStockExportTimelineEntryParams,
) {
  const noteParts = [
    `Xuất kho lúc ${params.occurredAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    `${params.exportedItemCount} sản phẩm được trừ kho`,
    params.pendingTempCount && params.pendingTempCount > 0
      ? `${params.pendingTempCount} sản phẩm tạm chưa đổi`
      : null,
    params.note ?? null,
  ].filter(Boolean)

  return createOrderTimelineEntry(writer, {
    orderId: params.orderId,
    action: 'STOCK_EXPORTED',
    fromStatus: params.fromStatus ?? null,
    toStatus: params.toStatus ?? null,
    note: noteParts.join(' · '),
    performedBy: params.performedBy,
    metadata: {
      ...(params.metadata ?? {}),
      exportedItemCount: params.exportedItemCount,
      pendingTempCount: params.pendingTempCount ?? 0,
    },
  })
}
