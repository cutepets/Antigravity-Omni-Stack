// ─── Receipt Utils ─────────────────────────────────────────────────────────────
// Pure helper functions extracted from create-receipt-form.tsx.
// No React imports — safe to use in server components and tests.

import dayjs from 'dayjs'
import { buildProductVariantName, getProductVariantOptionLabel, suggestBranchCodeFromName } from '@petshop/shared'
import {
  findParentTrueVariant as resolveParentTrueVariant,
  getConversionVariants as resolveConversionVariants,
  getDisplayBranchStocks,
  getResolvedVariantLabels as resolveVariantLabels,
  getTrueVariants as resolveTrueVariants,
  isConversionVariant as isConversionVariantValue,
  sumBranchStockRows,
} from '@/lib/inventory-conversion-stock'
import type {
  BranchStock,
  ExtraCostRow,
  ProductVariantOption,
  ReceiptEditSession,
  ReceiptMetaPayload,
  SelectedItem,
  SupplierQuickDraftItem,
  SupplierQuickForm,
} from './receipt.types'
import { RECEIPT_META_MARKER } from './receipt.constants'

// ─── Formatters ───────────────────────────────────────────────────────────────

export function fmt(value: number) {
  return value.toLocaleString('vi-VN')
}

export function formatReceiptDateTime(value?: string | Date | null) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—'
}

export function getPaymentMethodLabel(value?: string | null) {
  switch (`${value ?? ''}`.trim().toUpperCase()) {
    case 'CASH':
      return 'Tiền mặt'
    case 'BANK':
      return 'Chuyển khoản'
    case 'CARD':
      return 'Thẻ'
    case 'MIXED':
      return 'Kết hợp'
    default:
      return value?.trim() || '—'
  }
}

// ─── Data extractors ──────────────────────────────────────────────────────────

export function getSuppliers(data: unknown): any[] {
  if (Array.isArray((data as any)?.data?.data)) return (data as any).data.data
  if (Array.isArray((data as any)?.data)) return (data as any).data
  if (Array.isArray(data)) return data
  return []
}

export function getProducts(data: unknown): any[] {
  if (Array.isArray((data as any)?.data?.data)) return (data as any).data.data
  if (Array.isArray((data as any)?.data)) return (data as any).data
  if (Array.isArray(data)) return data
  return []
}

export function getReceipts(data: unknown): any[] {
  if (Array.isArray((data as any)?.data?.data)) return (data as any).data.data
  if (Array.isArray((data as any)?.data)) return (data as any).data
  if (Array.isArray(data)) return data
  return []
}

export function getReceiptRedirectId(receipt: any, fallbackId?: string) {
  return receipt?.receiptNumber || receipt?.id || fallbackId || ''
}

// ─── Text / Search ────────────────────────────────────────────────────────────

export function normalizeText(value?: string | null) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim()
}

export function filterSuppliers(suppliers: any[], query: string) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return suppliers.slice(0, 12)
  return suppliers
    .filter((supplier) =>
      [supplier.code, supplier.name, supplier.phone, supplier.email, supplier.address]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(normalizedQuery)),
    )
    .slice(0, 12)
}

export function createSupplierDraft(query: string): SupplierQuickForm {
  const trimmed = query.trim()
  const isPhoneLike = /^[0-9+\-\s]+$/.test(trimmed) && trimmed.length >= 3
  return {
    code: isPhoneLike ? '' : suggestBranchCodeFromName(trimmed),
    name: isPhoneLike ? '' : trimmed,
    phone: isPhoneLike ? trimmed.replace(/[^0-9]/g, '') : '',
    email: '',
    address: '',
    notes: '',
  }
}

export function findExactProductMatch(products: any[], rawQuery: string) {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return null

  for (const product of products) {
    const rootMatched = [product.name, product.sku, product.barcode]
      .filter(Boolean)
      .some((value: any) => `${value}`.trim().toLowerCase() === q)

    if (rootMatched) {
      return { product, productVariantId: null as string | null }
    }

    if (Array.isArray(product.variants)) {
      const matchedVariant = product.variants.find((variant: any) =>
        [variant?.name, variant?.sku, variant?.barcode]
          .filter(Boolean)
          .some((value: any) => `${value}`.trim().toLowerCase() === q),
      )

      if (matchedVariant) {
        return { product, productVariantId: matchedVariant.id as string }
      }
    }
  }

  return null
}

