type TransactionEditScope = 'FULL' | 'NOTES_ONLY'

type TransactionCapability = {
  editScope: TransactionEditScope
  canDelete: boolean
  lockReason: string | null
}

type CapabilityInput = {
  isManual?: boolean | null
  source?: string | null
  createdAt?: Date | string | null
}

type CapabilityOptions = {
  manualFullEditWindowMs: number
  nowMs?: number
}

type BuildWhereOptions = {
  branchIdFilter?: unknown
  beforeDate?: Date
  searchableFields: readonly string[]
  legacyPaymentMethodTypes: Set<string>
  startOfDay: (value: string) => Date
  endOfDay: (value: string) => Date
}

export function getFinanceTransactionCapability(
  tx: CapabilityInput,
  options: CapabilityOptions,
): TransactionCapability {
  const isManual = tx.isManual ?? tx.source === 'MANUAL'
  const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
  const createdAtMs = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : options.nowMs ?? Date.now()
  const nowMs = options.nowMs ?? Date.now()

  if (!isManual) {
    return {
      editScope: 'NOTES_ONLY',
      canDelete: false,
      lockReason: 'Phiếu đồng bộ chỉ được cập nhật ghi chú.',
    }
  }

  if (nowMs - createdAtMs <= options.manualFullEditWindowMs) {
    return {
      editScope: 'FULL',
      canDelete: true,
      lockReason: null,
    }
  }

  return {
    editScope: 'NOTES_ONLY',
    canDelete: false,
    lockReason: 'Phiếu tự tạo chỉ được sửa hoặc xóa toàn bộ trong 24 giờ đầu. Sau đó chỉ còn sửa ghi chú.',
  }
}

export function normalizeFinanceTransaction(
  tx: any,
  options: CapabilityOptions,
) {
  const capability = getFinanceTransactionCapability(tx, options)

  return {
    id: tx.id,
    voucherNumber: tx.voucherNumber,
    type: tx.type,
    amount: tx.amount,
    description: tx.description,
    category: tx.category ?? null,
    paymentMethod: tx.paymentMethod ?? null,
    paymentAccountId: tx.paymentAccountId ?? null,
    paymentAccountLabel: tx.paymentAccountLabel ?? null,
    branchId: tx.branchId ?? null,
    branchName: tx.branchName ?? tx.branch?.name ?? null,
    payerId: tx.payerId ?? null,
    payerName: tx.payerName ?? null,
    refType: tx.refType ?? null,
    refId: tx.refId ?? null,
    refNumber: tx.refNumber ?? null,
    notes: tx.notes ?? null,
    tags: tx.tags ?? null,
    source: tx.source ?? 'OTHER',
    isManual: tx.isManual ?? tx.source === 'MANUAL',
    attachmentUrl: tx.attachmentUrl ?? null,
    editScope: capability.editScope,
    canDelete: capability.canDelete,
    lockReason: capability.lockReason,
    date: tx.date,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    createdBy: tx.staff
      ? {
          id: tx.staff.id,
          name: tx.staff.fullName,
        }
      : null,
  }
}

export function buildFinanceTransactionWhere(
  query: {
    type?: string
    createdById?: string
    paymentMethod?: string
    source?: string
    refNumber?: string
    description?: string
    payerName?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  },
  options: BuildWhereOptions,
) {
  const where: any = {}

  if (query.type && query.type !== 'ALL') where.type = query.type
  if (query.createdById) where.staffId = query.createdById
  if (options.branchIdFilter !== undefined) where.branchId = options.branchIdFilter
  if (query.paymentMethod?.trim()) {
    const normalizedPaymentFilter = query.paymentMethod.trim()
    const upperPaymentFilter = normalizedPaymentFilter.toUpperCase()
    if (options.legacyPaymentMethodTypes.has(upperPaymentFilter)) {
      where.paymentMethod = upperPaymentFilter
    } else {
      where.paymentAccountId = normalizedPaymentFilter
    }
  }
  if (query.source && query.source !== 'ALL') where.source = query.source
  if (query.refNumber?.trim()) where.refNumber = { contains: query.refNumber.trim(), mode: 'insensitive' }
  if (query.description?.trim()) where.description = { contains: query.description.trim(), mode: 'insensitive' }
  if (query.payerName?.trim()) where.payerName = { contains: query.payerName.trim(), mode: 'insensitive' }

  if (options.beforeDate) {
    where.date = { lt: options.beforeDate }
  } else if (query.dateFrom || query.dateTo) {
    where.date = {}
    if (query.dateFrom) where.date.gte = options.startOfDay(query.dateFrom)
    if (query.dateTo) where.date.lte = options.endOfDay(query.dateTo)
  }

  const searchTerms = query.search?.trim().split(/\s+/).filter(Boolean) ?? []
  if (searchTerms.length > 0) {
    where.AND = searchTerms.map((term) => ({
      OR: options.searchableFields.map((field) => ({
        [field]: { contains: term, mode: 'insensitive' },
      })),
    }))
  }

  return where
}
