import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { PaymentStatus } from '@petshop/database'
import {
  buildProductVariantName,
  getProductVariantGroupKey,
  normalizeBranchCode,
  resolveProductVariantLabels,
  suggestBranchCodeFromName,
} from '@petshop/shared'
import { generateFinanceVoucherNumber } from '../../common/utils/finance-voucher.util.js'
import { DatabaseService } from '../../database/database.service.js'
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js'

export interface FindReceiptsDto {
  page?: number
  limit?: number
  status?: string
  supplierId?: string
  search?: string
  productId?: string
}

export interface FindStockProductsDto {
  search?: string
  branchId?: string
  filterType?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ReceiptItemDto {
  receiptItemId?: string
  productId: string
  productVariantId?: string | null
  quantity: number
  unitCost: number
  notes?: string
}

export interface CreateReceiptDto {
  supplierId?: string
  branchId?: string
  notes?: string
  items: ReceiptItemDto[]
}

export interface ReceiptPaymentAllocationDto {
  receiptId: string
  amount: number
}

export interface PayReceiptDto {
  amount?: number
  paymentMethod?: string
  notes?: string
  paidAt?: string
  branchId?: string
  allocations?: ReceiptPaymentAllocationDto[]
}

export interface ReceiveReceiptItemDto {
  receiptItemId?: string
  productId?: string
  productVariantId?: string | null
  quantity: number
}

export interface ReceiveReceiptDto {
  notes?: string
  receivedAt?: string
  branchId?: string
  items?: ReceiveReceiptItemDto[]
}

export interface CloseReceiptItemDto {
  receiptItemId?: string
  productId?: string
  productVariantId?: string | null
  quantity: number
  reason?: string
}

export interface CloseReceiptDto {
  notes?: string
  closedAt?: string
  items: CloseReceiptItemDto[]
}

export interface CreateSupplierDto {
  code?: string
  name: string
  phone?: string
  email?: string
  address?: string
  avatar?: string
  notes?: string
  documents?: unknown
  monthTarget?: number | null
  yearTarget?: number | null
  isActive?: boolean
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> { }

export interface ReturnItemDto {
  receiptItemId?: string
  productId?: string
  productVariantId?: string | null
  quantity: number
  unitPrice?: number
  reason?: string
}

export interface CreateReturnReceiptDto {
  notes?: string
  returnedAt?: string
  items: ReturnItemDto[]
}

export interface RefundSupplierReturnDto {
  amount: number
  paymentMethod?: string
  notes?: string
  receivedAt?: string
  branchId?: string
}

type SupplierDocument = {
  name: string
  type?: string | null
  url: string
  uploadedAt?: string | null
  expiresAt?: string | null
  notes?: string | null
  remindBeforeDays?: number | null
}

type ReceiptSnapshot = {
  orderedAmount: number
  receivedAmount: number
  returnedAmount: number
  payableAmount: number
  paidAmount: number
  outstandingAmount: number
  overpaidAmount: number
  itemCount: number
  orderedQty: number
  receivedQty: number
  returnedQty: number
  closedQty: number
  receiptStatus: string
  paymentStatus: PaymentStatus
  legacyStatus: string
  paymentDate: Date | null
  receivedAt: Date | null
  completedAt: Date | null
}

const SUPPLIER_RECEIPT_INCLUDE = {
  supplier: true,
  branch: true,
  items: {
    include: {
      product: true,
      productVariant: true,
      receiveItems: true,
      returnItems: true,
    },
  },
  paymentAllocations: {
    include: {
      payment: {
        include: {
          staff: { select: { id: true, fullName: true } },
        },
      },
    },
  },
  receiveEvents: {
    include: {
      items: true,
      staff: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
    orderBy: { receivedAt: 'desc' as const },
  },
  supplierReturns: {
    include: {
      items: true,
      refunds: {
        include: {
          staff: { select: { id: true, fullName: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { receivedAt: 'desc' as const },
      },
      staff: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
    orderBy: { returnedAt: 'desc' as const },
  },
} as const

const DAY_IN_MS = 24 * 60 * 60 * 1000

function normalizeSearchValue(value?: string | null) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim()
}

function tokenizeSearch(value?: string | null) {
  return normalizeSearchValue(value)
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function buildProductSearchHaystack(product: Record<string, any>) {
  const variantText = Array.isArray(product.variants)
    ? product.variants
      .map((variant: Record<string, any>) => {
        const { variantLabel, unitLabel, displayName } = resolveProductVariantLabels(product.name, variant)
        return [variant.name, displayName, variantLabel, unitLabel, variant.sku, variant.barcode, variant.conversions, variant.pricePolicies, variant.priceBookPrices]
          .filter(Boolean)
          .join(' ')
      })
      .join(' ')
    : ''

  return normalizeSearchValue(
    [
      product.name,
      product.sku,
      product.barcode,
      product.category,
      product.brand,
      product.importName,
      product.tags,
      product.description,
      variantText,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function buildInventoryEntityKey(productId: string, productVariantId?: string | null) {
  return productVariantId ? `variant:${productVariantId}` : `product:${productId}`
}

function buildInventoryEntitySearchHaystack(product: Record<string, any>, variant?: Record<string, any> | null) {
  const { variantLabel, unitLabel, displayName } = resolveProductVariantLabels(product.name, variant)
  return normalizeSearchValue(
    [
      product.name,
      product.sku,
      product.barcode,
      product.category,
      product.brand,
      product.importName,
      product.tags,
      product.description,
      variant?.name,
      displayName,
      variantLabel,
      unitLabel,
      variant?.sku,
      variant?.barcode,
      variant?.conversions,
      variant?.pricePolicies,
      variant?.priceBookPrices,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function shiftMonth(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function monthBucket(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function compareText(left?: string | null, right?: string | null) {
  return `${left ?? ''}`.localeCompare(`${right ?? ''}`, 'vi', { sensitivity: 'base' })
}

function toNumber(value: unknown) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function toInt(value: unknown) {
  return Math.max(0, Math.round(toNumber(value)))
}

function parseDateInput(value?: string | null) {
  if (!value) return new Date()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Ngày không hợp lệ')
  }
  return date
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function parseConversionRate(raw?: string | null) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    const value = Number(parsed?.rate ?? parsed?.conversionRate ?? parsed?.mainQty)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function isConversionVariant(variant?: { conversions?: string | null } | null) {
  return !!parseConversionRate(variant?.conversions)
}

function getTrueVariants<T extends { conversions?: string | null }>(variants: T[]) {
  return variants.filter((variant) => !isConversionVariant(variant))
}

function findParentTrueVariant<T extends { name?: string | null; conversions?: string | null }>(
  variants: T[],
  selectedVariant?: T | null,
  productName?: string | null,
) {
  if (!selectedVariant) return null
  if (!isConversionVariant(selectedVariant)) return selectedVariant

  const trueVariants = getTrueVariants(variants)
  const selectedGroupKey = getProductVariantGroupKey(productName, selectedVariant)
  return trueVariants.find((variant) => getProductVariantGroupKey(productName, variant) === selectedGroupKey) ?? null
}

function getConversionVariants<T extends { name?: string | null; conversions?: string | null }>(
  variants: T[],
  currentTrueVariant?: T | null,
  productName?: string | null,
) {
  const allConversions = variants.filter((variant) => isConversionVariant(variant))
  const targetGroupKey = currentTrueVariant
    ? getProductVariantGroupKey(productName, currentTrueVariant)
    : '__base__'

  return allConversions.filter((variant) => getProductVariantGroupKey(productName, variant) === targetGroupKey)
}

function aggregateBranchStocks(rows: any[]) {
  const grouped = new Map<string, any>()

  rows.forEach((row, index) => {
    const key = row.branchId ?? row.branch?.id ?? row.id ?? `branch-${index}`
    const existing = grouped.get(key)

    if (existing) {
      existing.stock = toInt(existing.stock) + toInt(row.stock)
      existing.reservedStock = toInt(existing.reservedStock) + toInt(row.reservedStock)
      existing.minStock = toInt(existing.minStock) + toInt(row.minStock)
      return
    }

    grouped.set(key, {
      ...row,
      id: row.id ?? key,
      stock: toInt(row.stock),
      reservedStock: toInt(row.reservedStock),
      minStock: toInt(row.minStock),
    })
  })

  return Array.from(grouped.values())
}

function scaleBranchStocks(rows: any[], factor: number) {
  return rows.map((row) => ({
    ...row,
    stock: toNumber(row.stock) * factor,
    reservedStock: toNumber(row.reservedStock) * factor,
    minStock: 0,
  }))
}

function sanitizeSupplierDocuments(value: unknown): SupplierDocument[] | null {
  if (!Array.isArray(value)) return null

  const normalized = value
    .map((document) => {
      const name = String((document as any)?.name ?? '').trim()
      const url = String((document as any)?.url ?? '').trim()
      if (!name || !url) return null

      const remindBeforeDays = Number((document as any)?.remindBeforeDays)

      return {
        name,
        type: String((document as any)?.type ?? '').trim() || null,
        url,
        uploadedAt: String((document as any)?.uploadedAt ?? '').trim() || new Date().toISOString(),
        expiresAt: String((document as any)?.expiresAt ?? '').trim() || null,
        notes: String((document as any)?.notes ?? '').trim() || null,
        remindBeforeDays:
          Number.isFinite(remindBeforeDays) && remindBeforeDays >= 0 ? Math.round(remindBeforeDays) : null,
      } satisfies SupplierDocument
    })
    .filter(Boolean) as SupplierDocument[]

  return normalized
}

function buildLegacyReceiptStatus(receiptStatus: string) {
  if (receiptStatus === 'CANCELLED') return 'CANCELLED'
  if (receiptStatus === 'FULL_RECEIVED' || receiptStatus === 'SHORT_CLOSED') return 'RECEIVED'
  return 'DRAFT'
}

function buildPaymentStatus(payableAmount: number, paidAmount: number): PaymentStatus {
  if (payableAmount <= 0) {
    return paidAmount > 0 ? 'PAID' : 'UNPAID'
  }

  if (paidAmount <= 0) return 'UNPAID'
  if (paidAmount < payableAmount) return 'PARTIAL'
  return 'PAID'
}

@Injectable()
export class StockService {
  constructor(private readonly db: DatabaseService) { }

  private createNumber(prefix: string) {
    const now = new Date()
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const randomPart = Math.floor(Math.random() * 9000 + 1000)
    return `${prefix}${datePart}${timePart}${randomPart}`
  }

  private async createReceiptNumber() {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `PN${yy}${mm}`

    const latest = await this.db.stockReceipt.findFirst({
      where: {
        receiptNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        receiptNumber: 'desc',
      },
      select: {
        receiptNumber: true,
      },
    })

    const latestSequence = latest?.receiptNumber ? Number(latest.receiptNumber.slice(-3)) : 0
    return `${prefix}${String(latestSequence + 1).padStart(3, '0')}`
  }

  private sanitizeSupplierPayload(dto: Partial<CreateSupplierDto>) {
    const payload: Record<string, unknown> = {}

    if (dto.code !== undefined) payload.code = dto.code?.trim() || null
    if (dto.name !== undefined) payload.name = dto.name.trim()
    if (dto.phone !== undefined) payload.phone = dto.phone?.trim() || null
    if (dto.email !== undefined) payload.email = dto.email?.trim() || null
    if (dto.address !== undefined) payload.address = dto.address?.trim() || null
    if (dto.avatar !== undefined) payload.avatar = dto.avatar?.trim() || null
    if (dto.notes !== undefined) payload.notes = dto.notes?.trim() || null
    if (dto.monthTarget !== undefined) payload.monthTarget = dto.monthTarget == null ? null : toNumber(dto.monthTarget)
    if (dto.yearTarget !== undefined) payload.yearTarget = dto.yearTarget == null ? null : toNumber(dto.yearTarget)
    if (dto.isActive !== undefined) payload.isActive = Boolean(dto.isActive)
    if (dto.documents !== undefined) payload.documents = sanitizeSupplierDocuments(dto.documents)

    return payload
  }

  private async ensureUniqueSupplierCode(name: string, preferredCode?: string | null, excludeId?: string) {
    const baseCode = normalizeBranchCode(preferredCode?.trim() || suggestBranchCodeFromName(name))

    if (!baseCode) {
      throw new BadRequestException('ID NCC không hợp lệ')
    }

    let candidate = baseCode
    let suffix = 1

    for (; ;) {
      const existing = await this.db.supplier.findFirst({
        where: {
          code: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      })

      if (!existing) return candidate

      if (preferredCode) {
        throw new ConflictException(`ID NCC "${candidate}" đã tồn tại`)
      }

      suffix += 1
      const suffixText = String(suffix)
      candidate = normalizeBranchCode(`${baseCode.slice(0, Math.max(0, 4 - suffixText.length))}${suffixText}`)
    }
  }

  private async backfillSupplierCode<T extends { id: string; name: string; code?: string | null }>(supplier: T) {
    if (supplier.code?.trim()) return supplier

    const code = await this.ensureUniqueSupplierCode(supplier.name, undefined, supplier.id)
    await this.db.supplier.update({
      where: { id: supplier.id },
      data: { code } as any,
    })

    return {
      ...supplier,
      code,
    }
  }

  private buildReceiptSnapshot(receipt: any): ReceiptSnapshot {
    const orderedAmount = roundCurrency(
      (receipt.items ?? []).reduce((sum: number, item: any) => sum + toNumber(item.totalPrice || item.quantity * item.unitPrice), 0),
    )
    const receivedAmount = roundCurrency(
      (receipt.items ?? []).reduce(
        (sum: number, item: any) =>
          sum +
          ((item.receiveItems?.length ?? 0) > 0
            ? item.receiveItems.reduce((itemSum: number, receiveItem: any) => itemSum + toNumber(receiveItem.totalPrice), 0)
            : toInt(item.receivedQuantity) * toNumber(item.unitPrice)),
        0,
      ),
    )
    const returnedAmount = roundCurrency(
      (receipt.items ?? []).reduce(
        (sum: number, item: any) =>
          sum +
          ((item.returnItems?.length ?? 0) > 0
            ? item.returnItems.reduce((itemSum: number, returnItem: any) => itemSum + toNumber(returnItem.totalPrice), 0)
            : toInt(item.returnedQuantity) * toNumber(item.unitPrice)),
        0,
      ),
    )
    const paidFromAllocations = roundCurrency(
      (receipt.paymentAllocations ?? []).reduce((sum: number, allocation: any) => sum + toNumber(allocation.amount), 0),
    )
    const paidAmount = roundCurrency(Math.max(toNumber(receipt.paidAmount), paidFromAllocations))
    const payableAmount = roundCurrency(Math.max(0, receivedAmount - returnedAmount))
    const outstandingAmount = roundCurrency(Math.max(0, payableAmount - paidAmount))
    const overpaidAmount = roundCurrency(Math.max(0, paidAmount - payableAmount))
    const orderedQty = (receipt.items ?? []).reduce((sum: number, item: any) => sum + toInt(item.quantity), 0)
    const receivedQty = (receipt.items ?? []).reduce((sum: number, item: any) => sum + toInt(item.receivedQuantity), 0)
    const returnedQty = (receipt.items ?? []).reduce((sum: number, item: any) => sum + toInt(item.returnedQuantity), 0)
    const closedQty = (receipt.items ?? []).reduce((sum: number, item: any) => sum + toInt(item.closedQuantity), 0)
    const latestPayment = [...(receipt.paymentAllocations ?? [])]
      .sort((left: any, right: any) => new Date(right.payment?.paidAt ?? 0).getTime() - new Date(left.payment?.paidAt ?? 0).getTime())[0]
    const latestReceive = [...(receipt.receiveEvents ?? [])]
      .sort((left: any, right: any) => new Date(right.receivedAt ?? 0).getTime() - new Date(left.receivedAt ?? 0).getTime())[0]

    let receiptStatus = 'DRAFT'
    const allFulfilled = (receipt.items ?? []).every(
      (item: any) => toInt(item.receivedQuantity) + toInt(item.closedQuantity) >= toInt(item.quantity),
    )
    const hasAnyReceive = receivedQty > 0
    const hasAnyClose = closedQty > 0

    if (receipt.cancelledAt || receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') {
      receiptStatus = 'CANCELLED'
    } else if ((receipt.items?.length ?? 0) > 0 && allFulfilled && hasAnyClose) {
      receiptStatus = 'SHORT_CLOSED'
    } else if ((receipt.items?.length ?? 0) > 0 && allFulfilled && hasAnyReceive) {
      receiptStatus = 'FULL_RECEIVED'
    } else if (hasAnyReceive) {
      receiptStatus = 'PARTIAL_RECEIVED'
    }

    return {
      orderedAmount,
      receivedAmount,
      returnedAmount,
      payableAmount,
      paidAmount,
      outstandingAmount,
      overpaidAmount,
      itemCount: orderedQty,
      orderedQty,
      receivedQty,
      returnedQty,
      closedQty,
      receiptStatus,
      paymentStatus: buildPaymentStatus(payableAmount, paidAmount),
      legacyStatus: buildLegacyReceiptStatus(receiptStatus),
      paymentDate: latestPayment?.payment?.paidAt ? new Date(latestPayment.payment.paidAt) : null,
      receivedAt: latestReceive?.receivedAt ? new Date(latestReceive.receivedAt) : null,
      completedAt:
        receiptStatus === 'FULL_RECEIVED' || receiptStatus === 'SHORT_CLOSED'
          ? new Date(receipt.shortClosedAt ?? latestReceive?.receivedAt ?? new Date())
          : null,
    }
  }

  private async createFinanceTransaction(
    tx: any,
    params: {
      type: 'INCOME' | 'EXPENSE'
      amount: number
      branchId?: string | null
      paymentMethod?: string | null
      description: string
      refType?: string | null
      refId?: string | null
      refNumber?: string | null
      payerId?: string | null
      payerName?: string | null
      notes?: string | null
      source: string
      staffId?: string | null
      date?: Date
    },
  ) {
    if (params.amount <= 0) return null

    const branch = params.branchId ? await resolveBranchIdentity(tx as any, params.branchId) : null
    const issuedAt = params.date ?? new Date()

    for (let attempt = 0; attempt < 5; attempt++) {
      const voucherNumber = await generateFinanceVoucherNumber(tx as any, params.type, issuedAt)

      try {
        return await tx.transaction.create({
          data: {
            voucherNumber,
            type: params.type,
            amount: roundCurrency(params.amount),
            description: params.description,
            paymentMethod: params.paymentMethod ?? null,
            branchId: branch?.id ?? params.branchId ?? null,
            branchName: branch?.name ?? null,
            refType: params.refType ?? null,
            refId: params.refId ?? null,
            refNumber: params.refNumber ?? null,
            payerId: params.payerId ?? null,
            payerName: params.payerName ?? null,
            notes: params.notes ?? null,
            source: params.source,
            isManual: false,
            staffId: params.staffId ?? null,
            date: issuedAt,
          } as any,
        })
      } catch (error: any) {
        if (error?.code !== 'P2002') {
          throw error
        }
      }
    }

    throw new Error('Khong the tao so chung tu duy nhat cho phieu thu chi')
  }

  private async adjustBranchStock(
    tx: any,
    params: {
      branchId?: string | null
      productId: string
      productVariantId?: string | null
      quantityDelta: number
      reason: string
      referenceId?: string | null
      referenceType?: string | null
      staffId?: string | null
    },
  ) {
    if (!params.quantityDelta) return null

    const branch = await resolveBranchIdentity(tx as any, params.branchId ?? null)
    const current = await tx.branchStock.findFirst({
      where: {
        branchId: branch.id,
        productId: params.productId,
        productVariantId: params.productVariantId ?? null,
      },
    })

    if (params.quantityDelta < 0 && (!current || current.stock < Math.abs(params.quantityDelta))) {
      throw new BadRequestException('Tồn kho không đủ để thực hiện thao tác trả hàng')
    }

    if (current) {
      await tx.branchStock.update({
        where: { id: current.id },
        data: {
          stock: { increment: params.quantityDelta },
        } as any,
      })
    } else {
      await tx.branchStock.create({
        data: {
          branchId: branch.id,
          productId: params.productId,
          productVariantId: params.productVariantId ?? null,
          stock: Math.max(0, params.quantityDelta),
          reservedStock: 0,
          minStock: 5,
        } as any,
      })
    }

    await tx.stockTransaction.create({
      data: {
        productId: params.productId,
        productVariantId: params.productVariantId ?? null,
        branchId: branch.id ?? null,
        staffId: params.staffId ?? null,
        type: params.quantityDelta > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(params.quantityDelta),
        reason: params.reason,
        referenceId: params.referenceId ?? null,
        referenceType: params.referenceType ?? null,
      } as any,
    })

    return branch
  }

  private async recalculateReceiptState(tx: any, receiptId: string) {
    const receipt = await tx.stockReceipt.findUnique({
      where: { id: receiptId },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })

    if (!receipt) {
      throw new NotFoundException('Không tìm thấy phiếu nhập')
    }

    const snapshot = this.buildReceiptSnapshot(receipt)

    const updated = await tx.stockReceipt.update({
      where: { id: receiptId },
      data: {
        totalAmount: snapshot.orderedAmount,
        totalReceivedAmount: snapshot.receivedAmount,
        totalReturnedAmount: snapshot.returnedAmount,
        paidAmount: snapshot.paidAmount,
        status: snapshot.legacyStatus,
        receiptStatus: snapshot.receiptStatus,
        paymentStatus: snapshot.paymentStatus,
        receivedAt: snapshot.receivedAt,
        completedAt: snapshot.completedAt,
        shortClosedAt:
          snapshot.receiptStatus === 'SHORT_CLOSED'
            ? receipt.shortClosedAt ?? snapshot.completedAt ?? new Date()
            : receipt.shortClosedAt,
      } as any,
      include: SUPPLIER_RECEIPT_INCLUDE,
    })

    return {
      receipt: updated,
      snapshot: this.buildReceiptSnapshot(updated),
    }
  }

  private async recalculateSupplierBalance(tx: any, supplierId?: string | null) {
    if (!supplierId) return

    const receipts = await tx.stockReceipt.findMany({
      where: { supplierId },
      select: {
        paidAmount: true,
        totalReceivedAmount: true,
        totalReturnedAmount: true,
        status: true,
        receiptStatus: true,
      },
    })
    const payments = await tx.supplierPayment.findMany({
      where: { supplierId },
      select: { unappliedAmount: true },
    })
    const returns = await tx.supplierReturn.findMany({
      where: { supplierId },
      select: {
        creditedAmount: true,
        refundedAmount: true,
      },
    })

    const debt = roundCurrency(
      receipts.reduce((sum: number, receipt: any) => {
        if (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') return sum
        const payableAmount = Math.max(0, toNumber(receipt.totalReceivedAmount) - toNumber(receipt.totalReturnedAmount))
        return sum + Math.max(0, payableAmount - toNumber(receipt.paidAmount))
      }, 0),
    )
    const paymentCredit = roundCurrency(
      payments.reduce((sum: number, payment: any) => sum + toNumber(payment.unappliedAmount), 0),
    )
    const returnCredit = roundCurrency(
      returns.reduce(
        (sum: number, supplierReturn: any) =>
          sum + Math.max(0, toNumber(supplierReturn.creditedAmount) - toNumber(supplierReturn.refundedAmount)),
        0,
      ),
    )

    await tx.supplier.update({
      where: { id: supplierId },
      data: {
        debt,
        creditBalance: roundCurrency(paymentCredit + returnCredit),
      } as any,
    })
  }

  private async applySupplierPaymentCreditsToReceipt(tx: any, receiptId: string, supplierId: string) {
    const receipt = await tx.stockReceipt.findUnique({
      where: { id: receiptId },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')

    const snapshot = this.buildReceiptSnapshot(receipt)
    let remaining = snapshot.outstandingAmount
    if (remaining <= 0) return

    const creditPayments = await tx.supplierPayment.findMany({
      where: {
        supplierId,
        unappliedAmount: { gt: 0 },
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    })

    for (const payment of creditPayments) {
      if (remaining <= 0) break
      const allocationAmount = Math.min(remaining, toNumber(payment.unappliedAmount))
      if (allocationAmount <= 0) continue

      await tx.supplierPaymentAllocation.create({
        data: {
          paymentId: payment.id,
          receiptId,
          amount: roundCurrency(allocationAmount),
        } as any,
      })
      await tx.supplierPayment.update({
        where: { id: payment.id },
        data: {
          appliedAmount: { increment: allocationAmount },
          unappliedAmount: { decrement: allocationAmount },
        } as any,
      })

      remaining = roundCurrency(remaining - allocationAmount)
    }
  }

  private async allocatePaymentToReceipts(
    tx: any,
    paymentId: string,
    supplierId: string,
    amount: number,
    allocations?: ReceiptPaymentAllocationDto[],
    preferredReceiptId?: string | null,
  ) {
    let remaining = roundCurrency(amount)
    let appliedAmount = 0

    const hasExplicitAllocations = Boolean(allocations && allocations.length > 0)
    const requestedAllocations =
      hasExplicitAllocations
        ? (allocations ?? [])
        : preferredReceiptId
          ? [{ receiptId: preferredReceiptId, amount: remaining }]
          : []

    for (const allocation of requestedAllocations) {
      if (remaining <= 0) break
      const requestedAmount = Math.max(0, toNumber(allocation.amount))
      if (requestedAmount <= 0) continue

      const receipt = await tx.stockReceipt.findUnique({
        where: { id: allocation.receiptId },
        include: SUPPLIER_RECEIPT_INCLUDE,
      })
      if (!receipt) {
        throw new NotFoundException(`Không tìm thấy phiếu nhập ${allocation.receiptId}`)
      }
      if (receipt.supplierId !== supplierId) {
        throw new BadRequestException('Phiếu nhập không thuộc nhà cung cấp đã chọn')
      }
      if (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') {
        throw new BadRequestException('Không thể phân bổ thanh toán cho phiếu đã hủy')
      }

      const snapshot = this.buildReceiptSnapshot(receipt)
      const orderBasedOutstanding = roundCurrency(
        Math.max(0, snapshot.orderedAmount - snapshot.returnedAmount - snapshot.paidAmount),
      )
      const receivableLimit =
        requestedAllocations.length > 0
          ? Math.max(snapshot.outstandingAmount, orderBasedOutstanding)
          : snapshot.outstandingAmount
      const receivable = Math.min(remaining, requestedAmount, receivableLimit)
      if (receivable <= 0) continue

      await tx.supplierPaymentAllocation.create({
        data: {
          paymentId,
          receiptId: receipt.id,
          amount: roundCurrency(receivable),
        } as any,
      })

      remaining = roundCurrency(remaining - receivable)
      appliedAmount = roundCurrency(appliedAmount + receivable)
      await this.recalculateReceiptState(tx, receipt.id)
    }

    if (remaining > 0 && !hasExplicitAllocations) {
      const receipts = await tx.stockReceipt.findMany({
        where: {
          supplierId,
          id: preferredReceiptId ? { not: preferredReceiptId } : undefined,
          status: { not: 'CANCELLED' },
          receiptStatus: { not: 'CANCELLED' },
        },
        include: SUPPLIER_RECEIPT_INCLUDE,
        orderBy: { createdAt: 'asc' },
      })

      for (const receipt of receipts) {
        if (remaining <= 0) break

        const snapshot = this.buildReceiptSnapshot(receipt)
        const receivable = Math.min(remaining, snapshot.outstandingAmount)
        if (receivable <= 0) continue

        await tx.supplierPaymentAllocation.create({
          data: {
            paymentId,
            receiptId: receipt.id,
            amount: roundCurrency(receivable),
          } as any,
        })

        remaining = roundCurrency(remaining - receivable)
        appliedAmount = roundCurrency(appliedAmount + receivable)
        await this.recalculateReceiptState(tx, receipt.id)
      }
    }

    return {
      appliedAmount,
      unappliedAmount: roundCurrency(Math.max(0, remaining)),
    }
  }

  private async attachReceiptPaymentSummary(receipt: any) {
    if (!receipt?.id || !receipt?.supplierId) {
      return {
        ...receipt,
        paymentSummary: {
          orderPaymentAmount: roundCurrency(toNumber(receipt?.paidAmount)),
          targetedPaymentAmount: 0,
          debtSettlementAmount: 0,
          unappliedCreditAmount: 0,
        },
      }
    }

    const targetedPayments = await this.db.supplierPayment.findMany({
      where: {
        supplierId: receipt.supplierId,
        targetReceiptId: receipt.id,
      },
      select: {
        id: true,
        appliedAmount: true,
        unappliedAmount: true,
      },
    })

    const targetedPaymentIds = new Set(targetedPayments.map((payment) => payment.id))
    const targetedPaymentAmount = roundCurrency(
      targetedPayments.reduce((sum, payment) => sum + toNumber(payment.appliedAmount), 0),
    )
    const unappliedCreditAmount = roundCurrency(
      targetedPayments.reduce((sum, payment) => sum + toNumber(payment.unappliedAmount), 0),
    )
    const targetedAppliedToCurrentReceipt = roundCurrency(
      (receipt.paymentAllocations ?? []).reduce((sum: number, allocation: any) => {
        const paymentId = allocation?.payment?.id
        if (!paymentId || !targetedPaymentIds.has(paymentId)) return sum
        return sum + toNumber(allocation.amount)
      }, 0),
    )

    return {
      ...receipt,
      paymentSummary: {
        orderPaymentAmount: roundCurrency(toNumber(receipt.paidAmount)),
        targetedPaymentAmount,
        debtSettlementAmount: roundCurrency(
          Math.max(0, targetedPaymentAmount - targetedAppliedToCurrentReceipt),
        ),
        unappliedCreditAmount,
      },
    }
  }

  private mapReceiptResponse(receipt: any) {
    const snapshot = this.buildReceiptSnapshot(receipt)
    return {
      ...receipt,
      totalAmount: snapshot.orderedAmount,
      totalReceivedAmount: snapshot.receivedAmount,
      totalReturnedAmount: snapshot.returnedAmount,
      paidAmount: snapshot.paidAmount,
      debtAmount: snapshot.outstandingAmount,
      payableAmount: snapshot.payableAmount,
      overpaidAmount: snapshot.overpaidAmount,
      itemCount: snapshot.itemCount,
      orderedQty: snapshot.orderedQty,
      receivedQty: snapshot.receivedQty,
      returnedQty: snapshot.returnedQty,
      closedQty: snapshot.closedQty,
      receiptStatus: snapshot.receiptStatus,
      paymentStatus: snapshot.paymentStatus,
      status: snapshot.legacyStatus,
      paymentDate: snapshot.paymentDate,
      receivedAt: snapshot.receivedAt,
      completedAt: snapshot.completedAt,
    }
  }

  private async attachPaymentTransactionVouchers(receipt: any) {
    if (!receipt?.paymentAllocations?.length) return receipt

    const transactionIds = Array.from(
      new Set(
        receipt.paymentAllocations
          .map((allocation: any) => allocation?.payment?.transactionId)
          .filter(Boolean) as string[],
      ),
    )

    if (transactionIds.length === 0) return receipt

    const transactions = await this.db.transaction.findMany({
      where: { id: { in: transactionIds } },
      select: { id: true, voucherNumber: true },
    })
    const voucherMap = new Map(transactions.map((transaction) => [transaction.id, transaction.voucherNumber]))

    return {
      ...receipt,
      paymentAllocations: receipt.paymentAllocations.map((allocation: any) => ({
        ...allocation,
        payment: allocation.payment
          ? {
            ...allocation.payment,
            transactionVoucherNumber: allocation.payment.transactionId
              ? voucherMap.get(allocation.payment.transactionId) ?? null
              : null,
          }
          : allocation.payment,
      })),
    }
  }

  private async attachPaymentTransactionVouchersToMany(receipts: any[]) {
    if (!Array.isArray(receipts) || receipts.length === 0) return receipts
    return Promise.all(receipts.map((receipt) => this.attachPaymentTransactionVouchers(receipt)))
  }

  private async attachSupplierReturnRefundTransactionVouchers(supplierReturn: any) {
    if (!supplierReturn?.refunds?.length) return supplierReturn

    const transactionIds = Array.from(
      new Set(
        supplierReturn.refunds
          .map((refund: any) => refund?.transactionId)
          .filter(Boolean) as string[],
      ),
    )

    if (transactionIds.length === 0) return supplierReturn

    const transactions = await this.db.transaction.findMany({
      where: { id: { in: transactionIds } },
      select: { id: true, voucherNumber: true },
    })
    const voucherMap = new Map(transactions.map((transaction) => [transaction.id, transaction.voucherNumber]))

    return {
      ...supplierReturn,
      refunds: supplierReturn.refunds.map((refund: any) => ({
        ...refund,
        transactionVoucherNumber: refund.transactionId ? voucherMap.get(refund.transactionId) ?? null : null,
      })),
    }
  }

  private async attachSupplierReturnTransactionVouchers(receipt: any) {
    if (!receipt?.supplierReturns?.length) return receipt

    return {
      ...receipt,
      supplierReturns: await Promise.all(
        receipt.supplierReturns.map((supplierReturn: any) =>
          this.attachSupplierReturnRefundTransactionVouchers(supplierReturn),
        ),
      ),
    }
  }

  async findAllReceipts(query: FindReceiptsDto) {
    const { page = 1, limit = 20, status, supplierId, search, productId } = query
    const skip = (Number(page) - 1) * Number(limit)
    const where: Record<string, unknown> = {}

    if (supplierId) where.supplierId = supplierId
    if (status) {
      where.OR = [{ status }, { receiptStatus: status }, { paymentStatus: status as any }]
    }
    if (search) {
      const searchClause = { contains: search, mode: 'insensitive' }
      const existingOr = Array.isArray(where.OR) ? where.OR : []
      where.OR = [
        ...existingOr,
        { receiptNumber: searchClause },
        { supplier: { name: searchClause } },
      ]
    }
    if (productId) {
      where.items = {
        some: { productId },
      }
    }

    const [rows, total] = await Promise.all([
      this.db.stockReceipt.findMany({
        where: where as any,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: SUPPLIER_RECEIPT_INCLUDE,
      }),
      this.db.stockReceipt.count({ where: where as any }),
    ])

    const mappedRows = await this.attachPaymentTransactionVouchersToMany(
      rows.map((receipt) => this.mapReceiptResponse(receipt)),
    )

    return {
      success: true,
      data: mappedRows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    }
  }

  async findReceiptById(id: string) {
    const receipt = await this.db.stockReceipt.findFirst({
      where: {
        OR: [{ id }, { receiptNumber: id }],
      },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    const mappedReceipt = this.mapReceiptResponse(receipt)
    const summarizedReceipt = await this.attachReceiptPaymentSummary(mappedReceipt)
    const receiptWithPaymentVouchers = await this.attachPaymentTransactionVouchers(summarizedReceipt)
    return {
      success: true,
      data: await this.attachSupplierReturnTransactionVouchers(receiptWithPaymentVouchers),
    }
  }

  async createReceipt(dto: CreateReceiptDto) {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Phiếu nhập phải có ít nhất một mặt hàng')
    }

    const items = dto.items.map((item) => {
      const quantity = toInt(item.quantity)
      const unitPrice = toNumber(item.unitCost)
      if (!item.productId?.trim()) {
        throw new BadRequestException('Thiếu sản phẩm trong phiếu nhập')
      }
      if (quantity <= 0) {
        throw new BadRequestException('Số lượng nhập phải lớn hơn 0')
      }
      if (unitPrice < 0) {
        throw new BadRequestException('Đơn giá nhập không hợp lệ')
      }

      return {
        productId: item.productId,
        productVariantId: item.productVariantId?.trim() || null,
        quantity,
        unitPrice,
        totalPrice: roundCurrency(quantity * unitPrice),
      }
    })

    const receipt = await this.db.stockReceipt.create({
      data: {
        receiptNumber: await this.createReceiptNumber(),
        supplierId: dto.supplierId?.trim() || null,
        branchId: dto.branchId?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: 'DRAFT',
        receiptStatus: 'DRAFT',
        paymentStatus: 'UNPAID',
        totalAmount: roundCurrency(items.reduce((sum, item) => sum + item.totalPrice, 0)),
        items: {
          create: items,
        },
      } as any,
      include: SUPPLIER_RECEIPT_INCLUDE,
    })

    return { success: true, data: await this.attachPaymentTransactionVouchers(this.mapReceiptResponse(receipt)) }
  }

  async updateReceipt(id: string, dto: Partial<CreateReceiptDto>) {
    const receipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')

    const snapshot = this.buildReceiptSnapshot(receipt)
    if (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') {
      throw new BadRequestException('Không thể sửa phiếu đã hủy')
    }
    if (
      receipt.receiptStatus === 'FULL_RECEIVED' ||
      receipt.receiptStatus === 'SHORT_CLOSED' ||
      receipt.status === 'RECEIVED' ||
      !!receipt.completedAt
    ) {
      throw new BadRequestException('Chỉ được sửa phiếu chưa nhập hàng và chưa thanh toán')
    }

    const previousSupplierId = receipt.supplierId
    const updated = await this.db.$transaction(async (tx) => {
      if (dto.items) {
        if (!Array.isArray(dto.items) || dto.items.length === 0) {
          throw new BadRequestException('Phiếu nhập phải có ít nhất một mặt hàng')
        }

        const normalizedItems = dto.items.map((item) => ({
          receiptItemId: item.receiptItemId?.trim() || null,
          productId: item.productId,
          productVariantId: item.productVariantId?.trim() || null,
          quantity: toInt(item.quantity),
          unitPrice: toNumber(item.unitCost),
        }))
        const existingItems = receipt.items ?? []
        const existingItemMap = new Map(existingItems.map((item: any) => [item.id, item]))
        const matchedItemIds = new Set(
          normalizedItems.map((item) => item.receiptItemId).filter(Boolean) as string[],
        )

        for (const item of normalizedItems) {
          if (item.receiptItemId && !existingItemMap.has(item.receiptItemId)) {
            throw new BadRequestException('Dòng phiếu nhập không hợp lệ')
          }
        }

        for (const existingItem of existingItems) {
          const lockedQuantity = toInt(existingItem.receivedQuantity) + toInt(existingItem.closedQuantity)
          if (lockedQuantity <= 0) continue

          const matchedItem = normalizedItems.find((item) => item.receiptItemId === existingItem.id)
          if (!matchedItem) {
            throw new BadRequestException('Không thể xóa dòng hàng đã nhận kho')
          }
          if (
            matchedItem.productId !== existingItem.productId ||
            (matchedItem.productVariantId ?? null) !== (existingItem.productVariantId ?? null)
          ) {
            throw new BadRequestException('Không thể đổi loại sản phẩm cho dòng đã nhận kho')
          }
          if (matchedItem.quantity < lockedQuantity) {
            throw new BadRequestException('Số lượng không được nhỏ hơn số lượng đã nhận')
          }
        }

        const removableItemIds = existingItems
          .filter(
            (item: any) =>
              !matchedItemIds.has(item.id) &&
              toInt(item.receivedQuantity) + toInt(item.closedQuantity) <= 0,
          )
          .map((item: any) => item.id)

        if (removableItemIds.length > 0) {
          await tx.stockReceiptItem.deleteMany({
            where: {
              receiptId: id,
              id: { in: removableItemIds },
            },
          })
        }

        for (const item of normalizedItems) {
          const data = {
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: roundCurrency(item.quantity * item.unitPrice),
          } as any

          if (item.receiptItemId && existingItemMap.has(item.receiptItemId)) {
            await tx.stockReceiptItem.update({
              where: { id: item.receiptItemId },
              data,
            })
          } else {
            await tx.stockReceiptItem.create({
              data: {
                receiptId: id,
                ...data,
              } as any,
            })
          }
        }
      }

      await tx.stockReceipt.update({
        where: { id },
        data: {
          ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId?.trim() || null } : {}),
          ...(dto.branchId !== undefined ? { branchId: dto.branchId?.trim() || null } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        } as any,
      })

      const next = await this.recalculateReceiptState(tx, id)
      if (previousSupplierId && previousSupplierId !== dto.supplierId) {
        await this.recalculateSupplierBalance(tx, previousSupplierId)
      }
      await this.recalculateSupplierBalance(tx, next.receipt.supplierId)
      return next.receipt
    })

    return { success: true, data: await this.attachPaymentTransactionVouchers(this.mapReceiptResponse(updated)) }
  }

  async cancelReceipt(id: string) {
    const receipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')

    const snapshot = this.buildReceiptSnapshot(receipt)
    if (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') {
      return {
        success: true,
        data: await this.attachPaymentTransactionVouchers(this.mapReceiptResponse(receipt)),
        message: 'Phiếu đã ở trạng thái hủy',
      }
    }
    if (snapshot.receivedQty > 0) {
      throw new BadRequestException('Không thể hủy phiếu đã nhập hàng')
    }
    if (snapshot.paidAmount > 0) {
      throw new BadRequestException('Không thể hủy phiếu đã có thanh toán')
    }

    const updated = await this.db.stockReceipt.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        receiptStatus: 'CANCELLED',
        cancelledAt: new Date(),
      } as any,
      include: SUPPLIER_RECEIPT_INCLUDE,
    })

    await this.recalculateSupplierBalance(this.db, updated.supplierId)
    return { success: true, data: await this.attachPaymentTransactionVouchers(this.mapReceiptResponse(updated)) }
  }

  async createSupplierPayment(
    supplierId: string,
    staffId: string,
    dto: PayReceiptDto,
    preferredReceiptId?: string | null,
  ) {
    const supplier = await this.db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) throw new NotFoundException('Không tìm thấy nhà cung cấp')

    const amount = toNumber(dto.amount)
    if (amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0')
    }

    const paidAt = parseDateInput(dto.paidAt)
    const receipt = preferredReceiptId
      ? await this.db.stockReceipt.findUnique({ where: { id: preferredReceiptId } })
      : null

    const payment = await this.db.$transaction(async (tx) => {
      const created = await tx.supplierPayment.create({
        data: {
          paymentNumber: this.createNumber('SP'),
          supplierId,
          branchId: dto.branchId?.trim() || receipt?.branchId || null,
          staffId,
          amount: roundCurrency(amount),
          appliedAmount: 0,
          unappliedAmount: roundCurrency(amount),
          paymentMethod: dto.paymentMethod?.trim() || 'BANK',
          notes: dto.notes?.trim() || null,
          paidAt,
          targetReceiptId: preferredReceiptId ?? null,
          targetReceiptNumber: receipt?.receiptNumber ?? null,
        } as any,
      })

      const transaction = await this.createFinanceTransaction(tx, {
        type: 'EXPENSE',
        amount,
        branchId: created.branchId,
        paymentMethod: created.paymentMethod,
        description: preferredReceiptId
          ? `Thanh toán phiếu nhập ${receipt?.receiptNumber ?? preferredReceiptId}`
          : `Thanh toán NCC ${supplier.name}`,
        refType: preferredReceiptId ? 'STOCK_RECEIPT' : 'MANUAL',
        refId: preferredReceiptId ?? supplierId,
        refNumber: receipt?.receiptNumber ?? created.paymentNumber,
        payerId: supplier.id,
        payerName: supplier.name,
        notes: created.notes,
        source: 'STOCK_RECEIPT',
        staffId,
        date: paidAt,
      })

      const allocationResult = await this.allocatePaymentToReceipts(
        tx,
        created.id,
        supplierId,
        amount,
        dto.allocations,
        preferredReceiptId,
      )

      const updatedPayment = await tx.supplierPayment.update({
        where: { id: created.id },
        data: {
          transactionId: transaction?.id ?? null,
          appliedAmount: allocationResult.appliedAmount,
          unappliedAmount: allocationResult.unappliedAmount,
        } as any,
      })

      const touchedReceiptIds = new Set((dto.allocations ?? []).map((item) => item.receiptId))
      if (preferredReceiptId) touchedReceiptIds.add(preferredReceiptId)
      for (const receiptId of touchedReceiptIds) {
        await this.recalculateReceiptState(tx, receiptId)
      }
      await this.recalculateSupplierBalance(tx, supplierId)

      return updatedPayment
    })

    return { success: true, data: payment }
  }

  async payReceipt(id: string, staffId: string, dto: PayReceiptDto = {}) {
    const receipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    if (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') {
      throw new BadRequestException('Không thể thanh toán phiếu đã hủy')
    }

    const snapshot = this.buildReceiptSnapshot(receipt)
    const amount = toNumber(dto.amount || snapshot.outstandingAmount)
    if (amount <= 0) {
      const summarizedReceipt = await this.attachReceiptPaymentSummary(
        this.mapReceiptResponse(receipt),
      )
      return {
        success: true,
        message: 'Phiếu nhập đã được thanh toán đủ',
        data: await this.attachPaymentTransactionVouchers(summarizedReceipt),
      }
    }

    if (!receipt.supplierId) {
      const paidAt = parseDateInput(dto.paidAt)
      const updated = await this.db.$transaction(async (tx) => {
        await this.createFinanceTransaction(tx, {
          type: 'EXPENSE',
          amount,
          branchId: receipt.branchId,
          paymentMethod: dto.paymentMethod?.trim() || 'BANK',
          description: `Thanh toán phiếu nhập ${receipt.receiptNumber}`,
          refType: 'STOCK_RECEIPT',
          refId: receipt.id,
          refNumber: receipt.receiptNumber,
          payerName: receipt.supplier?.name ?? 'Nhà cung cấp',
          notes: dto.notes?.trim() || receipt.notes || null,
          source: 'STOCK_RECEIPT',
          staffId,
          date: paidAt,
        })

        await tx.stockReceipt.update({
          where: { id },
          data: {
            paidAmount: { increment: amount },
          } as any,
        })

        return this.recalculateReceiptState(tx, id)
      })

      const summarizedReceipt = await this.attachReceiptPaymentSummary(
        this.mapReceiptResponse(updated.receipt),
      )
      return {
        success: true,
        data: await this.attachPaymentTransactionVouchers(summarizedReceipt),
      }
    }

    await this.createSupplierPayment(receipt.supplierId, staffId, { ...dto, amount }, id)
    const updatedReceipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!updatedReceipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    const summarizedReceipt = await this.attachReceiptPaymentSummary(
      this.mapReceiptResponse(updatedReceipt),
    )
    return {
      success: true,
      data: await this.attachPaymentTransactionVouchers(summarizedReceipt),
    }
  }

  async receiveReceipt(id: string, dto: ReceiveReceiptDto = {}, staffId?: string) {
    const receipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    if (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') {
      throw new BadRequestException('Không thể nhập hàng cho phiếu đã hủy')
    }

    const receiptItemMap = new Map<string, any>(receipt.items.map((item: any) => [item.id, item]))
    const requestedReceiveItems: ReceiveReceiptItemDto[] =
      dto.items?.length
        ? dto.items
        : receipt.items.map((item: any) => ({
          receiptItemId: item.id,
          productId: item.productId,
          productVariantId: item.productVariantId ?? null,
          quantity: Math.max(0, toInt(item.quantity) - toInt(item.receivedQuantity) - toInt(item.closedQuantity)),
        }))

    const receiveItems = requestedReceiveItems
      .map((item) => {
        const matched =
          (item.receiptItemId ? receiptItemMap.get(item.receiptItemId) : null) ??
          receipt.items.find(
            (receiptItem: any) =>
              receiptItem.productId === item.productId &&
              (receiptItem.productVariantId ?? null) === (item.productVariantId ?? null),
          )
        if (!matched) {
          throw new NotFoundException('Không tìm thấy dòng sản phẩm cần nhập')
        }

        const remainingQuantity = Math.max(0, toInt(matched.quantity) - toInt(matched.receivedQuantity) - toInt(matched.closedQuantity))
        const quantity = toInt(item.quantity)
        if (quantity <= 0) return null
        if (quantity > remainingQuantity) {
          throw new BadRequestException(`Số lượng nhập vượt số lượng còn lại của ${matched.product?.name ?? matched.productId}`)
        }

        return {
          receiptItem: matched,
          quantity,
        }
      })
      .filter(Boolean) as Array<{ receiptItem: any; quantity: number }>

    if (receiveItems.length === 0) {
      throw new BadRequestException('Không còn số lượng nào để nhập kho')
    }

    const receivedAt = parseDateInput(dto.receivedAt)
    const updated = await this.db.$transaction(async (tx) => {
      const receive = await tx.stockReceiptReceive.create({
        data: {
          receiveNumber: this.createNumber('GR'),
          receiptId: id,
          branchId: dto.branchId?.trim() || receipt.branchId || null,
          staffId: staffId ?? null,
          notes: dto.notes?.trim() || null,
          receivedAt,
          totalQuantity: receiveItems.reduce((sum, item) => sum + item.quantity, 0),
          totalAmount: roundCurrency(
            receiveItems.reduce((sum, item) => sum + item.quantity * toNumber(item.receiptItem.unitPrice), 0),
          ),
          items: {
            create: receiveItems.map(({ receiptItem, quantity }) => ({
              receiptItemId: receiptItem.id,
              productId: receiptItem.productId,
              productVariantId: receiptItem.productVariantId ?? null,
              quantity,
              unitPrice: toNumber(receiptItem.unitPrice),
              totalPrice: roundCurrency(quantity * toNumber(receiptItem.unitPrice)),
            })),
          },
        } as any,
      })

      for (const { receiptItem, quantity } of receiveItems) {
        await tx.stockReceiptItem.update({
          where: { id: receiptItem.id },
          data: {
            receivedQuantity: { increment: quantity },
          } as any,
        })
        await this.adjustBranchStock(tx, {
          branchId: receive.branchId,
          productId: receiptItem.productId,
          productVariantId: receiptItem.productVariantId ?? null,
          quantityDelta: quantity,
          reason: `Nhập hàng ${receipt.receiptNumber}`,
          referenceId: receipt.receiptNumber,
          referenceType: 'STOCK_RECEIPT',
          staffId: staffId ?? null,
        })
      }

      let next = await this.recalculateReceiptState(tx, id)
      if (receipt.supplierId) {
        await this.applySupplierPaymentCreditsToReceipt(tx, id, receipt.supplierId)
        next = await this.recalculateReceiptState(tx, id)
        await this.recalculateSupplierBalance(tx, receipt.supplierId)
      }
      return next.receipt
    })

    return { success: true, data: await this.attachPaymentTransactionVouchers(this.mapReceiptResponse(updated)) }
  }

  async shortCloseReceipt(id: string, dto: CloseReceiptDto) {
    const receipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    if (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') {
      throw new BadRequestException('Không thể chốt thiếu phiếu đã hủy')
    }
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Cần chọn ít nhất một dòng để chốt thiếu')
    }

    const itemMap = new Map(receipt.items.map((item: any) => [item.id, item]))

    const updated = await this.db.$transaction(async (tx) => {
      for (const item of dto.items) {
        const matched =
          (item.receiptItemId ? itemMap.get(item.receiptItemId) : null) ??
          receipt.items.find(
            (receiptItem: any) =>
              receiptItem.productId === item.productId &&
              (receiptItem.productVariantId ?? null) === (item.productVariantId ?? null),
          )
        if (!matched) {
          throw new NotFoundException('Không tìm thấy dòng phiếu nhập để chốt thiếu')
        }

        const remainingQuantity = Math.max(0, toInt(matched.quantity) - toInt(matched.receivedQuantity) - toInt(matched.closedQuantity))
        const closeQuantity = toInt(item.quantity)
        if (closeQuantity <= 0 || closeQuantity > remainingQuantity) {
          throw new BadRequestException('Số lượng chốt thiếu không hợp lệ')
        }

        await tx.stockReceiptItem.update({
          where: { id: matched.id },
          data: {
            closedQuantity: { increment: closeQuantity },
          } as any,
        })
      }

      await tx.stockReceipt.update({
        where: { id },
        data: {
          notes: dto.notes?.trim() || receipt.notes || null,
          shortClosedAt: parseDateInput(dto.closedAt),
        } as any,
      })

      const next = await this.recalculateReceiptState(tx, id)
      await this.recalculateSupplierBalance(tx, next.receipt.supplierId)
      return next.receipt
    })

    return { success: true, data: await this.attachPaymentTransactionVouchers(this.mapReceiptResponse(updated)) }
  }

  async returnReceipt(id: string, body: CreateReturnReceiptDto | ReturnItemDto[], staffId?: string) {
    const items = Array.isArray(body) ? body : body.items
    const notes = Array.isArray(body) ? null : body.notes
    const returnedAt = Array.isArray(body) ? new Date() : parseDateInput(body.returnedAt)

    const receipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: SUPPLIER_RECEIPT_INCLUDE,
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    if (!receipt.supplierId) throw new BadRequestException('Phiếu nhập chưa gắn nhà cung cấp để trả hàng')
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Phiếu trả hàng phải có ít nhất một dòng')
    }

    const beforeSnapshot = this.buildReceiptSnapshot(receipt)

    const normalizedItems = items.map((item) => {
      const matched =
        (item.receiptItemId ? receipt.items.find((receiptItem: any) => receiptItem.id === item.receiptItemId) : null) ??
        receipt.items.find(
          (receiptItem: any) =>
            receiptItem.productId === item.productId &&
            (receiptItem.productVariantId ?? null) === (item.productVariantId ?? null),
        )
      if (!matched) {
        throw new NotFoundException('Không tìm thấy dòng phiếu nhập để trả hàng')
      }

      const availableToReturn = Math.max(0, toInt(matched.receivedQuantity) - toInt(matched.returnedQuantity))
      const quantity = toInt(item.quantity)
      if (quantity <= 0 || quantity > availableToReturn) {
        throw new BadRequestException('Số lượng trả hàng vượt quá số đã nhập')
      }

      return {
        receiptItem: matched,
        quantity,
        unitPrice: item.unitPrice != null ? toNumber(item.unitPrice) : toNumber(matched.unitPrice),
        reason: item.reason?.trim() || null,
      }
    })

    const updated = await this.db.$transaction(async (tx) => {
      const supplierReturn = await tx.supplierReturn.create({
        data: {
          returnNumber: this.createNumber('RT'),
          receiptId: receipt.id,
          supplierId: receipt.supplierId,
          branchId: receipt.branchId,
          staffId: staffId ?? null,
          status: 'COMPLETED',
          notes: notes?.trim() || null,
          returnedAt,
          totalAmount: roundCurrency(normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)),
          items: {
            create: normalizedItems.map((item) => ({
              receiptItemId: item.receiptItem.id,
              productId: item.receiptItem.productId,
              productVariantId: item.receiptItem.productVariantId ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: roundCurrency(item.quantity * item.unitPrice),
              reason: item.reason,
            })),
          },
        } as any,
      })

      for (const item of normalizedItems) {
        await tx.stockReceiptItem.update({
          where: { id: item.receiptItem.id },
          data: {
            returnedQuantity: { increment: item.quantity },
          } as any,
        })
        await this.adjustBranchStock(tx, {
          branchId: receipt.branchId,
          productId: item.receiptItem.productId,
          productVariantId: item.receiptItem.productVariantId ?? null,
          quantityDelta: -item.quantity,
          reason: `Trả NCC ${receipt.receiptNumber}`,
          referenceId: supplierReturn.id,
          referenceType: 'SUPPLIER_RETURN',
          staffId: staffId ?? null,
        })
      }

      const next = await this.recalculateReceiptState(tx, id)
      const afterSnapshot = this.buildReceiptSnapshot(next.receipt)
      const newCredit = Math.max(0, roundCurrency(afterSnapshot.overpaidAmount - beforeSnapshot.overpaidAmount))

      await tx.supplierReturn.update({
        where: { id: supplierReturn.id },
        data: {
          creditedAmount: newCredit,
        } as any,
      })
      await this.recalculateSupplierBalance(tx, receipt.supplierId)

      return tx.stockReceipt.findUnique({
        where: { id },
        include: SUPPLIER_RECEIPT_INCLUDE,
      })
    })

    return { success: true, data: await this.attachPaymentTransactionVouchers(this.mapReceiptResponse(updated)) }
  }

  async refundSupplierReturn(returnId: string, staffId: string, dto: RefundSupplierReturnDto): Promise<any> {
    const supplierReturn = await this.db.supplierReturn.findUnique({
      where: { id: returnId },
      include: {
        supplier: true,
        receipt: true,
        refunds: {
          include: {
            staff: { select: { id: true, fullName: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })
    if (!supplierReturn) throw new NotFoundException('Không tìm thấy phiếu trả hàng NCC')

    const amount = toNumber(dto.amount)
    if (amount <= 0) throw new BadRequestException('Số tiền hoàn từ NCC phải lớn hơn 0')

    const refundableAmount = roundCurrency(Math.max(0, toNumber(supplierReturn.creditedAmount) - toNumber(supplierReturn.refundedAmount)))
    if (amount > refundableAmount) {
      throw new BadRequestException('Số tiền phiếu thu vượt quá công nợ hoàn còn lại từ NCC')
    }

    const receivedAt = parseDateInput(dto.receivedAt)
    const refund = await this.db.$transaction(async (tx) => {
      const created = await tx.supplierReturnRefund.create({
        data: {
          refundNumber: this.createNumber('SR'),
          supplierReturnId: returnId,
          branchId: dto.branchId?.trim() || supplierReturn.branchId || null,
          staffId,
          amount: roundCurrency(amount),
          paymentMethod: dto.paymentMethod?.trim() || 'BANK',
          notes: dto.notes?.trim() || null,
          receivedAt,
        } as any,
      })

      const transaction = await this.createFinanceTransaction(tx, {
        type: 'INCOME',
        amount,
        branchId: created.branchId,
        paymentMethod: created.paymentMethod,
        description: `NCC hoàn tiền phiếu trả ${supplierReturn.returnNumber}`,
        refType: 'SUPPLIER_RETURN',
        refId: supplierReturn.id,
        refNumber: supplierReturn.returnNumber,
        payerId: supplierReturn.supplierId,
        payerName: supplierReturn.supplier?.name ?? 'Nhà cung cấp',
        notes: created.notes,
        source: 'SUPPLIER_RETURN',
        staffId,
        date: receivedAt,
      })

      await tx.supplierReturnRefund.update({
        where: { id: created.id },
        data: { transactionId: transaction?.id ?? null } as any,
      })
      await tx.supplierReturn.update({
        where: { id: supplierReturn.id },
        data: {
          refundedAmount: { increment: amount },
        } as any,
      })
      await this.recalculateSupplierBalance(tx, supplierReturn.supplierId)

      return tx.supplierReturn.findUnique({
        where: { id: supplierReturn.id },
        include: {
          supplier: true,
          receipt: true,
          refunds: {
            include: {
              staff: { select: { id: true, fullName: true } },
              branch: { select: { id: true, name: true, code: true } },
            },
          },
        },
      })
    })

    return { success: true, data: await this.attachSupplierReturnRefundTransactionVouchers(refund) }
  }

  private getInventorySourceRows(entity: { branchStocks?: any[] } | null | undefined, branchId?: string | null) {
    const sourceRows = Array.isArray(entity?.branchStocks) ? entity.branchStocks : []
    return branchId ? sourceRows.filter((row: any) => row.branchId === branchId) : sourceRows
  }

  private getDisplayInventorySourceRows(product: any, variant?: any | null, branchId?: string | null): any[] {
    const variants = Array.isArray(product?.variants)
      ? product.variants.filter((item: any) => !item?.deletedAt)
      : []
    const productRows = this.getInventorySourceRows(
      {
        branchStocks: Array.isArray(product?.branchStocks)
          ? product.branchStocks.filter((row: any) => !row?.productVariantId)
          : [],
      },
      branchId,
    )

    if (variant) {
      const directRows = this.getInventorySourceRows(variant, branchId)
      if (isConversionVariant(variant)) {
        return directRows
      }

      const convertedRows = getConversionVariants(
        variants,
        findParentTrueVariant(variants, variant, product.name) ?? variant,
        product.name,
      )
        .flatMap((conversionVariant: any) =>
          scaleBranchStocks(
            this.getInventorySourceRows(conversionVariant, branchId),
            parseConversionRate(conversionVariant?.conversions) ?? 1,
          ),
        )

      return aggregateBranchStocks([...directRows, ...convertedRows])
    }

    const trueVariants = getTrueVariants(variants)
    if (trueVariants.length > 0) {
      return aggregateBranchStocks(
        trueVariants.flatMap((trueVariant: any) =>
          this.getDisplayInventorySourceRows(product, trueVariant, branchId),
        ),
      )
    }

    const convertedRows = getConversionVariants(variants, null, product.name).flatMap((conversionVariant: any) =>
      scaleBranchStocks(
        this.getInventorySourceRows(conversionVariant, branchId),
        parseConversionRate(conversionVariant?.conversions) ?? 1,
      ),
    )

    return aggregateBranchStocks([...productRows, ...convertedRows])
  }

  private buildInventoryStatus(currentStock: number, minStock: number) {
    if (currentStock <= 0) return 'OUT_OF_STOCK'
    if (currentStock <= minStock) return 'LOW_STOCK'
    return 'NORMAL'
  }

  private calculateSellThroughMetrics(
    receives: Array<{ receivedAt: Date; quantity: number }>,
    sales: Array<{ soldAt: Date; quantity: number }>,
    now: Date,
  ) {
    const sortedReceives = [...receives]
      .filter((row) => row.quantity > 0)
      .sort((left, right) => left.receivedAt.getTime() - right.receivedAt.getTime())
    const sortedSales = [...sales]
      .filter((row) => row.quantity > 0)
      .sort((left, right) => left.soldAt.getTime() - right.soldAt.getTime())

    const queue: Array<{ receivedAt: Date; quantity: number; remaining: number }> = []
    const completedBatches: Array<{ receivedAt: Date; soldOutAt: Date; quantity: number; monthlyRate: number }> = []
    let receiveIndex = 0

    for (const sale of sortedSales) {
      while (
        receiveIndex < sortedReceives.length &&
        sortedReceives[receiveIndex] &&
        sortedReceives[receiveIndex]!.receivedAt.getTime() <= sale.soldAt.getTime()
      ) {
        const batch = sortedReceives[receiveIndex]!
        queue.push({
          receivedAt: batch.receivedAt,
          quantity: batch.quantity,
          remaining: batch.quantity,
        })
        receiveIndex += 1
      }

      let remainingSale = sale.quantity
      while (remainingSale > 0 && queue.length > 0) {
        const currentBatch = queue[0]!
        const consumed = Math.min(currentBatch.remaining, remainingSale)
        currentBatch.remaining -= consumed
        remainingSale -= consumed

        if (currentBatch.remaining <= 0) {
          const startDate = new Date(
            currentBatch.receivedAt.getFullYear(),
            currentBatch.receivedAt.getMonth(),
            currentBatch.receivedAt.getDate(),
          )
          const endDate = new Date(sale.soldAt.getFullYear(), sale.soldAt.getMonth(), sale.soldAt.getDate())
          const elapsedDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_IN_MS) + 1)

          completedBatches.push({
            receivedAt: currentBatch.receivedAt,
            soldOutAt: sale.soldAt,
            quantity: currentBatch.quantity,
            monthlyRate: roundCurrency((currentBatch.quantity / elapsedDays) * 30),
          })
          queue.shift()
        }
      }
    }

    const lookbackMonths: Date[] = Array.from({ length: 6 }, (_, index) => shiftMonth(now, -(5 - index)))
    const oldestLookback = lookbackMonths[0]!
    const monthlyBatchMap = new Map<string, number[]>()

    for (const batch of completedBatches) {
      const key = monthBucket(batch.receivedAt)
      const values = monthlyBatchMap.get(key) ?? []
      values.push(batch.monthlyRate)
      monthlyBatchMap.set(key, values)
    }

    let lastKnownRate =
      [...completedBatches]
        .filter((batch) => batch.receivedAt.getTime() < oldestLookback.getTime())
        .sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime())[0]?.monthlyRate ?? null

    const sixMonthValues: number[] = []
    for (const monthStart of lookbackMonths) {
      const values = monthlyBatchMap.get(monthBucket(monthStart)) ?? []
      const monthRate =
        values.length > 0
          ? roundCurrency(values.reduce((sum, value) => sum + value, 0) / values.length)
          : lastKnownRate

      if (monthRate != null) {
        sixMonthValues.push(monthRate)
        lastKnownRate = monthRate
      }
    }

    const latestCompletedBatch = [...completedBatches].sort(
      (left, right) => right.soldOutAt.getTime() - left.soldOutAt.getTime(),
    )[0]

    return {
      monthlySellThrough:
        sixMonthValues.length > 0
          ? roundCurrency(sixMonthValues.reduce((sum, value) => sum + value, 0) / sixMonthValues.length)
          : latestCompletedBatch?.monthlyRate ?? null,
      analyticsWindowMonths: 6,
      completedBatchCount: completedBatches.length,
      lastSoldOutAt: latestCompletedBatch?.soldOutAt ?? null,
    }
  }

  private async buildSellThroughMap(
    inventoryItems: Array<{ productId: string; productVariantId?: string | null }>,
    branchId?: string | null,
  ) {
    const entityMap = new Map<string, { productId: string; productVariantId: string | null }>()
    for (const item of inventoryItems) {
      if (!item.productId) continue
      const productVariantId = item.productVariantId ?? null
      entityMap.set(buildInventoryEntityKey(item.productId, productVariantId), {
        productId: item.productId,
        productVariantId,
      })
    }

    const uniqueProductIds = [...new Set([...entityMap.values()].map((item) => item.productId).filter(Boolean))]
    const result = new Map<
      string,
      {
        monthlySellThrough: number | null
        analyticsWindowMonths: number
        completedBatchCount: number
        lastSoldOutAt: Date | null
      }
    >()

    if (entityMap.size === 0 || uniqueProductIds.length === 0) return result

    const now = new Date()
    const analyticsStart = shiftMonth(startOfMonth(now), -12)

    const [receiveItems, salesRows] = await Promise.all([
      this.db.stockReceiptReceiveItem.findMany({
        where: {
          productId: { in: uniqueProductIds },
          receive: {
            receivedAt: { gte: analyticsStart },
            ...(branchId ? { branchId } : {}),
          },
        },
        select: {
          productId: true,
          productVariantId: true,
          quantity: true,
          receive: {
            select: {
              receivedAt: true,
            },
          },
        },
        orderBy: { receive: { receivedAt: 'asc' } },
      } as any),
      this.db.productSalesDaily.findMany({
        where: {
          productId: { in: uniqueProductIds },
          date: { gte: analyticsStart },
          ...(branchId ? { branchId } : {}),
        },
        select: {
          productId: true,
          productVariantId: true,
          date: true,
          quantitySold: true,
        },
        orderBy: { date: 'asc' },
      } as any),
    ])

    const receivesByEntity = new Map<string, Array<{ receivedAt: Date; quantity: number }>>()
    for (const row of receiveItems) {
      const key = buildInventoryEntityKey(row.productId, (row as any).productVariantId ?? null)
      const values = receivesByEntity.get(key) ?? []
      values.push({
        receivedAt: new Date((row as any).receive.receivedAt),
        quantity: toInt(row.quantity),
      })
      receivesByEntity.set(key, values)
    }

    const salesByEntity = new Map<string, Array<{ soldAt: Date; quantity: number }>>()
    for (const row of salesRows) {
      const key = buildInventoryEntityKey(row.productId, (row as any).productVariantId ?? null)
      const values = salesByEntity.get(key) ?? []
      values.push({
        soldAt: new Date(row.date),
        quantity: toInt(row.quantitySold),
      })
      salesByEntity.set(key, values)
    }

    for (const [key] of entityMap.entries()) {
      result.set(
        key,
        this.calculateSellThroughMetrics(receivesByEntity.get(key) ?? [], salesByEntity.get(key) ?? [], now),
      )
    }

    return result
  }

  async findInventoryProducts(query: FindStockProductsDto) {
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.max(1, Number(query.limit) || 20)
    const branchId = query.branchId?.trim() || ''
    const filterType = query.filterType?.trim() || 'ALL'
    const searchTokens = tokenizeSearch(query.search)
    const where: any = { deletedAt: null }

    if (branchId) {
      where.OR = [
        { branchStocks: { some: { branchId } } },
        { variants: { some: { branchStocks: { some: { branchId } } } } },
      ]
    }

    const products = await this.db.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branchStocks: true,
        variants: {
          include: {
            branchStocks: true,
          },
        },
      },
    })

    const rawRows = products.flatMap((product: any) => {
      const variants = Array.isArray(product.variants)
        ? product.variants.filter((variant: any) => !variant?.deletedAt)
        : []

      if (variants.length > 0) {
        return variants
          .filter(
            (variant: any) => !branchId || this.getDisplayInventorySourceRows(product, variant, branchId).length > 0,
          )
          .map((variant: any) => {
            const { variantLabel, unitLabel, displayName } = resolveProductVariantLabels(product.name, variant)

            return {
              id: variant.id,
              productId: product.id,
              productVariantId: variant.id,
              inventoryItemType: 'VARIANT' as const,
              name: product.name,
              variantName: variantLabel ?? null,
              unitLabel: unitLabel ?? null,
              displayName: displayName || `${product.name} - ${variant?.sku ?? 'Phien ban'}`,
              sku: variant.sku || product.sku,
              image: variant.image || product.image,
              unit: product.unit,
              category: product.category,
              brand: product.brand,
              minStockFallback: toInt(product.minStock),
              source: variant,
              searchHaystack: buildInventoryEntitySearchHaystack(product, variant),
            }
          })
      }

      return [
        {
          id: product.id,
          productId: product.id,
          productVariantId: null,
          inventoryItemType: 'PRODUCT' as const,
          name: product.name,
          variantName: null,
          unitLabel: null,
          displayName: product.name,
          sku: product.sku,
          image: product.image,
          unit: product.unit,
          category: product.category,
          brand: product.brand,
          minStockFallback: toInt(product.minStock),
          source: {
            branchStocks: Array.isArray(product.branchStocks)
              ? product.branchStocks.filter((row: any) => !row?.productVariantId)
              : [],
          },
          searchHaystack: buildInventoryEntitySearchHaystack(product, null),
          lastCountShift: product.lastCountShift ?? null,
        },
      ]
    })

    const searchedRows =
      searchTokens.length > 0
        ? rawRows.filter((row) => searchTokens.some((token) => row.searchHaystack.includes(token)))
        : rawRows

    const sellThroughMap = await this.buildSellThroughMap(
      searchedRows.map((row) => ({
        productId: row.productId,
        productVariantId: row.productVariantId,
      })),
      branchId || undefined,
    )

    const mappedRows = searchedRows.map((row) => {
      const product = products.find((item: any) => item.id === row.productId)
      const variant =
        row.productVariantId && Array.isArray(product?.variants)
          ? product.variants.find((item: any) => item.id === row.productVariantId) ?? null
          : null
      const sourceRows = product
        ? this.getDisplayInventorySourceRows(product, variant, branchId || undefined)
        : this.getInventorySourceRows(row.source, branchId || undefined)
      const currentStock = sourceRows.reduce((sum: number, item: any) => sum + toInt(item.stock), 0)
      const reservedStock = sourceRows.reduce((sum: number, item: any) => sum + toInt(item.reservedStock), 0)
      const minStock =
        sourceRows.length > 0
          ? sourceRows.reduce((sum: number, item: any) => sum + toInt(item.minStock), 0)
          : row.minStockFallback
      const sellableStock = Math.max(0, currentStock - reservedStock)
      const analytics = sellThroughMap.get(buildInventoryEntityKey(row.productId, row.productVariantId))

      return {
        id: row.id,
        productId: row.productId,
        productVariantId: row.productVariantId,
        inventoryItemType: row.inventoryItemType,
        name: row.name,
        variantName: row.variantName,
        unitLabel: row.unitLabel,
        displayName: row.displayName,
        sku: row.sku,
        image: row.image,
        unit: row.unit,
        category: row.category,
        brand: row.brand,
        currentStock,
        reservedStock,
        sellableStock,
        minStock,
        status: this.buildInventoryStatus(currentStock, minStock),
        monthlySellThrough: analytics?.monthlySellThrough ?? null,
        analyticsWindowMonths: analytics?.analyticsWindowMonths ?? 6,
        completedBatchCount: analytics?.completedBatchCount ?? 0,
        lastSoldOutAt: analytics?.lastSoldOutAt ?? null,
        lastCountShift: row.lastCountShift ?? null,
      }
    })

    const filteredRows =
      filterType === 'LOW_STOCK'
        ? mappedRows.filter((row) => row.currentStock <= row.minStock)
        : mappedRows

    const sortBy = query.sortBy?.trim() || ''
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'
    const sortedRows =
      sortBy.length > 0
        ? [...filteredRows].sort((left, right) => {
          const factor = sortOrder === 'asc' ? 1 : -1

          switch (sortBy) {
            case 'code':
              return compareText(left.sku, right.sku) * factor
            case 'name':
              return compareText(left.displayName, right.displayName) * factor
            case 'minStock':
              return (left.minStock - right.minStock) * factor
            case 'stock':
              return (left.currentStock - right.currentStock) * factor
            case 'sellable':
              return (left.sellableStock - right.sellableStock) * factor
            case 'monthlySellThrough':
              return ((left.monthlySellThrough ?? -1) - (right.monthlySellThrough ?? -1)) * factor
            case 'status': {
              const rank = { OUT_OF_STOCK: 0, LOW_STOCK: 1, NORMAL: 2 }
              return ((rank[left.status as keyof typeof rank] ?? 99) - (rank[right.status as keyof typeof rank] ?? 99)) * factor
            }
            default:
              return 0
          }
        })
        : filteredRows

    const total = sortedRows.length
    const pagedRows = sortedRows.slice((page - 1) * limit, page * limit)

    return {
      success: true,
      data: pagedRows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  async getTransactionsByProduct(productId: string, productVariantId?: string | null, branchId?: string | null) {
    const product = await this.db.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm')

    const where: any = { productId }
    if (productVariantId?.trim()) {
      where.productVariantId = productVariantId.trim()
    }
    if (branchId?.trim()) {
      where.branchId = branchId.trim()
    }

    const transactions = await this.db.stockTransaction.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      } as any,
      orderBy: { createdAt: 'desc' },
      take: 300,
    })

    return { success: true, data: transactions }
  }

  async getLowStockSuggestions() {
    const rows = await this.db.branchStock.findMany({
      where: {
        stock: { lte: 5 },
      },
      include: {
        branch: true,
        product: true,
        variant: true,
      },
      orderBy: [{ stock: 'asc' }, { updatedAt: 'asc' }],
    })

    return {
      success: true,
      data: rows.map((row) => ({
        ...row,
        minStock: row.minStock ?? 5,
        shortage: Math.max(0, (row.minStock ?? 5) - toInt(row.stock)),
      })),
    }
  }

  private buildSupplierAnalytics(supplier: any) {
    const receipts = (supplier.stockReceipts ?? [])
      .map((receipt: any) => this.mapReceiptResponse(receipt))
      .filter((receipt: any) => receipt.status !== 'CANCELLED')
    const now = new Date()
    const last30Days = new Date(now)
    last30Days.setDate(last30Days.getDate() - 30)
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const totalOrders = receipts.length
    const totalSpent = roundCurrency(receipts.reduce((sum: number, receipt: any) => sum + toNumber(receipt.payableAmount), 0))
    const totalDebt = roundCurrency(receipts.reduce((sum: number, receipt: any) => sum + toNumber(receipt.debtAmount), 0))
    const lastReceipt = receipts[0] ?? null
    const recentReceipts = receipts
      .slice()
      .sort((left: any, right: any) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 8)
    const ordersLast30Days = receipts.filter((receipt: any) => new Date(receipt.createdAt) >= last30Days).length
    const spendLast30Days = roundCurrency(
      receipts
        .filter((receipt: any) => new Date(receipt.createdAt) >= last30Days)
        .reduce((sum: number, receipt: any) => sum + toNumber(receipt.payableAmount), 0),
    )

    const productMap = new Map<string, any>()
    for (const receipt of receipts) {
      for (const item of receipt.items ?? []) {
        const key = `${item.productId}:${item.productVariantId ?? 'base'}`
        const current = productMap.get(key)
        const rowDate = receipt.receivedAt ?? receipt.createdAt
        const quantity = Math.max(0, toInt(item.receivedQuantity) || toInt(item.quantity))
        if (!current) {
          const { variantLabel, unitLabel } = resolveProductVariantLabels(item.product?.name, item.productVariant)
          productMap.set(key, {
            key,
            productId: item.productId,
            productVariantId: item.productVariantId ?? null,
            sku: item.productVariant?.sku || item.product?.sku || null,
            name:
              buildProductVariantName(item.product?.name ?? 'San pham', variantLabel, unitLabel) ||
              item.product?.name ||
              'San pham',
            unit: item.product?.unit || 'cái',
            totalQty: quantity,
            lastUnitPrice: toNumber(item.unitPrice),
            lastOrderAt: rowDate,
            lastReceiptNumber: receipt.receiptNumber,
          })
          continue
        }

        current.totalQty += quantity
        if (new Date(rowDate).getTime() > new Date(current.lastOrderAt).getTime()) {
          current.lastOrderAt = rowDate
          current.lastUnitPrice = toNumber(item.unitPrice)
          current.lastReceiptNumber = receipt.receiptNumber
        }
      }
    }

    const products = [...productMap.values()].sort(
      (left, right) => new Date(right.lastOrderAt).getTime() - new Date(left.lastOrderAt).getTime(),
    )
    const uniqueProducts = products.length
    const currentMonthSpent = roundCurrency(
      receipts
        .filter((receipt: any) => {
          const receiptDate = new Date(receipt.receivedAt ?? receipt.createdAt)
          return receiptDate.getMonth() === currentMonth && receiptDate.getFullYear() === currentYear
        })
        .reduce((sum: number, receipt: any) => sum + toNumber(receipt.payableAmount), 0),
    )
    const currentYearSpent = roundCurrency(
      receipts
        .filter((receipt: any) => new Date(receipt.receivedAt ?? receipt.createdAt).getFullYear() === currentYear)
        .reduce((sum: number, receipt: any) => sum + toNumber(receipt.payableAmount), 0),
    )

    const frequencyScore = Math.min(100, ordersLast30Days * 18)
    const daysSinceLastOrder = lastReceipt ? Math.floor((now.getTime() - new Date(lastReceipt.createdAt).getTime()) / (24 * 60 * 60 * 1000)) : 999
    const recencyScore = daysSinceLastOrder <= 7 ? 100 : daysSinceLastOrder <= 30 ? 85 : daysSinceLastOrder <= 60 ? 65 : 35
    const debtRatio = totalSpent > 0 ? totalDebt / totalSpent : 0
    const debtScore = Math.max(0, 100 - Math.round(Math.min(1, debtRatio) * 100))
    const assortmentScore = Math.min(100, uniqueProducts * 16)
    const score = Math.round((frequencyScore + recencyScore + debtScore + assortmentScore) / 4)
    const label = score >= 85 ? 'Đối tác chiến lược' : score >= 70 ? 'Ổn định' : score >= 55 ? 'Cần theo dõi' : 'Rủi ro'
    const summary =
      score >= 85
        ? 'Nguồn cung ổn định, nên ưu tiên duy trì.'
        : score >= 70
          ? 'Quan hệ giao dịch tốt, theo dõi định kỳ.'
          : score >= 55
            ? 'Cần theo dõi thêm về công nợ và tần suất giao dịch.'
            : 'Biến động cao, cần rà soát điều kiện hợp tác.'

    return {
      stats: {
        totalOrders,
        totalSpent,
        totalDebt,
        uniqueProducts,
        lastOrderAt: lastReceipt?.createdAt ?? null,
        ordersLast30Days,
        spendLast30Days,
        avgOrderValue: totalOrders > 0 ? roundCurrency(totalSpent / totalOrders) : 0,
        monthTarget: supplier.monthTarget ?? null,
        yearTarget: supplier.yearTarget ?? null,
        currentMonthSpent,
        currentYearSpent,
        monthTargetProgress: supplier.monthTarget ? Math.min(100, Math.round((currentMonthSpent / supplier.monthTarget) * 100)) : 0,
        yearTargetProgress: supplier.yearTarget ? Math.min(100, Math.round((currentYearSpent / supplier.yearTarget) * 100)) : 0,
      },
      evaluation: {
        score,
        label,
        debtRatio,
        summary,
        factors: {
          frequencyScore,
          recencyScore,
          debtScore,
          assortmentScore,
        },
      },
      recentReceipts,
      products,
      recentPayments: (supplier.payments ?? []).slice(0, 8),
      recentReturns: (supplier.returns ?? []).slice(0, 8),
    }
  }

  async findAllSuppliers(): Promise<any> {
    const suppliers = await this.db.supplier.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        stockReceipts: {
          include: SUPPLIER_RECEIPT_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    const normalizedSuppliers = await Promise.all(
      suppliers.map((supplier) => this.backfillSupplierCode(supplier)),
    )

    const data = normalizedSuppliers.map((supplier) => ({
      ...supplier,
      ...this.buildSupplierAnalytics(supplier),
    }))

    const summary = {
      totalSuppliers: data.length,
      activeSuppliers: data.filter((supplier) => supplier.isActive !== false).length,
      suppliersWithDebt: data.filter((supplier) => toNumber(supplier.stats.totalDebt) > 0).length,
      totalDebt: roundCurrency(data.reduce((sum, supplier) => sum + toNumber(supplier.stats.totalDebt), 0)),
      spendLast30Days: roundCurrency(data.reduce((sum, supplier) => sum + toNumber(supplier.stats.spendLast30Days), 0)),
      avgEvaluationScore:
        data.length > 0 ? Math.round(data.reduce((sum, supplier) => sum + toNumber(supplier.evaluation.score), 0) / data.length) : 0,
    }

    return { success: true, data, summary }
  }

  async findSupplierById(id: string): Promise<any> {
    const supplier = await this.db.supplier.findUnique({
      where: { id },
      include: {
        stockReceipts: {
          include: SUPPLIER_RECEIPT_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 8,
        },
        returns: {
          include: {
            refunds: {
              orderBy: { receivedAt: 'desc' },
            },
          },
          orderBy: { returnedAt: 'desc' },
          take: 8,
        },
      },
    })
    if (!supplier) throw new NotFoundException('Không tìm thấy nhà cung cấp')

    const normalizedSupplier = await this.backfillSupplierCode(supplier)

    return {
      success: true,
      data: {
        ...normalizedSupplier,
        ...this.buildSupplierAnalytics(normalizedSupplier),
      },
    }
  }

  async createSupplier(dto: CreateSupplierDto): Promise<any> {
    if (!dto.name?.trim()) throw new BadRequestException('Tên nhà cung cấp là bắt buộc')

    const code = await this.ensureUniqueSupplierCode(dto.name, dto.code)

    const supplier = await this.db.supplier.create({
      data: {
        ...(this.sanitizeSupplierPayload(dto) as any),
        code,
      },
    })

    return { success: true, data: supplier }
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto): Promise<any> {
    const currentSupplier = await this.db.supplier.findUnique({
      where: { id },
      select: { id: true, name: true, code: true },
    })
    if (!currentSupplier) throw new NotFoundException('Không tìm thấy nhà cung cấp')

    const nextName = dto.name?.trim() || currentSupplier.name
    const shouldUpdateCode = dto.code !== undefined || (dto.name !== undefined && !currentSupplier.code)
    const nextCode = shouldUpdateCode
      ? await this.ensureUniqueSupplierCode(nextName, dto.code ?? currentSupplier.code ?? undefined, id)
      : undefined

    const updated = await this.db.supplier.update({
      where: { id },
      data: {
        ...(this.sanitizeSupplierPayload(dto) as any),
        ...(nextCode ? { code: nextCode } : {}),
      } as any,
    })

    return { success: true, data: updated }
  }
}