// ─── ID Helpers ───────────────────────────────────────────────────────────────

export function createLineId() {
  return `receipt-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getItemIdentity(productId: string, productVariantId?: string | null) {
  return `${productId}:${productVariantId ?? 'base'}`
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

export function safeParseJson(value?: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

// ─── Variant helpers ──────────────────────────────────────────────────────────

export function isConversionVariant(variant?: ProductVariantOption | null) {
  return isConversionVariantValue(variant)
}

export function getTrueVariants(variants?: ProductVariantOption[]) {
  return resolveTrueVariants(variants)
}

export function getVariantShortLabel(name?: string | null, productName?: string | null) {
  return getProductVariantOptionLabel(productName ?? null, { name })
}

function getNormalizedVariantLabels(
  productName?: string | null,
  variant?: ProductVariantOption | null,
) {
  const resolved = resolveVariantLabels(productName, variant)
  const normalizedProductName = normalizeText(productName)
  const normalizedVariantLabel = normalizeText(resolved.variantLabel)

  return {
    variantLabel:
      normalizedVariantLabel && normalizedVariantLabel !== normalizedProductName
        ? resolved.variantLabel ?? null
        : null,
    unitLabel: resolved.unitLabel ?? null,
  }
}

function normalizeProductVariantOption(
  productName: string | null | undefined,
  variant: ProductVariantOption,
): ProductVariantOption {
  const labels = getNormalizedVariantLabels(productName, variant)

  return {
    ...variant,
    variantLabel: labels.variantLabel,
    unitLabel: labels.unitLabel,
    children: Array.isArray(variant.children)
      ? variant.children.map((child) => normalizeProductVariantOption(productName, child))
      : undefined,
  }
}

function normalizeProductVariantOptions(
  productName: string | null | undefined,
  variants?: ProductVariantOption[] | null,
) {
  return Array.isArray(variants)
    ? variants.map((variant) => normalizeProductVariantOption(productName, variant))
    : []
}

export function getConversionUnitLabel(
  variant?: ProductVariantOption | null,
  productName?: string | null,
  parentTrueVariant?: ProductVariantOption | null,
) {
  const resolved = getNormalizedVariantLabels(productName, variant)
  if (resolved.unitLabel) return resolved.unitLabel

  const fallbackLabel = getVariantShortLabel(variant?.name, productName)
  const parentLabels = getNormalizedVariantLabels(productName, parentTrueVariant)
  const parentVariantLabel = parentLabels.variantLabel?.trim()

  if (!parentVariantLabel) return fallbackLabel
  const prefix = `${parentVariantLabel} - `

  return fallbackLabel.startsWith(prefix)
    ? fallbackLabel.slice(prefix.length).trim()
    : fallbackLabel
}

export function findParentTrueVariant(
  variants: ProductVariantOption[],
  selectedVariant?: ProductVariantOption | null,
  productName?: string | null,
) {
  return resolveParentTrueVariant(variants, selectedVariant, productName)
}

export function getConversionVariants(
  variants: ProductVariantOption[],
  currentTrueVariant?: ProductVariantOption | null,
  productName?: string | null,
) {
  return resolveConversionVariants(variants, currentTrueVariant, productName)
}

// ─── Stock ─────────────────────────────────────────────────────────────────────

export function sumBranchStock(branchStocks?: BranchStock[]) {
  return sumBranchStockRows(branchStocks, 'stock')
}

export function getVariantSnapshot(item: SelectedItem) {
  const variants = item.variants ?? []
  const selectedVariant =
    variants.find((variant) => variant.id === item.productVariantId) ?? null
  const selectedLabels = selectedVariant ? getNormalizedVariantLabels(item.name, selectedVariant) : null
  const stockSource =
    selectedVariant && isConversionVariant(selectedVariant)
      ? findParentTrueVariant(variants, selectedVariant, item.name) ?? selectedVariant
      : selectedVariant
  const branchStocks = getDisplayBranchStocks(
    {
      name: item.name,
      branchStocks: item.baseBranchStocks ?? item.branchStocks ?? [],
      variants,
    },
    stockSource?.id ?? item.productVariantId ?? null,
  ) as BranchStock[]

  const totalStock =
    branchStocks.length > 0
      ? sumBranchStock(branchStocks)
      : stockSource
        ? stockSource.stock !== undefined && stockSource.stock !== null
          ? Number(stockSource.stock)
          : 0
        : item.baseTotalStock ?? item.totalStock ?? 0
  const totalAvailableStock =
    stockSource?.availableStock !== undefined && stockSource.availableStock !== null
      ? Number(stockSource.availableStock)
      : branchStocks.length > 0
        ? branchStocks.reduce((sum, row) => {
          const available =
            row.availableStock !== undefined && row.availableStock !== null
              ? Number(row.availableStock)
              : Number(row.stock ?? 0) - Number(row.reservedStock ?? (row as any).reserved ?? 0)
          return sum + available
        }, 0)
        : totalStock - Number((stockSource as any)?.trading ?? (stockSource as any)?.reserved ?? 0)
  const totalTradingStock =
    (stockSource as any)?.trading !== undefined && (stockSource as any)?.trading !== null
      ? Number((stockSource as any).trading)
      : null

  return {
    selectedVariant,
    stockSource,
    branchStocks,
    totalStock,
    totalAvailableStock,
    totalTradingStock,
    displayName: selectedLabels
      ? buildProductVariantName(item.name, selectedLabels.variantLabel, null) || item.name
      : item.name,
    displaySku: selectedVariant?.sku ?? item.sku ?? item.baseSku ?? null,
    displayBarcode: selectedVariant?.barcode ?? item.barcode ?? item.baseBarcode ?? null,
  }
}

export function applyVariantSelection(item: SelectedItem, variantId: string): SelectedItem {
  if (!variantId || variantId === 'base') {
    return {
      ...item,
      productVariantId: null,
      variantName: null,
      variantLabel: null,
      unitLabel: null,
      sku: item.baseSku ?? item.sku,
      barcode: item.baseBarcode ?? item.barcode,
      unitCost: item.baseUnitCost ?? item.unitCost,
      totalStock: item.baseTotalStock ?? item.totalStock,
      branchStocks: item.baseBranchStocks ?? item.branchStocks,
    }
  }

  let selectedVariant: any = item.variants?.find((variant) => variant.id === variantId)
  if (!selectedVariant) {
    for (const v of (item.variants || [])) {
      if ((v as any).children) {
        const child = (v as any).children.find((ch: any) => ch.id === variantId)
        if (child) {
          selectedVariant = child
          break
        }
      }
    }
  }

  if (!selectedVariant) return item

  const selectedLabels = getNormalizedVariantLabels(item.name, selectedVariant)
  const branchStocks = Array.isArray(selectedVariant.branchStocks)
    ? selectedVariant.branchStocks
    : []

  return {
    ...item,
    productVariantId: selectedVariant.id,
    variantName: selectedLabels.variantLabel,
    variantLabel: selectedLabels.variantLabel,
    unitLabel: selectedLabels.unitLabel,
    sku: selectedVariant.sku ?? item.baseSku ?? item.sku,
    barcode: selectedVariant.barcode ?? item.baseBarcode ?? item.barcode,
    unitCost: Number(selectedVariant.costPrice ?? item.baseUnitCost ?? item.unitCost),
    totalStock:
      selectedVariant.stock !== undefined && selectedVariant.stock !== null
        ? Number(selectedVariant.stock)
        : sumBranchStock(branchStocks),
    branchStocks,
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

export function normalizeProduct(product: any): SelectedItem {
  const variants = normalizeProductVariantOptions(product.name, product.variants)
  const defaultVariant = getTrueVariants(variants)[0] ?? variants[0] ?? null
  const defaultBranchStocks = getDisplayBranchStocks(product, defaultVariant?.id ?? null) as BranchStock[]
  const baseDisplayBranchStocks = getDisplayBranchStocks(product) as BranchStock[]

  const defaultLabels = defaultVariant ? getNormalizedVariantLabels(product.name, defaultVariant) : null
  return {
    lineId: createLineId(),
    productId: product.id,
    productVariantId: defaultVariant?.id ?? null,
    barcode: defaultVariant?.barcode ?? product.barcode ?? null,
    sku: defaultVariant?.sku ?? product.sku ?? null,
    name: product.name,
    image: product.image ?? null,
    unit: product.unit ?? null,
    sellingPrice: Number(
      defaultVariant?.sellingPrice ?? defaultVariant?.price ?? product.price ?? product.salePrice ?? 0,
    ),
    quantity: 1,
    unitCost: Number(defaultVariant?.costPrice ?? product.costPrice ?? 0),
    discount: 0,
    note: '',
    monthlySellThrough:
      defaultVariant?.monthlySellThrough ?? product.monthlySellThrough ?? null,
    totalStock:
      defaultBranchStocks.length > 0
        ? sumBranchStock(defaultBranchStocks)
        : defaultVariant?.stock !== undefined && defaultVariant?.stock !== null
          ? Number(defaultVariant.stock)
          : product.stock !== undefined
            ? Number(product.stock)
            : 0,
    branchStocks: defaultBranchStocks,
    variants,
    variantName: defaultLabels?.variantLabel ?? null,
    variantLabel: defaultLabels?.variantLabel ?? null,
    unitLabel: defaultLabels?.unitLabel ?? null,
    baseSku: product.sku ?? null,
    baseBarcode: product.barcode ?? null,
    baseUnit: product.unit ?? null,
    baseUnitCost: Number(product.costPrice ?? 0),
    baseTotalStock:
      baseDisplayBranchStocks.length > 0
        ? sumBranchStock(baseDisplayBranchStocks)
        : product.stock !== undefined
          ? Number(product.stock)
          : null,
    baseMonthlySellThrough: product.monthlySellThrough ?? null,
    baseBranchStocks: Array.isArray(product.branchStocks) ? product.branchStocks : [],
  }
}

export function normalizeSupplierQuickDraftItem(item: SupplierQuickDraftItem): SelectedItem {
  return {
    lineId: createLineId(),
    productId: item.productId,
    productVariantId: item.productVariantId ?? null,
    barcode: null,
    sku: item.sku ?? null,
    name: item.name,
    image: null,
    unit: item.unit ?? null,
    sellingPrice: Number(item.unitCost ?? 0),
    quantity: Math.max(1, Number(item.quantity ?? 1)),
    unitCost: Math.max(0, Number(item.unitCost ?? 0)),
    discount: 0,
    note: '',
    monthlySellThrough: null,
    totalStock: null,
    branchStocks: [],
    variants: [],
    variantName: null,
    variantLabel: null,
    unitLabel: null,
    baseSku: item.sku ?? null,
    baseBarcode: null,
    baseUnit: item.unit ?? null,
    baseUnitCost: Math.max(0, Number(item.unitCost ?? 0)),
    baseTotalStock: null,
    baseMonthlySellThrough: null,
    baseBranchStocks: [],
  }
}

export function normalizeReceiptItem(item: any): SelectedItem {
  const product = item?.product ?? {}
  const normalizedVariants = normalizeProductVariantOptions(
    product?.name,
    Array.isArray(product?.variants)
      ? product.variants
      : item?.productVariant
        ? [item.productVariant]
        : [],
  )
  const selectedVariant =
    normalizedVariants.find((variant) => variant.id === (item?.productVariantId ?? item?.productVariant?.id)) ??
    (item?.productVariant ? normalizeProductVariantOption(product?.name, item.productVariant) : null)
  const selectedLabels = selectedVariant ? getNormalizedVariantLabels(product?.name, selectedVariant) : null

  return {
    lineId: item?.id ?? createLineId(),
    receiptItemId: item?.id ?? null,
    productId: item?.productId ?? product?.id ?? '',
    productVariantId: item?.productVariantId ?? selectedVariant?.id ?? null,
    barcode: selectedVariant?.barcode ?? product?.barcode ?? null,
    sku: selectedVariant?.sku ?? product?.sku ?? null,
    name: product?.name ?? 'Sản phẩm',
    image: selectedVariant?.image ?? product?.image ?? null,
    unit: selectedVariant?.unit ?? product?.unit ?? null,
    sellingPrice: Number(
      selectedVariant?.sellingPrice ??
      selectedVariant?.price ??
      product?.price ??
      product?.salePrice ??
      0,
    ),
    quantity: Math.max(1, Number(item?.quantity ?? 1)),
    unitCost: Math.max(0, Number(item?.unitPrice ?? item?.unitCost ?? 0)),
    discount: 0,
    note: `${item?.notes ?? item?.note ?? ''}`.trim(),
    monthlySellThrough: null,
    totalStock: null,
    branchStocks: [],
    variants: normalizedVariants,
    variantName: selectedLabels?.variantLabel ?? null,
    variantLabel: selectedLabels?.variantLabel ?? null,
    unitLabel: selectedLabels?.unitLabel ?? null,
    baseSku: product?.sku ?? null,
    baseBarcode: product?.barcode ?? null,
    baseUnit: product?.unit ?? null,
    baseUnitCost: Number(product?.costPrice ?? item?.unitPrice ?? item?.unitCost ?? 0),
    baseTotalStock: null,
    baseMonthlySellThrough: null,
    baseBranchStocks: [],
    receivedQuantity: Math.max(0, Number(item?.receivedQuantity ?? 0)),
    returnedQuantity: Math.max(0, Number(item?.returnedQuantity ?? 0)),
    closedQuantity: Math.max(0, Number(item?.closedQuantity ?? 0)),
  }
}

// ─── Extra Costs ──────────────────────────────────────────────────────────────

export function createExtraCostRow(): ExtraCostRow {
  return {
    id: `extra-cost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    amount: 0,
  }
}

export function normalizeExtraCosts(rows: ExtraCostRow[]) {
  return rows
    .filter((r) => r.label.trim() || r.amount > 0)
    .map((r, i) => ({
      label: r.label.trim() || `Chi phí khác ${i + 1}`,
      amount: Math.max(0, Number.isFinite(r.amount) ? r.amount : 0),
    }))
    .filter((r) => r.amount > 0)
}

// ─── Notes / Meta ─────────────────────────────────────────────────────────────

export function buildReceiptNotes(
  note: string,
  adj: { discount: number; tax: number; extraCosts: ExtraCostRow[]; editSessions?: ReceiptEditSession[] },
) {
  const cleanNote = note.trim()
  const payload: ReceiptMetaPayload = {
    discount: Math.max(0, adj.discount),
    tax: Math.max(0, adj.tax),
    extraCosts: normalizeExtraCosts(adj.extraCosts),
    ...(adj.editSessions && adj.editSessions.length > 0 ? { editSessions: adj.editSessions } : {}),
  }
  const hasMeta =
    payload.discount > 0 ||
    payload.tax > 0 ||
    payload.extraCosts.length > 0 ||
    (payload.editSessions?.length ?? 0) > 0
  if (!hasMeta) return cleanNote || undefined
  return [cleanNote, RECEIPT_META_MARKER, JSON.stringify(payload)].filter(Boolean).join('\n\n')
}

export function parseReceiptNotes(value?: string | null) {
  const raw = `${value ?? ''}`
  if (!raw.includes(RECEIPT_META_MARKER)) {
    return {
      note: raw.trim(),
      discount: 0,
      tax: 0,
      extraCosts: [] as ExtraCostRow[],
      editSessions: [] as ReceiptEditSession[],
    }
  }

  const [notePart, metaPart] = raw.split(RECEIPT_META_MARKER)
  const parsed = safeParseJson(metaPart?.trim())
  const extraCosts = Array.isArray(parsed?.extraCosts)
    ? parsed.extraCosts.map((item: any, index: number) => ({
      id: `receipt-extra-cost-${index + 1}`,
      label: `${item?.label ?? ''}`.trim() || `Chi phí khác ${index + 1}`,
      amount: Math.max(0, Number(item?.amount ?? 0)),
    }))
    : []

  return {
    note: notePart.trim(),
    discount: Math.max(0, Number(parsed?.discount ?? 0)),
    tax: Math.max(0, Number(parsed?.tax ?? 0)),
    extraCosts,
    editSessions: Array.isArray(parsed?.editSessions)
      ? parsed.editSessions
        .filter((session: any) => session?.editedAt && session?.editedBy)
        .map((session: any, index: number) => ({
          id: `${session?.id ?? `edit-session-${index + 1}`}`,
          editedAt: `${session.editedAt}`,
          editedBy: `${session.editedBy}`,
          itemCount: Math.max(0, Number(session?.itemCount ?? 0)),
          totalQuantity: Math.max(0, Number(session?.totalQuantity ?? 0)),
        }))
      : [],
  }
}

// ─── Draft Signature ──────────────────────────────────────────────────────────

export function createReceiptDraftSignature(payload: {
  supplierId?: string
  branchId?: string
  notes?: string
  items: SelectedItem[]
  discount: number
  tax: number
  extraCosts: ExtraCostRow[]
}) {
  return JSON.stringify({
    supplierId: payload.supplierId ?? '',
    branchId: payload.branchId ?? '',
    notes: payload.notes?.trim() ?? '',
    items: payload.items.map((item) => ({
      productId: item.productId,
      productVariantId: item.productVariantId ?? null,
      quantity: Number(item.quantity ?? 0),
      unitCost: Number(item.unitCost ?? 0),
      discount: Number(item.discount ?? 0),
      note: item.note.trim(),
    })),
    discount: Math.max(0, Number(payload.discount ?? 0)),
    tax: Math.max(0, Number(payload.tax ?? 0)),
    extraCosts: normalizeExtraCosts(payload.extraCosts),
  })
}

// ─── Status View ──────────────────────────────────────────────────────────────

export function getReceiptStatusView(receipt?: any) {
  if (!receipt) {
    return {
      label: 'Đặt hàng',
      toneClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
    }
  }

  const totalAmount = Math.max(0, Number(receipt?.totalAmount ?? 0))
  const paidAmount = Math.max(0, Number(receipt?.paidAmount ?? 0))
  const hasPaymentAllocations =
    Array.isArray(receipt?.paymentAllocations) && receipt.paymentAllocations.length > 0
  const isCancelled = receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED'
  const isFullyReturned =
    receipt.receiptStatus === 'RETURNED' ||
    (Number(receipt?.returnedQty ?? 0) > 0 &&
      Number(receipt?.returnedQty ?? 0) >= Number(receipt?.receivedQty ?? receipt?.orderedQty ?? 1))
  const isPartiallyReturned = !isFullyReturned && Number(receipt?.returnedQty ?? 0) > 0
  const isReceiveDone =
    receipt.status === 'RECEIVED' ||
    receipt.receiptStatus === 'FULL_RECEIVED' ||
    receipt.receiptStatus === 'SHORT_CLOSED' ||
    !!receipt.completedAt
  const hasAnyReceive =
    isReceiveDone ||
    receipt.receiptStatus === 'PARTIAL_RECEIVED' ||
    Math.max(0, Number(receipt?.receivedQty ?? 0)) > 0 ||
    !!receipt.receivedAt
  const hasAnyPayment = paidAmount > 0 || hasPaymentAllocations
  const isPaid =
    totalAmount > 0
      ? paidAmount >= Math.max(0, totalAmount - 1)
      : receipt.paymentStatus === 'PAID'

  if (isCancelled) return { label: 'Đã hủy', toneClass: 'border-error/30 bg-error/10 text-error' }
  if (isFullyReturned) return { label: 'Đã hoàn trả', toneClass: 'border-rose-500/30 bg-rose-500/10 text-rose-500' }
  if (isPartiallyReturned) return { label: 'Hoàn 1 phần', toneClass: 'border-rose-400/30 bg-rose-400/10 text-rose-400' }
  if (isReceiveDone && isPaid) return { label: 'Hoàn thành', toneClass: 'border-primary-500/30 bg-primary-500/10 text-primary-500' }
  if (isReceiveDone) return { label: 'Nhận hàng', toneClass: 'border-sky-500/30 bg-sky-500/10 text-sky-500' }
  if (hasAnyReceive) return { label: 'Nhận hàng 1 phần', toneClass: 'border-sky-500/30 bg-sky-500/10 text-sky-500' }
  if (isPaid) return { label: 'Đã thanh toán', toneClass: 'border-primary-500/30 bg-primary-500/10 text-primary-500' }
  if (hasAnyPayment) return { label: 'Thanh toán 1 phần', toneClass: 'border-orange-500/30 bg-orange-500/10 text-orange-400' }

  return {
    label: 'Đặt hàng',
    toneClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  }
}
