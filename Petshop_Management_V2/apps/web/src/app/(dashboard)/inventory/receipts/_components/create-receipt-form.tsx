'use client'

import { useDeferredValue, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Building2,
  ChevronDown,
  ChevronRight,
  Copy,
  FileDown,
  FileSpreadsheet,
  History,
  Info,
  Minus,
  Phone,
  Package2,
  Plus,
  Printer,
  ScanSearch,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { exportAoaToExcel } from '@/lib/excel'
import { ReceiptWorkspace } from './receipt-workspace'
import { stockApi } from '@/lib/api/stock.api'
import { inventoryApi } from '@/lib/api/inventory.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthStore } from '@/stores/auth.store'
import { useAuthorization } from '@/hooks/useAuthorization'
import { api } from '@/lib/api'
import { NumericFormat } from 'react-number-format'
import { normalizeBranchCode, suggestBranchCodeFromName } from '@petshop/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchStock {
  branchId: string
  branch?: { id: string; name: string }
  stock?: number | null
  reservedStock?: number | null
  availableStock?: number | null
}

interface SelectedItem {
  lineId: string
  receiptItemId?: string | null
  productId: string
  productVariantId?: string | null
  barcode?: string | null
  sku?: string | null
  name: string
  image?: string | null
  unit?: string | null
  sellingPrice: number
  quantity: number
  unitCost: number
  discount: number
  note: string
  totalStock?: number | null
  branchStocks?: BranchStock[]
  variants?: ProductVariantOption[]
  variantName?: string | null
  baseSku?: string | null
  baseBarcode?: string | null
  baseUnit?: string | null
  baseUnitCost?: number
  baseTotalStock?: number | null
  baseBranchStocks?: BranchStock[]
  receivedQuantity?: number
  returnedQuantity?: number
  closedQuantity?: number
}

interface ProductVariantOption {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  price?: number | null
  sellingPrice?: number | null
  costPrice?: number | null
  image?: string | null
  conversions?: string | null
  branchStocks?: BranchStock[]
  stock?: number | null
  availableStock?: number | null
  trading?: number | null
}

interface ExtraCostRow {
  id: string
  label: string
  amount: number
}

interface SupplierQuickDraftItem {
  productId: string
  productVariantId?: string | null
  name: string
  sku?: string | null
  unit?: string | null
  quantity: number
  unitCost: number
}

interface SupplierQuickDraftPayload {
  supplierId?: string
  notes?: string
  items?: SupplierQuickDraftItem[]
}

interface SupplierQuickForm {
  code: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

interface ReceiptEditSession {
  id: string
  editedAt: string
  editedBy: string
  itemCount: number
  totalQuantity: number
}

interface ReceiptMetaPayload {
  discount: number
  tax: number
  extraCosts: Array<{ label: string; amount: number }>
  editSessions?: ReceiptEditSession[]
}

interface ReceiptPaymentFormState {
  amount: number
  paymentMethod: string
  notes: string
}

interface ReceiptReturnLineDraft {
  receiptItemId: string
  productId: string
  productVariantId?: string | null
  name: string
  sku?: string | null
  availableQty: number
  quantity: number
}

interface ReceiptReturnFormState {
  notes: string
  items: ReceiptReturnLineDraft[]
}

type SubmitMode = 'draft' | 'receive'
type ReceiptScreenMode = 'create' | 'edit'

interface CreateReceiptFormProps {
  mode?: ReceiptScreenMode
  receiptId?: string
}

const RECEIPT_META_MARKER = '[RECEIPT_META]'
const SUPPLIER_RECEIPT_DRAFT_KEY = 'inventory.receiptDraftFromSupplier'
const RECEIPT_PAYMENT_METHOD_OPTIONS = [
  { value: 'BANK', label: 'Chuyển khoản' },
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'MOMO', label: 'MoMo' },
  { value: 'CARD', label: 'Thẻ' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return value.toLocaleString('vi-VN')
}

function getSuppliers(data: unknown): any[] {
  if (Array.isArray((data as any)?.data?.data)) return (data as any).data.data
  if (Array.isArray((data as any)?.data)) return (data as any).data
  if (Array.isArray(data)) return data
  return []
}

function getProducts(data: unknown): any[] {
  if (Array.isArray((data as any)?.data?.data)) return (data as any).data.data
  if (Array.isArray((data as any)?.data)) return (data as any).data
  if (Array.isArray(data)) return data
  return []
}

function getReceipts(data: unknown): any[] {
  if (Array.isArray((data as any)?.data?.data)) return (data as any).data.data
  if (Array.isArray((data as any)?.data)) return (data as any).data
  if (Array.isArray(data)) return data
  return []
}

function normalizeText(value?: string | null) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim()
}

function filterSuppliers(suppliers: any[], query: string) {
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

function createSupplierDraft(query: string): SupplierQuickForm {
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

function findExactProductMatch(products: any[], rawQuery: string) {
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

function createLineId() {
  return `receipt-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getItemIdentity(productId: string, productVariantId?: string | null) {
  return `${productId}:${productVariantId ?? 'base'}`
}

function safeParseJson(value?: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isConversionVariant(variant?: ProductVariantOption | null) {
  const parsed = safeParseJson(variant?.conversions)
  return !!(parsed?.rate || parsed?.conversionRate || parsed?.mainQty)
}

function getTrueVariants(variants?: ProductVariantOption[]) {
  return (variants ?? []).filter((variant) => !isConversionVariant(variant))
}

function getVariantShortLabel(name?: string | null) {
  const parts = `${name ?? ''}`
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return ''
  return parts[parts.length - 1]
}

function findParentTrueVariant(
  variants: ProductVariantOption[],
  selectedVariant?: ProductVariantOption | null,
) {
  if (!selectedVariant) return null
  if (!isConversionVariant(selectedVariant)) return selectedVariant
  const trueVariants = getTrueVariants(variants)
return (
    trueVariants.find((variant) => selectedVariant.name.startsWith(`${variant.name} - `)) ?? null
  )
}

function getConversionVariants(
  variants: ProductVariantOption[],
  currentTrueVariant?: ProductVariantOption | null,
) {
  const allConversions = variants.filter((variant) => isConversionVariant(variant))
  if (!currentTrueVariant) {
    return allConversions.filter(
      (variant) =>
        !getTrueVariants(variants).some((trueVariant) =>
          variant.name.startsWith(`${trueVariant.name} - `),
        ),
    )
  }
  return allConversions.filter((variant) =>
    variant.name.startsWith(`${currentTrueVariant.name} - `),
  )
}

function sumBranchStock(branchStocks?: BranchStock[]) {
  return (branchStocks ?? []).reduce((sum, stock) => sum + Number(stock.stock ?? 0), 0)
}

function getVariantSnapshot(item: SelectedItem) {
  const variants = item.variants ?? []
  const selectedVariant =
    variants.find((variant) => variant.id === item.productVariantId) ?? null
  const selectedBranchStocks = Array.isArray(selectedVariant?.branchStocks)
    ? selectedVariant.branchStocks
    : undefined
  const branchStocks =
    selectedBranchStocks ??
    (item.productVariantId ? [] : item.baseBranchStocks ?? item.branchStocks ?? [])

  const totalStock = selectedVariant
    ? selectedVariant.stock !== undefined && selectedVariant.stock !== null
      ? Number(selectedVariant.stock)
      : sumBranchStock(branchStocks)
    : item.baseTotalStock ?? item.totalStock ?? sumBranchStock(branchStocks)

  return {
    selectedVariant,
    branchStocks,
    totalStock,
    displayName: selectedVariant?.name || item.name,
    displaySku: selectedVariant?.sku ?? item.sku ?? item.baseSku ?? null,
    displayBarcode: selectedVariant?.barcode ?? item.barcode ?? item.baseBarcode ?? null,
  }
}

function applyVariantSelection(item: SelectedItem, variantId: string) {
  if (!variantId || variantId === 'base') {
    return {
      ...item,
      productVariantId: null,
      variantName: null,
      sku: item.baseSku ?? item.sku,
      barcode: item.baseBarcode ?? item.barcode,
      unitCost: item.baseUnitCost ?? item.unitCost,
      totalStock: item.baseTotalStock ?? item.totalStock,
      branchStocks: item.baseBranchStocks ?? item.branchStocks,
    }
  }

  const selectedVariant = item.variants?.find((variant) => variant.id === variantId)
  if (!selectedVariant) return item

  const branchStocks = Array.isArray(selectedVariant.branchStocks)
    ? selectedVariant.branchStocks
    : []

  return {
    ...item,
    productVariantId: selectedVariant.id,
    variantName: selectedVariant.name,
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

function normalizeProduct(product: any): SelectedItem {
  const variants: ProductVariantOption[] = Array.isArray(product.variants) ? product.variants : []
  const defaultVariant = getTrueVariants(variants)[0] ?? variants[0] ?? null
  const defaultBranchStocks = Array.isArray(defaultVariant?.branchStocks)
    ? defaultVariant.branchStocks
    : Array.isArray(product.branchStocks)
      ? product.branchStocks
      : []

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
    totalStock:
      defaultVariant?.stock !== undefined && defaultVariant?.stock !== null
        ? Number(defaultVariant.stock)
        : product.stock !== undefined
          ? Number(product.stock)
          : sumBranchStock(defaultBranchStocks),
    branchStocks: defaultBranchStocks,
    variants,
    variantName: defaultVariant?.name ?? null,
    baseSku: product.sku ?? null,
    baseBarcode: product.barcode ?? null,
    baseUnit: product.unit ?? null,
    baseUnitCost: Number(product.costPrice ?? 0),
    baseTotalStock: product.stock !== undefined ? Number(product.stock) : null,
    baseBranchStocks: Array.isArray(product.branchStocks) ? product.branchStocks : [],
  }
}

function normalizeSupplierQuickDraftItem(item: SupplierQuickDraftItem): SelectedItem {
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
    totalStock: null,
    branchStocks: [],
    variants: [],
    variantName: null,
    baseSku: item.sku ?? null,
    baseBarcode: null,
    baseUnit: item.unit ?? null,
    baseUnitCost: Math.max(0, Number(item.unitCost ?? 0)),
    baseTotalStock: null,
    baseBranchStocks: [],
  }
}

function createExtraCostRow(): ExtraCostRow {
  return {
    id: `extra-cost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    amount: 0,
  }
}

function normalizeExtraCosts(rows: ExtraCostRow[]) {
  return rows
    .filter((r) => r.label.trim() || r.amount > 0)
    .map((r, i) => ({
      label: r.label.trim() || `Chi phí khác ${i + 1}`,
      amount: Math.max(0, Number.isFinite(r.amount) ? r.amount : 0),
    }))
    .filter((r) => r.amount > 0)
}

function buildReceiptNotes(
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

function parseReceiptNotes(value?: string | null) {
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

function createReceiptDraftSignature(payload: {
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

function normalizeReceiptItem(item: any): SelectedItem {
  const product = item?.product ?? {}
  const selectedVariant = item?.productVariant ?? null

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
    totalStock: null,
    branchStocks: [],
    variants: selectedVariant
      ? [
          {
            id: selectedVariant.id,
            name: selectedVariant.name,
            sku: selectedVariant.sku ?? null,
            barcode: selectedVariant.barcode ?? null,
            price: selectedVariant.price ?? null,
            sellingPrice: selectedVariant.sellingPrice ?? null,
            costPrice: selectedVariant.costPrice ?? item?.unitPrice ?? null,
            image: selectedVariant.image ?? null,
            conversions: selectedVariant.conversions ?? null,
            branchStocks: [],
            stock: null,
            availableStock: null,
            trading: null,
          },
        ]
      : [],
    variantName: selectedVariant?.name ?? null,
    baseSku: product?.sku ?? null,
    baseBarcode: product?.barcode ?? null,
    baseUnit: product?.unit ?? null,
    baseUnitCost: Number(product?.costPrice ?? item?.unitPrice ?? item?.unitCost ?? 0),
    baseTotalStock: null,
    baseBranchStocks: [],
    receivedQuantity: Math.max(0, Number(item?.receivedQuantity ?? 0)),
    returnedQuantity: Math.max(0, Number(item?.returnedQuantity ?? 0)),
    closedQuantity: Math.max(0, Number(item?.closedQuantity ?? 0)),
  }
}

function getReceiptRedirectId(receipt: any, fallbackId?: string) {
  return receipt?.receiptNumber || receipt?.id || fallbackId || ''
}

function formatReceiptDateTime(value?: string | Date | null) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—'
}

function getPaymentMethodLabel(value?: string | null) {
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

function getReceiptStatusView(receipt?: any) {
  if (!receipt) {
    return {
      label: 'Đặt hàng',
      toneClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
    }
  }

  const totalAmount = Math.max(0, Number(receipt?.totalAmount ?? 0))
  const paidAmount = Math.max(0, Number(receipt?.paidAmount ?? 0))
  const hasPaymentAllocations = Array.isArray(receipt?.paymentAllocations) && receipt.paymentAllocations.length > 0
  const isCancelled = receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED'
  const isFullyReturned =
    receipt.receiptStatus === 'RETURNED' ||
    (Number(receipt?.returnedQty ?? 0) > 0 &&
      Number(receipt?.returnedQty ?? 0) >= Number(receipt?.receivedQty ?? receipt?.orderedQty ?? 1))
  const isPartiallyReturned =
    !isFullyReturned &&
    Number(receipt?.returnedQty ?? 0) > 0
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

  if (isCancelled) {
    return {
      label: 'Đã hủy',
      toneClass: 'border-error/30 bg-error/10 text-error',
    }
  }
  if (isFullyReturned) {
    return {
      label: 'Đã hoàn trả',
      toneClass: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
    }
  }
  if (isPartiallyReturned) {
    return {
      label: 'Hoàn 1 phần',
      toneClass: 'border-rose-400/30 bg-rose-400/10 text-rose-400',
    }
  }
  if (isReceiveDone && isPaid) {
    return {
      label: 'Hoàn thành',
      toneClass: 'border-primary-500/30 bg-primary-500/10 text-primary-500',
    }
  }
  if (isReceiveDone) {
    return {
      label: 'Nhận hàng',
      toneClass: 'border-sky-500/30 bg-sky-500/10 text-sky-500',
    }
  }
  if (hasAnyReceive) {
    return {
      label: 'Nhận hàng 1 phần',
      toneClass: 'border-sky-500/30 bg-sky-500/10 text-sky-500',
    }
  }
  if (isPaid) {
    return {
      label: 'Đã thanh toán',
      toneClass: 'border-primary-500/30 bg-primary-500/10 text-primary-500',
    }
  }
  if (hasAnyPayment) {
    return {
      label: 'Thanh toán 1 phần',
      toneClass: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    }
  }

  return {
    label: receipt.status === 'DRAFT' ? 'Đặt hàng' : 'Đặt hàng',
    toneClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  }
}

// ─── Stock Popup –– matches POS style exactly ────────────────────────────────

function StockPopover({
  item,
  branches,
}: {
  item: SelectedItem
  branches: any[]
}) {
  const snapshot = getVariantSnapshot(item)
  const branchStocks: BranchStock[] = Array.isArray(snapshot.branchStocks) ? snapshot.branchStocks : []

  return (
    // group/stock wraps the trigger icon + absolutely-positioned popup
    <div className="group/stock relative z-[60] flex shrink-0">
      {/* Trigger: Info icon — hidden until row is hovered */}
      <Info
        size={15}
        className="text-foreground-muted opacity-0 group-hover:opacity-100 group-hover/stock:text-primary-500 cursor-help transition-all"
      />

      {/* Popup */}
      <div className="absolute top-full left-1/2 -translate-x-[40%] mt-2 w-[340px] opacity-0 invisible group-hover/stock:opacity-100 group-hover/stock:visible transition-all duration-200 pointer-events-none group-hover/stock:pointer-events-auto before:absolute before:-top-4 before:left-0 before:w-full before:h-4 z-[100]">
        <div className="bg-background-secondary border border-border shadow-2xl rounded-xl overflow-hidden">
          {/* Header: product name (link) + SKU */}
          <div className="bg-background-tertiary px-4 py-3 border-b border-border">
            <Link
              href={`/inventory/products/${item.productId}`}
              target="_blank"
              className="font-bold text-[13px] text-foreground hover:text-primary-500 hover:underline leading-tight block cursor-pointer transition-colors"
            >
              {snapshot.displayName}
            </Link>
            <div className="text-[10px] text-foreground-muted mt-0.5 font-medium tracking-wide uppercase">
              {snapshot.displaySku || snapshot.displayBarcode || 'N/A'}{/*
                <button
                  type="button"
                  onClick={openReturnModal}
                  disabled={returnMutation.isPending || !resolvedReceiptId}
                  className="inline-flex min-w-[220px] items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/12 px-4 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:border-amber-500/60 hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {returnMutation.isPending ? 'Đang xử lý...' : 'Hoàn trả'}
                </button>
              */}
            </div>
          </div>

          {/* Stock table */}
          <div className="px-4 py-3">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead>
                <tr className="border-b border-border text-foreground-muted">
                  <th className="text-left font-semibold pb-2"></th>
                  <th className="font-semibold pb-2 px-2">TỒN</th>
                  <th className="font-semibold pb-2 px-2 text-primary-500">KHẢ DỤNG</th>
                  <th className="font-semibold pb-2 pl-2">ĐÃ BÁN</th>
                </tr>
              </thead>
              <tbody>
                {/* Total row */}
                <tr className="border-b border-border/50">
                  <td className="text-left py-2.5 font-semibold text-foreground">Tổng tồn kho</td>
                  <td className="px-2 py-2.5">{snapshot.totalStock ?? '—'}</td>
                  <td className="px-2 py-2.5 text-primary-500 font-bold">{snapshot.totalStock ?? '—'}</td>
                  <td className="pl-2 py-2.5 text-foreground-muted">—</td>
                </tr>

                {/* Per-branch rows */}
                {branches.filter((b: any) => b.isActive !== false).map((b: any) => {
                  const bs = branchStocks.find(
                    (s) => s.branchId === b.id || s.branch?.id === b.id,
                  )
                  const stock = bs ? (bs.stock ?? 0) : 0
                  const reserved = bs ? (bs.reservedStock ?? 0) : 0
                  const available =
                    bs !== undefined && bs !== null && bs.availableStock !== undefined && bs.availableStock !== null
                      ? bs.availableStock
                      : stock - reserved

                  return (
                    <tr key={b.id} className="border-b border-border/30 border-dashed last:border-0">
                      <td className="text-left py-2 font-medium text-foreground-secondary truncate max-w-[120px]">
                        {b.name}
                      </td>
                      <td className="px-2 py-2">{stock}</td>
                      <td className={`px-2 py-2 font-semibold ${available <= 0 ? 'text-error' : 'text-primary-500/80'}`}>
                        {available}
                      </td>
                      <td className="pl-2 py-2 text-foreground-muted">—</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

function QuickSupplierModal({
  isOpen,
  form,
  isSaving,
  onClose,
  onChange,
  onSave,
}: {
  isOpen: boolean
  form: SupplierQuickForm
  isSaving: boolean
  onClose: () => void
  onChange: (field: keyof SupplierQuickForm, value: string) => void
  onSave: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <UserPlus size={18} className="text-primary-500" />
            Thêm nhà cung cấp nhanh
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <input
            autoFocus
            type="text"
            className="form-input h-10"
            placeholder="Tên nhà cung cấp"
            value={form.name}
            onChange={(e) => onChange('name', e.target.value)}
          />
          <input
            type="text"
            className="form-input h-10 uppercase"
            placeholder="ID NCC"
            maxLength={4}
            value={form.code}
            onChange={(e) => onChange('code', e.target.value)}
          />
          <input
            type="text"
            className="form-input h-10"
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
          <input
            type="email"
            className="form-input h-10"
            placeholder="Email"
            value={form.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
          <input
            type="text"
            className="form-input h-10"
            placeholder="Địa chỉ"
            value={form.address}
            onChange={(e) => onChange('address', e.target.value)}
          />
          <textarea
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            placeholder="Ghi chú"
            value={form.notes}
            onChange={(e) => onChange('notes', e.target.value)}
          />
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline flex-1 rounded-xl py-2.5 text-sm"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="btn-primary flex-1 justify-center rounded-xl py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu & chọn'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CreateReceiptForm({
  mode = 'create',
  receiptId,
}: CreateReceiptFormProps = {}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const supplierPanelRef = useRef<HTMLDivElement>(null)
  const hydratedSupplierDraftRef = useRef(false)
  const hydratedReceiptRef = useRef<string | null>(null)

  const activeBranchId = useAuthStore((s) => s.activeBranchId)
  const allowedBranches = useAuthStore((s) => s.allowedBranches)
  const user = useAuthStore((s) => s.user)

  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const canReadReceipt = hasPermission('stock_receipt.read')
  const canCreateReceipt = hasPermission('stock_receipt.create')
  const canUpdateReceipt = hasPermission('stock_receipt.update')
  const canPayReceipt = hasPermission('stock_receipt.pay')
  const canReceiveReceipt = hasPermission('stock_receipt.receive')
  const canCancelReceipt = hasPermission('stock_receipt.cancel')
  const canReturnReceipt = hasPermission('stock_receipt.return')
  const isCreateMode = mode === 'create'
  const isEditMode = mode === 'edit'
  const isExistingReceipt = !!receiptId
  const canAccessScreen = isCreateMode
    ? canCreateReceipt
    : canReadReceipt || canUpdateReceipt || canCreateReceipt

  const [branchId, setBranchId] = useState(activeBranchId ?? '')
  const [supplierId, setSupplierId] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const [showSupplierSearch, setShowSupplierSearch] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [supplierForm, setSupplierForm] = useState<SupplierQuickForm>({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })
  const [supplierCodeTouched, setSupplierCodeTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [manualSearching, setManualSearching] = useState(false)
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [items, setItems] = useState<SelectedItem[]>([])
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([])
  const [receiptDiscount, setReceiptDiscount] = useState(0)
  const [receiptTax, setReceiptTax] = useState(0)
  const [extraCosts, setExtraCosts] = useState<ExtraCostRow[]>([])
  const [showExtraCosts, setShowExtraCosts] = useState(false)
  const [editingNoteForId, setEditingNoteForId] = useState<string | null>(null)
  const [tempNote, setTempNote] = useState('')
  const [scanMode, setScanMode] = useState(false)
  const [isEditingSession, setIsEditingSession] = useState(false)
  const [editBaseSignature, setEditBaseSignature] = useState('')
  const [editSessions, setEditSessions] = useState<ReceiptEditSession[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [paymentForm, setPaymentForm] = useState<ReceiptPaymentFormState>({
    amount: 0,
    paymentMethod: 'BANK',
    notes: '',
  })
  const [returnForm, setReturnForm] = useState<ReceiptReturnFormState>({
    notes: '',
    items: [],
  })
  const scanRequestRef = useRef(0)
  const lastAutoScannedRef = useRef('')

  const deferredSearch = useDeferredValue(search.trim())

  const { data: receiptRes, isLoading: isReceiptLoading } = useQuery({
    queryKey: ['receipt', receiptId],
    queryFn: () => stockApi.getReceipt(receiptId as string),
    enabled: isExistingReceipt,
    staleTime: 30_000,
  })

  const { data: suppliersRes } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => stockApi.getSuppliers(),
  })

  const { data: productSearchRes, isFetching: isSearchingSuggestions } = useQuery({
    queryKey: ['inventory', 'products', 'receipt-search', deferredSearch, branchId],
    queryFn: () =>
      inventoryApi.getProducts({
        search: deferredSearch,
        limit: 8,
        branchId: branchId || undefined,
      }),
    enabled: deferredSearch.length >= 1,
    staleTime: 30_000,
  })

  const { data: supplierReceiptsRes } = useQuery({
    queryKey: ['receipts', 'supplier-history', supplierId],
    queryFn: () =>
      stockApi.getReceipts({
        supplierId,
        limit: 20,
      }),
    enabled: !!supplierId,
    staleTime: 30_000,
  })

  // Branches for stock popup (same as POS uses)
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/settings/branches').then((r: any) => r.data.data ?? r.data),
  })

  const receipt = (receiptRes as any)?.data?.data
  const resolvedReceiptId = receipt?.id ?? receiptId ?? ''
  const currentReceiptQueryIds = Array.from(
    new Set([receiptId, receipt?.id, receipt?.receiptNumber].filter(Boolean) as string[]),
  )
  const isReceiptLocked = isExistingReceipt
    ? !!receipt &&
      (receipt.status === 'CANCELLED' ||
        receipt.receiptStatus === 'CANCELLED' ||
        receipt.receiptStatus === 'FULL_RECEIVED' ||
        receipt.receiptStatus === 'SHORT_CLOSED' ||
        receipt.status === 'RECEIVED' ||
        !!receipt.completedAt)
    : false
  const isReadOnly = isExistingReceipt ? isReceiptLocked || !isEditingSession : false
  const canSubmitReceipt = isCreateMode ? canCreateReceipt : canUpdateReceipt && !isReadOnly

  const suppliers = getSuppliers(suppliersRes)
  const filteredSuppliers = filterSuppliers(suppliers, supplierQuery)
  const productResults = getProducts(productSearchRes)
  const supplierReceipts = getReceipts(supplierReceiptsRes).slice().sort((a: any, b: any) => {
    const left = new Date(b?.createdAt ?? 0).getTime()
    const right = new Date(a?.createdAt ?? 0).getTime()
    return left - right
  })
  const selectedSupplier = suppliers.find((s: any) => s.id === supplierId)
  const displaySupplier = (isExistingReceipt ? receipt?.supplier : null) ?? selectedSupplier ?? null
  const currentBranch = allowedBranches.find((branch) => branch.id === branchId) ?? null
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)

  const merchandiseTotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  const normalizedExtraCosts = normalizeExtraCosts(extraCosts)
  const extraCostTotal = normalizedExtraCosts.reduce((sum, item) => sum + item.amount, 0)
  const discountAmount = Math.max(0, receiptDiscount)
  const taxAmount = Math.max(0, receiptTax)
  const grandTotal = Math.max(0, merchandiseTotal + extraCostTotal + taxAmount - discountAmount)
  const currentDraftSignature = createReceiptDraftSignature({
    supplierId,
    branchId,
    notes,
    items,
    discount: discountAmount,
    tax: taxAmount,
    extraCosts,
  })
  const hasPendingReceiptChanges = isExistingReceipt && currentDraftSignature !== editBaseSignature
  const currentReceiptPaidAmount = Math.max(0, Number(receipt?.paidAmount ?? 0))
  const currentReceiptDebtAmount = Math.max(0, Number(receipt?.debtAmount ?? 0))
  const currentReceiptTotalAmount = Math.max(
    0,
    Number(isExistingReceipt ? receipt?.totalAmount ?? grandTotal : grandTotal),
  )
  const currentDebt = isExistingReceipt
    ? Math.max(currentReceiptDebtAmount, currentReceiptTotalAmount - currentReceiptPaidAmount, 0)
    : Math.max(0, Number(selectedSupplier?.debt ?? 0))
  const paymentAllocationCount = Array.isArray(receipt?.paymentAllocations) ? receipt.paymentAllocations.length : 0
  const latestPaymentAllocation = [...(receipt?.paymentAllocations ?? [])]
    .sort(
      (left: any, right: any) =>
        new Date(right?.payment?.paidAt ?? 0).getTime() - new Date(left?.payment?.paidAt ?? 0).getTime(),
    )[0]
  const latestReceiveEvent = [...(receipt?.receiveEvents ?? [])]
    .sort(
      (left: any, right: any) =>
        new Date(right?.receivedAt ?? 0).getTime() - new Date(left?.receivedAt ?? 0).getTime(),
    )[0]
  const latestPaymentAt = latestPaymentAllocation?.payment?.paidAt ?? receipt?.paymentDate ?? null
  const latestReceiveAt = latestReceiveEvent?.receivedAt ?? receipt?.receivedAt ?? receipt?.completedAt ?? null
  const hasAnyPayment = currentReceiptPaidAmount > 0 || paymentAllocationCount > 0
  const isFullyPaid =
    !!receipt &&
    (
      currentReceiptTotalAmount > 0
        ? currentReceiptPaidAmount >= Math.max(0, currentReceiptTotalAmount - 1)
        : receipt.paymentStatus === 'PAID'
    )
  const hasAnyReceive =
    Math.max(0, Number(receipt?.receivedQty ?? 0)) > 0 || !!receipt?.receivedAt || receipt?.status === 'RECEIVED'
  const isReceiveDone =
    !!receipt &&
    (
      receipt.receiptStatus === 'FULL_RECEIVED' ||
      receipt.receiptStatus === 'SHORT_CLOSED' ||
      receipt.status === 'RECEIVED' ||
      !!receipt.completedAt
    )
  const isCancelled = !!receipt && (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED')
  const isCompleted = !!receipt && !isCancelled && isFullyPaid && isReceiveDone
  const getLockedReceiptQuantity = (item: SelectedItem) =>
    Math.max(0, Number(item.receivedQuantity ?? 0)) + Math.max(0, Number(item.closedQuantity ?? 0))
  const hasLockedReceiptQuantity = (item: SelectedItem) => getLockedReceiptQuantity(item) > 0
  const returnableReceiptItems = Array.isArray(receipt?.items)
    ? receipt.items
        .map((item: any) => {
          const availableQty = Math.max(
            0,
            Number(item.receivedQuantity ?? 0) - Number(item.returnedQuantity ?? 0),
          )
          return availableQty > 0
            ? {
                receiptItemId: item.id as string,
                productId: item.productId as string,
                productVariantId: item.productVariantId ?? null,
                name: item.product?.name || item.productName || 'Sản phẩm',
                sku:
                  item.productVariant?.sku ||
                  item.product?.sku ||
                  item.productVariant?.barcode ||
                  item.product?.barcode ||
                  null,
                availableQty,
                quantity: 0,
              }
            : null
        })
        .filter(Boolean) as ReceiptReturnLineDraft[]
    : []
  const latestImportPriceMap = supplierReceipts.reduce(
    (map, receipt: any) => {
      for (const item of receipt.items ?? []) {
        const identity = getItemIdentity(item.productId, item.productVariantId)
        if (!map.has(identity)) {
          map.set(identity, {
            unitPrice: Number(item.unitPrice ?? 0),
            receiptNumber: receipt.receiptNumber,
            createdAt: receipt.createdAt,
          })
        }
      }
      return map
    },
    new Map<string, { unitPrice: number; receiptNumber?: string; createdAt?: string }>(),
  )
  const latestProductPriceMap = supplierReceipts.reduce(
    (map, receipt: any) => {
      for (const item of receipt.items ?? []) {
        if (!map.has(item.productId)) {
          map.set(item.productId, {
            unitPrice: Number(item.unitPrice ?? 0),
            receiptNumber: receipt.receiptNumber,
            createdAt: receipt.createdAt,
          })
        }
      }
      return map
    },
    new Map<string, { unitPrice: number; receiptNumber?: string; createdAt?: string }>(),
  )

  const getLatestSupplierPrice = (productId: string, productVariantId?: string | null) =>
    latestImportPriceMap.get(getItemIdentity(productId, productVariantId)) ??
    latestProductPriceMap.get(productId) ??
    null

  const invalidateCurrentReceiptQueries = () => {
    currentReceiptQueryIds.forEach((queryId) => {
      queryClient.invalidateQueries({ queryKey: ['receipt', queryId] })
    })
  }

  const refetchCurrentReceiptQueries = async () => {
    await Promise.all(
      currentReceiptQueryIds.map((queryId) =>
        queryClient.refetchQueries({
          queryKey: ['receipt', queryId],
          exact: true,
          type: 'active',
        }),
      ),
    )
  }

  const isReceiptPayload = (value: any) =>
    !!value &&
    (typeof value?.receiptNumber === 'string' ||
      Array.isArray(value?.items) ||
      typeof value?.receiptStatus === 'string' ||
      typeof value?.paymentStatus === 'string')

  const syncCurrentReceiptQueries = (nextReceipt: any) => {
    if (!isReceiptPayload(nextReceipt)) return

    const nextQueryIds = Array.from(
      new Set([receiptId, nextReceipt?.id, nextReceipt?.receiptNumber].filter(Boolean) as string[]),
    )

    nextQueryIds.forEach((queryId) => {
      queryClient.setQueryData(['receipt', queryId], { data: { data: nextReceipt } })
      queryClient.invalidateQueries({ queryKey: ['receipt', queryId] })
    })
  }

  const applyLatestSupplierPrice = (item: SelectedItem) => {
    if (!supplierId) return item
    const latest = getLatestSupplierPrice(item.productId, item.productVariantId)
    if (!latest) return item
    return { ...item, unitCost: Number(latest.unitPrice ?? item.unitCost) }
  }

  const openPaymentModal = () => {
    if (!resolvedReceiptId || currentDebt <= 0) return
    setPaymentForm({
      amount: currentDebt,
      paymentMethod: 'BANK',
      notes: '',
    })
    setShowPaymentModal(true)
  }

  const openReturnModal = () => {
    if (!resolvedReceiptId || returnableReceiptItems.length === 0) return
    setReturnForm({
      notes: '',
      items: returnableReceiptItems.map((item) => ({ ...item, quantity: 0 })),
    })
    setShowReturnModal(true)
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isReadOnly) return
    searchInputRef.current?.focus()
  }, [isReadOnly])

  useEffect(() => {
    if (!branchId && (activeBranchId || allowedBranches[0]?.id)) {
      setBranchId(activeBranchId ?? allowedBranches[0]?.id ?? '')
    }
  }, [activeBranchId, allowedBranches, branchId])

  useEffect(() => {
    if (isExistingReceipt || hydratedSupplierDraftRef.current) return
    hydratedSupplierDraftRef.current = true

    const rawDraft = window.localStorage.getItem(SUPPLIER_RECEIPT_DRAFT_KEY)
    if (!rawDraft) return

    window.localStorage.removeItem(SUPPLIER_RECEIPT_DRAFT_KEY)

    try {
      const parsed = JSON.parse(rawDraft) as SupplierQuickDraftPayload
      const draftItems = Array.isArray(parsed.items)
        ? parsed.items
            .filter((item) => item?.productId && item?.name)
            .map((item) => normalizeSupplierQuickDraftItem(item))
        : []

      if (parsed.supplierId) setSupplierId(String(parsed.supplierId))
      if (parsed.notes) setNotes(String(parsed.notes))
      if (draftItems.length > 0) setItems(draftItems)
    } catch {
      toast.error('Không đọc được dữ liệu nháp phiếu nhập từ màn nhà cung cấp.')
    }
  }, [isExistingReceipt])

  useEffect(() => {
    if (isAuthLoading) return
    if (!canAccessScreen) router.replace('/dashboard')
  }, [canAccessScreen, isAuthLoading, router])

  useEffect(() => {
    if (!receipt?.id) return
    if (hydratedReceiptRef.current === receipt.id) return

    const parsedNotes = parseReceiptNotes(receipt.notes)
    hydratedReceiptRef.current = receipt.id

    setBranchId(receipt.branchId ?? activeBranchId ?? '')
    setSupplierId(receipt.supplierId ?? '')
    setSupplierQuery(receipt.supplier?.name ?? '')
    setNotes(parsedNotes.note)
    setItems(
      Array.isArray(receipt.items)
        ? receipt.items.map((item: any) => normalizeReceiptItem(item))
        : [],
    )
    setSelectedLineIds([])
    setReceiptDiscount(parsedNotes.discount)
    setReceiptTax(parsedNotes.tax)
    setExtraCosts(parsedNotes.extraCosts)
    setEditSessions(parsedNotes.editSessions)
    setEditBaseSignature(
      createReceiptDraftSignature({
        supplierId: receipt.supplierId ?? '',
        branchId: receipt.branchId ?? '',
        notes: parsedNotes.note,
        items: Array.isArray(receipt.items)
          ? receipt.items.map((item: any) => normalizeReceiptItem(item))
          : [],
        discount: parsedNotes.discount,
        tax: parsedNotes.tax,
        extraCosts: parsedNotes.extraCosts,
      }),
    )
    setIsEditingSession(false)
    setShowSupplierSearch(false)
    setIsSuggestionOpen(false)
  }, [activeBranchId, receipt])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchPanelRef.current && !searchPanelRef.current.contains(event.target as Node)) {
        setIsSuggestionOpen(false)
      }
      if (supplierPanelRef.current && !supplierPanelRef.current.contains(event.target as Node)) {
        setShowSupplierSearch(false)
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!selectedSupplier) return
    setSupplierQuery(selectedSupplier.name ?? '')
  }, [selectedSupplier])

  useEffect(() => {
    if (!search.trim()) {
      lastAutoScannedRef.current = ''
    }
  }, [search])

  useEffect(() => {
    if (!search.trim()) {
      setHighlightedIndex(0)
      setIsSuggestionOpen(false)
      return
    }
    if (productResults.length > 0) {
      setIsSuggestionOpen(true)
      setHighlightedIndex(0)
    }
  }, [productResults, search])

  useEffect(() => {
    setSelectedLineIds((current) =>
      current.filter((lineId) => items.some((item) => item.lineId === lineId)),
    )
  }, [items])

  useEffect(() => {
    if (!scanMode) return
    const query = search.trim()
    if (query.length < 3 || manualSearching) return

    const requestId = ++scanRequestRef.current
    const timer = window.setTimeout(async () => {
      const normalizedQuery = query.toLowerCase()
      if (!normalizedQuery || lastAutoScannedRef.current === normalizedQuery) return

      const localExact = findExactProductMatch(productResults, query)
      if (localExact) {
        lastAutoScannedRef.current = normalizedQuery
        addProductToReceipt(localExact.product, {
          productVariantId: localExact.productVariantId,
          mergeIdentity: true,
        })
        return
      }

      try {
        const response = await inventoryApi.getProducts({
          search: query,
          limit: 8,
          branchId: branchId || undefined,
        })
        if (scanRequestRef.current !== requestId) return
        const results = getProducts(response)
        const exact = findExactProductMatch(results, query)
        if (!exact) return

        lastAutoScannedRef.current = normalizedQuery
        addProductToReceipt(exact.product, {
          productVariantId: exact.productVariantId,
          mergeIdentity: true,
        })
      } catch {
        // keep scan mode non-blocking; manual search still handles visible errors
      }
    }, 120)

    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, manualSearching, productResults, scanMode, search])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const addProductToReceipt = (
    product: any,
    options?: { productVariantId?: string | null; mergeIdentity?: boolean },
  ) => {
    if (isReadOnly) return
    let nextItem = normalizeProduct(product)
    if (options && 'productVariantId' in options) {
      nextItem = applyVariantSelection(nextItem, options.productVariantId ?? 'base')
    }
    nextItem = applyLatestSupplierPrice(nextItem)

    setItems((current) => {
      if (options?.mergeIdentity) {
        const identity = getItemIdentity(nextItem.productId, nextItem.productVariantId)
        const existingIndex = current.findIndex(
          (item) => getItemIdentity(item.productId, item.productVariantId) === identity,
        )

        if (existingIndex >= 0) {
          return current.map((item, index) =>
            index === existingIndex ? { ...item, quantity: item.quantity + nextItem.quantity } : item,
          )
        }
      }

      return [...current, nextItem]
    })
    setSearch('')
    setHighlightedIndex(0)
    setIsSuggestionOpen(false)
    window.setTimeout(() => searchInputRef.current?.focus(), 10)
  }

  const updateItem = (
    lineId: string,
    field: 'quantity' | 'unitCost' | 'discount',
    value: number,
  ) => {
    if (isReadOnly) return
    setItems((current) =>
      current.map((item) => {
        if (item.lineId !== lineId) return item
        if (field === 'quantity') {
          return {
            ...item,
            quantity: Math.max(
              Math.max(1, getLockedReceiptQuantity(item)),
              Number.isFinite(value) ? Math.floor(value) : 1,
            ),
          }
        }
        return { ...item, [field]: Math.max(0, Number.isFinite(value) ? value : 0) }
      }),
    )
  }

  const updateItemNote = (lineId: string, note: string) => {
    if (isReadOnly) return
    setItems((current) =>
      current.map((item) => (item.lineId === lineId ? { ...item, note } : item)),
    )
  }

  const updateItemVariant = (lineId: string, variantId: string) => {
    if (isReadOnly) return
    setItems((current) =>
      current.map((item) =>
        item.lineId === lineId
          ? hasLockedReceiptQuantity(item)
            ? item
            : applyLatestSupplierPrice(applyVariantSelection(item, variantId))
          : item,
      ),
    )
  }

  const removeItem = (lineId: string) => {
    if (isReadOnly) return
    setItems((current) => current.filter((item) => item.lineId !== lineId || hasLockedReceiptQuantity(item)))
  }

  const toggleLineSelection = (lineId: string) => {
    if (isReadOnly) return
    setSelectedLineIds((current) =>
      current.includes(lineId)
        ? current.filter((id) => id !== lineId)
        : [...current, lineId],
    )
  }

  const toggleSelectAllLines = () => {
    if (isReadOnly) return
    setSelectedLineIds((current) =>
      current.length === items.length ? [] : items.map((item) => item.lineId),
    )
  }

  const removeSelectedItems = () => {
    if (isReadOnly) return
    if (selectedLineIds.length === 0) return
    setItems((current) =>
      current.filter((item) => !selectedLineIds.includes(item.lineId) || hasLockedReceiptQuantity(item)),
    )
    setSelectedLineIds([])
  }

  const duplicateItem = (lineId: string) => {
    if (isReadOnly) return
    setItems((current) => {
      const source = current.find((item) => item.lineId === lineId)
      if (!source) return current
      return [
        ...current,
        {
          ...source,
          lineId: createLineId(),
          receiptItemId: null,
          receivedQuantity: 0,
          returnedQuantity: 0,
          closedQuantity: 0,
        },
      ]
    })
  }

  const mergeDuplicateItems = (lineId: string) => {
    if (isReadOnly) return
    let shouldWarn = false

    setItems((current) => {
      const target = current.find((item) => item.lineId === lineId)
      if (!target) return current

      const identity = getItemIdentity(target.productId, target.productVariantId)
      const duplicates = current.filter(
        (item) => getItemIdentity(item.productId, item.productVariantId) === identity,
      )

      if (duplicates.length < 2) return current
      if (duplicates.some((item) => hasLockedReceiptQuantity(item))) {
        shouldWarn = true
        return current
      }

      const isMergeable = duplicates.every(
        (item) =>
          Number(item.unitCost) === Number(target.unitCost) &&
          Number(item.discount) === Number(target.discount) &&
          item.note.trim() === target.note.trim(),
      )

      if (!isMergeable) {
        shouldWarn = true
        return current
      }

      const mergedQuantity = duplicates.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)

      return current
        .filter(
          (item) =>
            getItemIdentity(item.productId, item.productVariantId) !== identity ||
            item.lineId === lineId,
        )
        .map((item) => (item.lineId === lineId ? { ...item, quantity: mergedQuantity } : item))
    })

    if (shouldWarn) {
      toast.info('Không thể gộp các dòng đã nhận kho hoặc đang khác giá, ghi chú.')
    }
  }

  const applyLatestSupplierPricesToItems = () => {
    if (isReadOnly) return
    if (!supplierId) {
      toast.error('Vui long chon nha cung cap truoc khi ap gia gan nhat.')
      return
    }

    let changedCount = 0
    setItems((current) =>
      current.map((item) => {
        const nextItem = applyLatestSupplierPrice(item)
        if (Number(nextItem.unitCost) !== Number(item.unitCost)) {
          changedCount += 1
        }
        return nextItem
      }),
    )

    if (changedCount > 0) {
      toast.success(`Da ap gia nhap gan nhat cho ${changedCount} dong hang.`)
      return
    }

    toast.info('Khong co dong nao can cap nhat gia nhap tu nha cung cap nay.')
  }

  const updateExtraCost = (id: string, field: 'label' | 'amount', value: string | number) => {
    if (isReadOnly) return
    setExtraCosts((current) =>
      current.map((item) => {
        if (item.id !== id) return item
        if (field === 'label') return { ...item, label: `${value}` }
        return { ...item, amount: Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0) }
      }),
    )
  }

  const resolveProductSearch = async () => {
    if (isReadOnly) return
    const query = search.trim()
    if (!query) return
    const localExact = findExactProductMatch(productResults, query)
    if (localExact) {
      addProductToReceipt(localExact.product, {
        productVariantId: localExact.productVariantId,
        mergeIdentity: true,
      })
      return
    }
    setManualSearching(true)
    try {
      const response = await inventoryApi.getProducts({
        search: query,
        limit: 8,
        branchId: branchId || undefined,
      })
      const results = getProducts(response)
      if (results.length === 0) { toast.error('Không tìm thấy sản phẩm phù hợp.'); return }
      const exact = findExactProductMatch(results, query)
      if (exact) {
        addProductToReceipt(exact.product, {
          productVariantId: exact.productVariantId,
          mergeIdentity: true,
        })
        return
      }
      if (results.length === 1) { addProductToReceipt(results[0]); return }
      setIsSuggestionOpen(true)
      setHighlightedIndex(0)
      toast.info('Có nhiều sản phẩm khớp. Chọn từ danh sách gợi ý.')
    } catch {
      toast.error('Không thể tìm kiếm sản phẩm lúc này.')
    } finally {
      setManualSearching(false)
      window.setTimeout(() => searchInputRef.current?.focus(), 10)
    }
  }

  const handleSearchKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (isReadOnly) return
    if (event.key === 'ArrowDown' && productResults.length > 0) {
      event.preventDefault()
      setIsSuggestionOpen(true)
      setHighlightedIndex((cur) => (cur + 1) % productResults.length)
      return
    }
    if (event.key === 'ArrowUp' && productResults.length > 0) {
      event.preventDefault()
      setIsSuggestionOpen(true)
      setHighlightedIndex((cur) => (cur - 1 + productResults.length) % productResults.length)
      return
    }
    if (event.key === 'Escape') { setIsSuggestionOpen(false); return }
    if (event.key !== 'Enter') return
    event.preventDefault()
    const localExact = findExactProductMatch(productResults, search)
    if (localExact) {
      addProductToReceipt(localExact.product, {
        productVariantId: localExact.productVariantId,
        mergeIdentity: true,
      })
      return
    }
    if (isSuggestionOpen && productResults[highlightedIndex]) {
      addProductToReceipt(productResults[highlightedIndex])
      return
    }
    await resolveProductSearch()
  }

  const handleOpenQuickSupplier = () => {
    if (isReadOnly) return
    setSupplierForm(createSupplierDraft(supplierQuery))
    setSupplierCodeTouched(false)
    setShowSupplierSearch(false)
    setShowSupplierModal(true)
  }

  const handleSelectSupplier = (supplier: any) => {
    if (isReadOnly) return
    setSupplierId(supplier.id)
    setSupplierQuery(supplier.name ?? '')
    setShowSupplierSearch(false)
  }

  const createSupplierMutation = useMutation({
    mutationFn: async (payload: SupplierQuickForm) => {
      const response = await stockApi.createSupplier(payload)
      return response.data?.data ?? response.data
    },
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setSupplierId(supplier.id)
      setSupplierQuery(supplier.name ?? '')
      setShowSupplierModal(false)
      toast.success('Đã thêm nhà cung cấp mới.')
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
          (isEditMode ? 'Không thể lưu cập nhật phiếu nhập.' : 'Lỗi khi tạo phiếu nhập.'),
      )
    },
  })

  const handleSaveQuickSupplier = () => {
    if (isReadOnly) return
    if (!supplierForm.name.trim()) {
      toast.error('Vui lòng nhập tên nhà cung cấp.')
      return
    }
    createSupplierMutation.mutate({
      code: normalizeBranchCode(supplierForm.code || suggestBranchCodeFromName(supplierForm.name)),
      name: supplierForm.name.trim(),
      phone: supplierForm.phone.trim(),
      email: supplierForm.email.trim(),
      address: supplierForm.address.trim(),
      notes: supplierForm.notes.trim(),
    })
  }

  const handleStartEditing = () => {
    if (!isExistingReceipt || isReceiptLocked || !canUpdateReceipt) return
    setEditBaseSignature(currentDraftSignature)
    setIsEditingSession(true)
  }

  const payMutation = useMutation({
    mutationFn: (payload: ReceiptPaymentFormState) =>
      stockApi.payReceipt(resolvedReceiptId, {
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        notes: payload.notes.trim() || undefined,
        branchId: branchId || undefined,
      }),
    onSuccess: async (response) => {
      const nextReceipt = response?.data?.data ?? response?.data ?? null
      syncCurrentReceiptQueries(nextReceipt)
      await refetchCurrentReceiptQueries()
      toast.success('Đã ghi nhận thanh toán cho phiếu nhập.')
      setShowPaymentModal(false)
      invalidateCurrentReceiptQueries()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
          (isEditMode ? 'Không thể lưu cập nhật phiếu nhập.' : 'Lỗi khi tạo phiếu nhập.'),
      )
    },
  })

  const receiveMutation = useMutation({
    mutationFn: () => stockApi.receiveReceipt(resolvedReceiptId),
    onSuccess: async (response) => {
      const nextReceipt = response?.data?.data ?? response?.data ?? null
      syncCurrentReceiptQueries(nextReceipt)
      await refetchCurrentReceiptQueries()
      toast.success('Đã xác nhận nhập kho cho phiếu nhập.')
      invalidateCurrentReceiptQueries()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
          (isEditMode ? 'Không thể lưu cập nhật phiếu nhập.' : 'Lỗi khi tạo phiếu nhập.'),
      )
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockApi.cancelReceipt(resolvedReceiptId),
    onSuccess: async (response) => {
      const nextReceipt = response?.data?.data ?? response?.data ?? null
      syncCurrentReceiptQueries(nextReceipt)
      await refetchCurrentReceiptQueries()
      toast.success('Đã hủy phiếu nhập.')
      invalidateCurrentReceiptQueries()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
          (isEditMode ? 'Không thể lưu cập nhật phiếu nhập.' : 'Lỗi khi tạo phiếu nhập.'),
      )
    },
  })

  const returnMutation = useMutation({
    mutationFn: (payload: ReceiptReturnFormState) =>
      stockApi.returnReceipt(resolvedReceiptId, {
        notes: payload.notes.trim() || undefined,
        items: payload.items
          .filter((item) => item.quantity > 0)
          .map((item) => ({
            receiptItemId: item.receiptItemId,
            productId: item.productId,
            productVariantId: item.productVariantId || undefined,
            quantity: item.quantity,
            reason: payload.notes.trim() || undefined,
          })),
      }),
    onSuccess: async (response) => {
      const nextReceipt = response?.data?.data ?? response?.data ?? null
      syncCurrentReceiptQueries(nextReceipt)
      await refetchCurrentReceiptQueries()
      toast.success('Đã ghi nhận hoàn trả cho phiếu nhập.')
      setShowReturnModal(false)
      invalidateCurrentReceiptQueries()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Không thể ghi nhận hoàn trả.')
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ mode }: { mode: SubmitMode }) => {
      const nextEditSession =
        isExistingReceipt && isEditMode && isEditingSession && hasPendingReceiptChanges
          ? {
              id: `edit-session-${Date.now()}`,
              editedAt: new Date().toISOString(),
              editedBy: user?.fullName || user?.username || 'Chưa xác định',
              itemCount: items.length,
              totalQuantity,
            }
          : null
      const nextEditSessions = nextEditSession ? [...editSessions, nextEditSession] : editSessions
      const payload = {
        supplierId: supplierId || undefined,
        branchId,
        notes: buildReceiptNotes(notes, {
          discount: discountAmount,
          tax: taxAmount,
          extraCosts,
          editSessions: nextEditSessions,
        }),
        items: items.map((item) => ({
          receiptItemId: item.receiptItemId || undefined,
          productId: item.productId,
          productVariantId: item.productVariantId || undefined,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      }
      if (isExistingReceipt && isEditMode) {
        const response = await stockApi.updateReceipt(resolvedReceiptId, payload)
        const receiptData = response.data?.data || response.data || {}
        return {
          receiptId: getReceiptRedirectId(receiptData, receiptId),
          mode,
          action: 'update' as const,
          nextEditSessions,
          receiptData,
        }
      }
      const response = await stockApi.createReceipt(payload)
      const receiptData = response.data?.data || response.data || {}
      const nextReceiptId = getReceiptRedirectId(receiptData, response.data?.id)
      if (!nextReceiptId) throw new Error('Không nhận được mã phiếu nhập từ hệ thống.')
      return { receiptId: nextReceiptId, mode, action: 'create' as const, nextEditSessions, receiptData }
    },
    onSuccess: ({ receiptId, action, nextEditSessions, receiptData }) => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      syncCurrentReceiptQueries(receiptData)
      invalidateCurrentReceiptQueries()
      if (receiptId) {
        queryClient.invalidateQueries({ queryKey: ['receipt', receiptId] })
      }
      setEditSessions(nextEditSessions)
      setEditBaseSignature(currentDraftSignature)
      setIsEditingSession(false)
      toast.success(action === 'update' ? 'Đã lưu cập nhật danh sách sản phẩm.' : 'Đã tạo đơn nhập thành công.')
      if (action === 'update') {
        router.replace(`/inventory/receipts/${receiptId}`)
        return
      }
      router.push(`/inventory/receipts/${receiptId}`)
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
          (isEditMode ? 'Không thể lưu cập nhật phiếu nhập.' : 'Lỗi khi tạo phiếu nhập.'),
      )
    },
  })

  const handleSubmit = (mode: SubmitMode) => {
    if (!canSubmitReceipt) {
      toast.error(
        isEditMode
          ? 'Bạn không có quyền cập nhật phiếu nhập.'
          : 'Bạn không có quyền tạo phiếu nhập.',
      )
      return
    }
    if (!branchId) {
      toast.error('Vui lòng chọn chi nhánh nhận hàng.')
      return
    }
    if (!supplierId) {
      toast.error('Vui lòng chọn nhà cung cấp.')
      return
    }
    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm.')
      return
    }
    if (isExistingReceipt && isEditMode && !hasPendingReceiptChanges) {
      toast.info('Chưa có thay đổi để lưu cập nhật.')
      return
    }
    saveMutation.mutate({ mode })
  }

  // ── Guards ───────────────────────────────────────────────────────────────────

  const handleConfirmPayment = () => {
    if (!resolvedReceiptId) {
      toast.error('Không xác định được phiếu nhập cần thanh toán.')
      return
    }
    if (paymentForm.amount <= 0) {
      toast.error('Vui lòng nhập số tiền thanh toán lớn hơn 0.')
      return
    }
    if (paymentForm.amount > currentDebt) {
      toast.error('Số tiền thanh toán không được vượt quá công nợ hiện tại.')
      return
    }
    payMutation.mutate(paymentForm)
  }

  const handleReturnItemQuantityChange = (receiptItemId: string, quantity: number) => {
    setReturnForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.receiptItemId === receiptItemId
          ? {
              ...item,
              quantity: Math.min(item.availableQty, Math.max(0, Math.floor(quantity || 0))),
            }
          : item,
      ),
    }))
  }

  const handleConfirmReturn = () => {
    if (!resolvedReceiptId) {
      toast.error('Không xác định được phiếu nhập cần hoàn trả.')
      return
    }
    if (!returnForm.items.some((item) => item.quantity > 0)) {
      toast.error('Vui lòng chọn ít nhất một dòng hàng để hoàn trả.')
      return
    }
    returnMutation.mutate(returnForm)
  }

  if (isAuthLoading || (isExistingReceipt && isReceiptLoading)) {
    return (
      <div className="flex h-64 items-center justify-center text-foreground-muted text-sm">
        Đang kiểm tra quyền truy cập...
      </div>
    )
  }
  if (!canAccessScreen) {
    return (
      <div className="flex h-64 items-center justify-center text-foreground-muted text-sm">
        Đang chuyển hướng...
      </div>
    )
  }

  // Column layout:  del | stt | img | mã  | tên+ghi-chú | đvt | tồn | sl | đgiá | giảm | tiền
  if (isExistingReceipt && !receipt) {
    return (
      <ReceiptWorkspace>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-error">
          Không tìm thấy phiếu nhập.
        </div>
      </ReceiptWorkspace>
    )
  }

  const cols = '36px 36px 52px 96px 1fr 64px 80px 112px 112px 88px 108px'
  const allLinesSelected = items.length > 0 && selectedLineIds.length === items.length
  const creatorDisplayName =
    receipt?.createdBy?.fullName ||
    receipt?.createdBy?.username ||
    receipt?.createdBy?.name ||
    user?.fullName ||
    user?.username ||
    'Chưa xác định'
  const statusView = getReceiptStatusView(receipt)
  const allocation: any = { payment: { transaction: null } }
  const activityTimeline = [
    {
      title: 'Tạo phiếu đặt hàng',
      detail: `Người tạo: ${creatorDisplayName}`,
      time: receipt?.createdAt ? formatReceiptDateTime(receipt.createdAt) : dayjs().format('DD/MM/YYYY HH:mm'),
      tone: 'text-primary-500',
      linkLabel: allocation.payment?.transaction?.voucherNumber
        ? `Phiếu chi: ${allocation.payment.transaction.voucherNumber}`
        : null,
      href: allocation.payment?.transaction?.voucherNumber
        ? `/finance/${encodeURIComponent(allocation.payment.transaction.voucherNumber)}`
        : null,
    },
    ...editSessions
      .slice()
      .sort((left, right) => new Date(right.editedAt).getTime() - new Date(left.editedAt).getTime())
      .map((session) => ({
        title: 'Cập nhật sản phẩm',
        detail: `${session.itemCount} mặt hàng • ${session.totalQuantity} số lượng`,
        time: `${formatReceiptDateTime(session.editedAt)} • ${session.editedBy}`,
        tone: 'text-foreground',
      })),
  ]
  const activityTimelineEntries = activityTimeline
  const paymentHistoryEntries = (receipt?.paymentAllocations ?? [])
    .slice()
    .sort(
      (left: any, right: any) =>
        new Date(right?.payment?.paidAt ?? 0).getTime() - new Date(left?.payment?.paidAt ?? 0).getTime(),
    )
    .map((allocation: any) => ({
      title: 'Thanh toán',
      detail: [
        `${fmt(Number(allocation.amount ?? 0))} đ`,
        getPaymentMethodLabel(allocation.payment?.paymentMethod),
      ]
        .filter(Boolean)
        .join(' • '),
      time: `${formatReceiptDateTime(allocation.payment?.paidAt ?? receipt?.paymentDate ?? receipt?.updatedAt)}${
        allocation.payment?.staff?.fullName ? ` • ${allocation.payment.staff.fullName}` : ''
      }`,
      tone: 'text-primary-500',
    }))
  const paymentTimelineEntries = paymentHistoryEntries.map((entry: any, index: number) => {
    const linkedAllocation = (receipt?.paymentAllocations ?? [])
      .slice()
      .sort(
        (left: any, right: any) =>
          new Date(right?.payment?.paidAt ?? 0).getTime() - new Date(left?.payment?.paidAt ?? 0).getTime(),
      )[index]
    const voucherNumber = linkedAllocation?.payment?.transactionVoucherNumber || null

    return {
      ...entry,
      linkLabel: voucherNumber ? `Phiếu chi: ${voucherNumber}` : null,
      href: voucherNumber ? `/finance/${encodeURIComponent(voucherNumber)}` : null,
    }
  })
  const fallbackPaymentEntries =
    paymentTimelineEntries.length === 0 && hasAnyPayment
      ? [
          {
            title: isFullyPaid ? 'Đã thanh toán' : 'Thanh toán 1 phần',
            detail: [
              `${fmt(currentReceiptPaidAmount)} đ`,
              receipt?.paymentMethod ? getPaymentMethodLabel(receipt.paymentMethod) : null,
            ]
              .filter(Boolean)
              .join(' • '),
            time: formatReceiptDateTime(receipt?.paymentDate ?? receipt?.updatedAt),
            tone: 'text-primary-500',
          },
        ]
      : []
  const receiveHistoryEntries = (receipt?.receiveEvents ?? [])
    .slice()
    .sort(
      (left: any, right: any) =>
        new Date(right?.receivedAt ?? 0).getTime() - new Date(left?.receivedAt ?? 0).getTime(),
    )
    .map((event: any) => ({
      title: 'Nhập kho',
      detail: `${Number(event.totalQuantity ?? 0)} số lượng • ${fmt(Number(event.totalAmount ?? 0))} đ`,
      time: `${formatReceiptDateTime(event.receivedAt)}${event.staff?.fullName ? ` • ${event.staff.fullName}` : ''}`,
      tone: 'text-sky-500',
    }))
  const fallbackReceiveEntries =
    receiveHistoryEntries.length === 0 && hasAnyReceive
      ? [
          {
            title: isReceiveDone ? 'Đã nhập kho' : 'Nhập kho 1 phần',
            detail: `${Math.max(0, Number(receipt?.receivedQty ?? 0))} số lượng`,
            time: formatReceiptDateTime(receipt?.receivedAt ?? receipt?.completedAt ?? receipt?.updatedAt),
            tone: 'text-sky-500',
          },
        ]
      : []
  const returnHistoryEntries = (receipt?.supplierReturns ?? [])
    .slice()
    .sort(
      (left: any, right: any) =>
        new Date(right?.returnedAt ?? 0).getTime() - new Date(left?.returnedAt ?? 0).getTime(),
    )
    .map((supplierReturn: any) => ({
      title: 'Hoàn trả nhà cung cấp',
      detail: `${fmt(Number(supplierReturn.totalAmount ?? 0))} đ • ${Number(
        supplierReturn.items?.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0) ?? 0,
      )} số lượng`,
      time: formatReceiptDateTime(supplierReturn.returnedAt),
      tone: 'text-orange-400',
    }))
  const hasAnyReturn =
    Number(receipt?.returnedQty ?? 0) > 0 ||
    receipt?.receiptStatus === 'RETURNED' ||
    returnHistoryEntries.length > 0
  const terminalProgressStep = isCancelled
    ? {
        title: 'Hủy',
        meta: formatReceiptDateTime(receipt?.updatedAt),
        state: 'alert',
      }
    : hasAnyReturn
      ? {
          title: 'Hoàn trả',
          meta: returnHistoryEntries[0]?.time ?? formatReceiptDateTime(receipt?.updatedAt),
          state: 'alert',
        }
      : {
          title: 'Hoàn trả',
          meta: '—',
          state: 'hidden',
        }
  const enhancedActivityTimelineEntries = [
    ...activityTimelineEntries,
    ...paymentTimelineEntries,
    ...fallbackPaymentEntries,
    ...receiveHistoryEntries,
    ...fallbackReceiveEntries,
    ...returnHistoryEntries,
  ]
  const progressSteps = [
    {
      title: 'Đặt hàng',
      meta: receipt?.createdAt ? formatReceiptDateTime(receipt.createdAt) : '—',
      state: receipt ? 'completed' : 'active',
    },
    {
      title: 'Thanh toán',
      meta: hasAnyPayment
        ? formatReceiptDateTime(receipt?.paymentDate ?? receipt?.updatedAt)
        : '—',
      state: isFullyPaid ? 'completed' : hasAnyPayment ? 'active' : 'pending',
    },
    {
      title: 'Nhập kho',
      meta: hasAnyReceive
        ? formatReceiptDateTime(receipt?.receivedAt ?? receipt?.completedAt ?? receipt?.updatedAt)
        : '—',
      state: isReceiveDone ? 'completed' : hasAnyReceive ? 'active' : 'pending',
    },
    terminalProgressStep,
  ] as const
  const visibleProgressSteps = progressSteps.filter((step) => step.state !== 'hidden')
  const canShowPaymentAction =
    isExistingReceipt && canPayReceipt && !isCancelled && !isCompleted && currentDebt > 0
  const canShowReceiveAction =
    isExistingReceipt &&
    canReceiveReceipt &&
    !isCancelled &&
    !isCompleted &&
    !isReceiveDone
  const canShowCancelAction =
    isExistingReceipt &&
    canCancelReceipt &&
    !isCancelled &&
    !hasAnyPayment &&
    !hasAnyReceive
  const canShowReturnAction =
    isExistingReceipt && canReturnReceipt && isCompleted && returnableReceiptItems.length > 0

  // ── Print / Export handlers ───────────────────────────────────────────────────
  const handleDuplicateReceipt = () => {
    if (!supplierId || items.length === 0) {
      toast.error('Đơn nhập cần có nhà cung cấp và ít nhất một sản phẩm để sao chép.')
      return
    }

    const draftPayload: SupplierQuickDraftPayload = {
      supplierId,
      notes,
      items: items.map((item) => ({
        productId: item.productId,
        productVariantId: item.productVariantId ?? null,
        name: item.name,
        sku: item.sku ?? item.baseSku ?? null,
        unit: item.unit ?? item.baseUnit ?? null,
        quantity: Math.max(1, Number(item.quantity ?? 1)),
        unitCost: Math.max(0, Number(item.unitCost ?? 0)),
      })),
    }

    window.localStorage.setItem(SUPPLIER_RECEIPT_DRAFT_KEY, JSON.stringify(draftPayload))
    window.open('/inventory/receipts/new', '_blank', 'noopener,noreferrer')
  }

  const handlePrintReceipt = (type: 'a4' | 'k80' | 'pdf') => {
    const isK80 = type === 'k80'
    const pageWidth = isK80 ? '80mm' : '210mm'
    const supplierName = displaySupplier?.name ?? '—'
    const supplierPhone = displaySupplier?.phone ?? '—'
    const receiptCode = receipt?.receiptNumber ?? receipt?.id ?? resolvedReceiptId ?? '—'
    const createdAt = receipt?.createdAt ? dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm') : '—'
    const branchName = currentBranch?.name ?? '—'
    const statusLabel = statusView.label

    const rowsHtml = items
      .map(
        (item, idx) => `
        <tr>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;">${idx + 1}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;">${item.name}${item.variantName ? ` (${item.variantName})` : ''}${item.sku ? `<br><small style="color:#999">${item.sku}</small>` : ''}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.unit ?? '—'}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.quantity}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.unitCost.toLocaleString('vi-VN')}</td>
          ${item.discount > 0 ? `<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.discount.toLocaleString('vi-VN')}</td>` : `<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">—</td>`}
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${(item.quantity * item.unitCost).toLocaleString('vi-VN')}</td>
        </tr>`,
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>Phiếu nhập ${receiptCode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: ${isK80 ? '10px' : '12px'}; color: #111; width: ${pageWidth}; margin: 0 auto; padding: ${isK80 ? '8px' : '20px'}; }
    h1 { font-size: ${isK80 ? '13px' : '18px'}; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: ${isK80 ? '9px' : '11px'}; color: #666; margin-bottom: ${isK80 ? '8px' : '16px'}; }
    .meta span { margin-right: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: ${isK80 ? '8px' : '16px'}; font-size: ${isK80 ? '9px' : '11px'}; }
    .info-block label { display: block; color: #888; margin-bottom: 2px; }
    .info-block span { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: ${isK80 ? '8px' : '16px'}; }
    thead th { background: #f5f5f5; padding: 5px 6px; text-align: left; font-size: ${isK80 ? '9px' : '11px'}; border-bottom: 2px solid #ddd; }
    thead th:nth-child(n+3) { text-align: right; }
    .totals { margin-left: auto; width: ${isK80 ? '100%' : '260px'}; font-size: ${isK80 ? '10px' : '12px'}; }
    .totals tr td { padding: 3px 6px; }
    .totals tr td:last-child { text-align: right; }
    .totals .grand td { font-size: ${isK80 ? '12px' : '15px'}; font-weight: 700; padding-top: 8px; border-top: 2px solid #111; }
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: ${isK80 ? '9px' : '11px'}; font-weight: 600; background: #eff6ff; color: #2563eb; margin-bottom: ${isK80 ? '6px' : '10px'}; }
    .footer { margin-top: ${isK80 ? '10px' : '24px'}; font-size: ${isK80 ? '9px' : '11px'}; color: #999; border-top: 1px dashed #ddd; padding-top: 8px; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>PHIẾU NHẬP HÀNG</h1>
    <span>Mã: <strong>${receiptCode}</strong></span>
    <span>Ngày: ${createdAt}</span>
    <span>Chi nhánh: ${branchName}</span>
  </div>
  <div class="status-badge">${statusLabel}</div>
  <div class="info-grid">
    <div class="info-block">
      <label>Nhà cung cấp</label>
      <span>${supplierName}</span>
    </div>
    <div class="info-block">
      <label>Điện thoại NCC</label>
      <span>${supplierPhone}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Sản phẩm</th>
        <th>ĐVT</th>
        <th>SL</th>
        <th>Đơn giá</th>
        <th>Giảm giá</th>
        <th>Thành tiền</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <table class="totals">
    <tr><td>Tổng hàng hóa</td><td>${merchandiseTotal.toLocaleString('vi-VN')} đ</td></tr>
    ${receiptDiscount > 0 ? `<tr><td>Giảm giá</td><td>-${discountAmount.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    ${receiptTax > 0 ? `<tr><td>Thuế</td><td>+${taxAmount.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    <tr class="grand"><td>Cần trả NCC</td><td>${grandTotal.toLocaleString('vi-VN')} đ</td></tr>
    ${currentDebt > 0 ? `<tr><td>Còn nợ</td><td style="color:#e11d48">${currentDebt.toLocaleString('vi-VN')} đ</td></tr>` : ''}
  </table>
  ${notes ? `<div style="margin-top:8px;font-size:${isK80 ? '9px' : '11px'};color:#555;">Ghi chú: ${notes}</div>` : ''}
  <div class="footer">In lúc ${dayjs().format('DD/MM/YYYY HH:mm')} • Phần mềm Petshop</div>
</body>
</html>`

    const win = window.open('', '_blank', `width=800,height=700`)
    if (!win) {
      toast.error('Trình duyệt chặn popup. Vui lòng cho phép popup để in/xuất.')
      return
    }
    win.document.write(html)
    win.document.close()
    win.onload = () => {
      win.focus()
      win.print()
    }
  }

  const handleExportExcel = async () => {
    const receiptCode = receipt?.receiptNumber ?? receipt?.id ?? resolvedReceiptId ?? 'phieu-nhap'
    const supplierName = displaySupplier?.name ?? ''
    const createdAt = receipt?.createdAt ? dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm') : ''

    const headerRows: Array<Array<string | number | null>> = [
      ['PHIẾU NHẬP HÀNG'],
      ['Mã phiếu:', receiptCode, '', 'Nhà cung cấp:', supplierName],
      ['Ngày tạo:', createdAt, '', 'Chi nhánh:', currentBranch?.name ?? ''],
      ['Trạng thái:', statusView.label],
      [],
    ]

    const colHeaders = ['#', 'Mã SP (SKU)', 'Tên sản phẩm', 'Phiên bản', 'Đơn vị', 'Số lượng', 'Đơn giá nhập', 'Giảm giá', 'Thành tiền']

    const itemRows: Array<Array<string | number | null>> = items.map((item, idx) => [
      idx + 1,
      item.sku ?? '',
      item.name,
      item.variantName ?? '',
      item.unit ?? '',
      item.quantity,
      item.unitCost,
      item.discount,
      item.quantity * item.unitCost,
    ])

    const summaryRows: Array<Array<string | number | null>> = [
      [],
      ['', '', '', '', '', '', '', 'Tổng hàng hóa', merchandiseTotal],
      ...(receiptDiscount > 0 ? [['', '', '', '', '', '', '', 'Giảm giá', -discountAmount]] : []),
      ...(receiptTax > 0 ? [['', '', '', '', '', '', '', 'Thuế', taxAmount]] : []),
      ['', '', '', '', '', '', '', 'Cần trả NCC', grandTotal],
      ...(currentDebt > 0 ? [['', '', '', '', '', '', '', 'Còn nợ', currentDebt]] : []),
    ]

    const wsData = [...headerRows, colHeaders, ...itemRows, ...summaryRows]
    const fileName = `phieu-nhap-${receiptCode}-${dayjs().format('YYYYMMDD')}.xlsx`
    await exportAoaToExcel(wsData, 'Phiếu nhập', fileName, [8, 14, 36, 16, 10, 10, 16, 14, 16])
    toast.success(`Đã xuất file ${fileName}`)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ReceiptWorkspace>
      <QuickSupplierModal
        isOpen={showSupplierModal}
        form={supplierForm}
        isSaving={createSupplierMutation.isPending}
        onClose={() => {
          setShowSupplierModal(false)
          setSupplierCodeTouched(false)
        }}
        onChange={(field, value) =>
          setSupplierForm((current) => {
            if (field === 'name') {
              return {
                ...current,
                name: value,
                code: supplierCodeTouched ? current.code : suggestBranchCodeFromName(value),
              }
            }

            if (field === 'code') {
              setSupplierCodeTouched(true)
              return {
                ...current,
                code: normalizeBranchCode(value),
              }
            }

            return { ...current, [field]: value }
          })
        }
        onSave={handleSaveQuickSupplier}
      />
      <ReceiptPaymentModal
        isOpen={showPaymentModal}
        form={paymentForm}
        debtAmount={currentDebt}
        isPending={payMutation.isPending}
        onClose={() => {
          if (payMutation.isPending) return
          setShowPaymentModal(false)
        }}
        onChange={(field, value) =>
          setPaymentForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onConfirm={handleConfirmPayment}
      />
      <ReceiptReturnModal
        isOpen={showReturnModal}
        form={returnForm}
        isPending={returnMutation.isPending}
        onClose={() => {
          if (returnMutation.isPending) return
          setShowReturnModal(false)
        }}
        onChangeNotes={(value) =>
          setReturnForm((current) => ({
            ...current,
            notes: value,
          }))
        }
        onChangeQuantity={handleReturnItemQuantityChange}
        onConfirm={handleConfirmReturn}
      />
      <div className="shrink-0 border-b border-border bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0))]">
        <div className="grid gap-3 px-5 py-4 xl:grid-cols-[minmax(240px,0.68fr)_minmax(420px,1.04fr)_minmax(560px,1.34fr)_minmax(220px,0.48fr)]">
          <div className="flex items-start gap-3">
            <Link
              href="/inventory/receipts"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-foreground">
                {isEditMode ? 'Cập nhật phiếu nhập' : 'Tạo phiếu nhập'}
              </div>
              <div className="hidden mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                  <Building2 size={12} className="text-primary-500" />
                  {displaySupplier?.name || 'Chưa chọn nhà cung cấp'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                  <CalendarDays size={12} className="text-primary-500" />
                  {currentBranch?.name || 'Chưa chọn chi nhánh nhận hàng'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                  <Info size={12} className="text-primary-500" />
                  {items.length} mặt hàng • {totalQuantity} số lượng
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-start gap-3">
                <div ref={supplierPanelRef} className="relative min-w-[320px] flex-1">
                  {displaySupplier ? (
                    <div className="flex h-11 items-center justify-between rounded-xl border border-border bg-background px-3">
                      <a
                        href={displaySupplier.code ? `/inventory/suppliers/${displaySupplier.code}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="group min-w-0 hover:opacity-80 transition-opacity cursor-pointer"
                        onClick={(e) => {
                          if (!displaySupplier.code) e.preventDefault()
                        }}
                      >
                        <div className="truncate text-sm font-semibold text-foreground group-hover:text-primary-500 transition-colors">
                          {displaySupplier.name}
                        </div>
                        <div className="truncate text-[11px] text-foreground-muted">
                          {displaySupplier.code ? displaySupplier.code : displaySupplier.phone || 'Nhà cung cấp đã chọn'}
                        </div>
                      </a>
                      {!isReadOnly ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSupplierId('')
                            setSupplierQuery('')
                          }}
                          className="ml-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-error/10 hover:text-error"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <Building2
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                      />
                      <input
                        type="text"
                        className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-10 text-sm text-foreground placeholder:text-foreground-muted outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                        placeholder="Tìm nhà cung cấp"
                        value={supplierQuery}
                        onChange={(e) => {
                          setSupplierQuery(e.target.value)
                          setShowSupplierSearch(true)
                        }}
                        onFocus={() => setShowSupplierSearch(true)}
                        disabled={isReadOnly}
                      />
                      <button
                        type="button"
                        onClick={handleOpenQuickSupplier}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-secondary hover:text-primary-500"
                        title="Thêm nhà cung cấp nhanh"
                      >
                        <UserPlus size={14} />
                      </button>

                      {showSupplierSearch ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                          <div className="max-h-72 overflow-y-auto custom-scrollbar">
                            {filteredSuppliers.map((supplier: any) => (
                              <button
                                key={supplier.id}
                                type="button"
                                className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-background-secondary"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelectSupplier(supplier)}
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
                                  <Building2 size={15} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    {supplier.name}
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-muted">
                                    {supplier.phone ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Phone size={11} />
                                        {supplier.phone}
                                      </span>
                                    ) : (
                                      <span>Không có SĐT</span>
                                    )}
                                  </div>
                                </div>
                                {Number(supplier.debt ?? 0) > 0 ? (
                                  <div className="text-right text-[11px] font-semibold text-error">
                                    {fmt(Number(supplier.debt ?? 0))}
                                  </div>
                                ) : null}
                              </button>
                            ))}

                            {supplierQuery.trim() && filteredSuppliers.length === 0 ? (
                              <div className="space-y-3 px-3 py-4">
                                <div className="text-sm text-foreground-muted">
                                  Không tìm thấy nhà cung cấp phù hợp
                                </div>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={handleOpenQuickSupplier}
                                  className="btn-primary w-full justify-center rounded-xl py-2 text-sm"
                                >
                                  <Plus size={14} />
                                  Thêm nhanh &quot;{supplierQuery.trim()}&quot;
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <select
                  className="hidden h-11 min-w-[220px] rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">Chọn chi nhánh nhận hàng</option>
                  {allowedBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                {selectedSupplier ? (
                  <button
                    type="button"
                    onClick={applyLatestSupplierPricesToItems}
                    className="hidden h-11 items-center gap-2 rounded-xl border border-primary-500/30 bg-primary-500/10 px-4 text-sm font-semibold text-primary-500 transition-colors hover:border-primary-500/50 hover:bg-primary-500/15"
                  >
                    <History size={14} />
                    Áp giá NCC gần nhất
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground-muted">
                  {displaySupplier?.phone || 'Chưa có SĐT nhà cung cấp'}
                </span>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground-muted">
                  {displaySupplier?.code || 'Mã NCC: Tự động'}
                </span>
                {currentDebt > 0 ? (
                  <span className="rounded-full border border-error/20 bg-error/10 px-3 py-1 text-xs font-semibold text-error">
                    Nợ NCC: {fmt(currentDebt)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 flex flex-col justify-center">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                    Mã đơn nhập
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {receipt?.receiptNumber || 'Tự động tạo khi lưu phiếu'}
                    </span>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusView.toneClass}`}>
                      {statusView.label}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                    Nhân viên
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {creatorDisplayName}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Chi nhánh nhận hàng
                </div>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={isReadOnly}
                >
                  <option value="">Chọn chi nhánh nhận hàng</option>
                  {allowedBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <div className="hidden mt-2 text-xs text-foreground-muted">
                  {currentBranch?.name || 'Chưa chọn chi nhánh'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/80 px-6 py-4">
            <div className="hidden mb-2 items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
              <span>Tiến trình đơn nhập</span>
              <span>Giai đoạn 1/4</span>
            </div>
            <div className="grid h-full w-full grid-flow-col auto-cols-max items-stretch justify-between gap-4">
              {visibleProgressSteps.map((step, index) => (
                <div
                  key={`${step.title}-${index}`}
                  className="relative flex min-w-0 flex-col items-center justify-center gap-1.5 py-2 text-center"
                >
                  <div className="relative flex w-full justify-center px-1">
                    <div
                      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                        step.state === 'alert'
                          ? 'border-rose-500/50 bg-rose-500/12 text-rose-300'
                          : step.state === 'completed' || step.state === 'active'
                            ? 'border-primary-500/50 bg-primary-500/10 text-primary-500'
                            : 'border-border bg-background text-foreground-muted'
                      }`}
                    >
                      {index + 1}
                    </div>
                    {index < visibleProgressSteps.length - 1 ? (
                      <div
                        className={`absolute left-1/2 top-1/2 h-px w-[calc(100%+0.75rem)] -translate-y-1/2 ${
                          visibleProgressSteps[index + 1]?.state === 'alert'
                            ? 'bg-rose-500/35'
                            : step.state === 'completed'
                              ? 'bg-primary-500/50'
                              : 'bg-border'
                        }`}
                      />
                    ) : null}
                  </div>
                  <div className="flex min-h-[56px] flex-col items-center justify-center space-y-1">
                    <div className={`text-[13px] font-semibold ${step.state === 'alert' ? 'text-rose-300' : 'text-foreground'}`}>{step.title}</div>
                    <div className={`whitespace-nowrap text-[11px] leading-4 ${step.state === 'alert' ? 'text-rose-200/85' : 'text-foreground-muted'}`}>{step.meta}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
              <span>Tiến trình đơn nhập</span>
              <span>Giai đoạn 1/4</span>
            </div>
            <div className="hidden mt-3 grid-cols-2 gap-2 sm:grid-cols-4">
              {['Tạo đơn', 'Thanh toán', 'Nhập kho', 'Hoàn tất'].map((step, index) => (
                <div
                  key={step}
                  className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold transition-colors ${
                    index === 0
                      ? 'border-primary-500/40 bg-primary-500/10 text-primary-600'
                      : 'border-border bg-background text-foreground-muted'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-[0.16em]">
                    Bước {index + 1}
                  </div>
                  <div className="mt-1">{step}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-w-[220px] flex-col gap-2 xl:items-end xl:justify-center">
            <div className="hidden flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground-muted">
                Mã đặt hàng nhập: Tự động
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
                Đặt hàng
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground-muted">
                {dayjs().format('DD/MM/YYYY HH:mm')}
              </span>
              {currentDebt > 0 ? (
                <span className="rounded-full border border-error/20 bg-error/10 px-3 py-1 text-xs font-semibold text-error">
                  Nợ NCC: {fmt(currentDebt)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 xl:items-end">
              {isCreateMode ? (
                <button
                  type="button"
                  onClick={() => handleSubmit('draft')}
                  disabled={saveMutation.isPending || items.length === 0 || !branchId}
                  className="btn-primary min-w-[220px] justify-center rounded-xl py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Đang xử lý...' : 'Tạo đơn nhập'}
                </button>
              ) : null}
              {canShowPaymentAction ? (
                <button
                  type="button"
                  onClick={openPaymentModal}
                  disabled={
                    payMutation.isPending ||
                    !resolvedReceiptId ||
                    currentDebt <= 0 ||
                    receipt?.status === 'CANCELLED'
                  }
                  className="btn-primary min-w-[220px] justify-center rounded-xl py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {payMutation.isPending ? 'Đang xử lý...' : 'Thanh toán'}
                </button>
              ) : null}
              {canShowReceiveAction ? (
                <button
                  type="button"
                  onClick={() => receiveMutation.mutate()}
                  disabled={receiveMutation.isPending || !resolvedReceiptId}
                  className="btn-primary min-w-[220px] justify-center rounded-xl py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {receiveMutation.isPending ? 'Đang xử lý...' : 'Nhập kho'}
                </button>
              ) : null}
              {canShowCancelAction ? (
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending || !resolvedReceiptId}
                  className="btn-outline min-w-[220px] justify-center rounded-xl border-error/40 py-2.5 text-sm text-error disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Đang xử lý...' : 'Hủy phiếu'}
                </button>
              ) : null}
              {canShowReturnAction ? (
                <button
                  type="button"
                  onClick={openReturnModal}
                  disabled={returnMutation.isPending || !resolvedReceiptId}
                  className="inline-flex min-w-[220px] items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/12 px-4 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:border-amber-500/60 hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {returnMutation.isPending ? 'Đang xử lý...' : 'Hoàn trả'}
                </button>
              ) : null}

              {/* ── In / Xuất dropdown ── */}
              {resolvedReceiptId ? (
                <div className="hidden">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((v) => !v)}
                    className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-xl border border-border bg-background-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
                  >
                    <Printer size={15} />
                    In / Xuất đơn
                    <ChevronDown size={13} className={`ml-auto transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                      {/* Print group */}
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">In phiếu</div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false)
                          handlePrintReceipt('a4')
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                      >
                        <Printer size={14} className="text-foreground-muted" />
                        In khổ A4
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false)
                          handlePrintReceipt('k80')
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                      >
                        <Printer size={14} className="text-foreground-muted" />
                        In khổ K80 (nhiệt)
                      </button>

                      <div className="mx-3 my-1 border-t border-border" />

                      {/* Export group */}
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Xuất đơn</div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false)
                          handlePrintReceipt('pdf')
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                      >
                        <FileDown size={14} className="text-foreground-muted" />
                        Xuất PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false)
                          handleExportExcel()
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                      >
                        <FileSpreadsheet size={14} className="text-foreground-muted" />
                        Xuất Excel (.xlsx)
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="hidden text-xs text-foreground-muted">Chỉ lưu nháp ở giai đoạn này</div>
            <div className="hidden text-xs text-foreground-muted">
              Người tạo: {user?.fullName || user?.username || 'Chưa xác định'}
            </div>
          </div>
        </div>
      </div>
      {/* ─── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2.5">
        <div className="flex min-w-[180px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background-secondary text-primary-500">
            <Package2 size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Tìm sản phẩm</div>
            <div className="text-xs text-foreground-muted">Thêm hàng vào phiếu nhập</div>
          </div>
        </div>
        <Link
          href="/inventory/receipts"
          className="hidden items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary-500 transition-colors"
        >
          <ArrowLeft size={16} />
          Đặt hàng nhập
        </Link>

        {/* Search bar */}
        <div ref={searchPanelRef} className="relative max-w-lg flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm hàng hóa theo tên, mã, barcode (F3)"
            className="h-9 w-full rounded-lg border border-border bg-background-secondary pl-9 pr-9 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (productResults.length > 0) setIsSuggestionOpen(true)
            }}
            disabled={manualSearching || isReadOnly}
          />
          {manualSearching || isSearchingSuggestions ? (
            <div className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          ) : (
            <ScanSearch
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none"
            />
          )}

          {/* Suggestions dropdown */}
          {isSuggestionOpen && search.trim() && productResults.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {productResults.map((product: any, index: number) => (
                  <button
                    key={product.id}
                    type="button"
                    className={`flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-0 transition-colors ${
                      index === highlightedIndex
                        ? 'bg-primary-500/10 text-primary-600'
                        : 'hover:bg-background-secondary'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addProductToReceipt(product)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-tertiary">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package2 size={14} className="text-foreground-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{product.name}</div>
                      <div className="text-[11px] text-foreground-muted mt-0.5">
                        {product.sku || product.barcode || '—'}
                        {product.stock !== undefined && (
                          <span className="ml-2 text-primary-500 font-medium">
                            Tồn: {product.stock}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-foreground">
                        {fmt(Number(product.costPrice ?? 0))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>        <button
          type="button"
          onClick={() => {
            setScanMode((current) => !current)
            window.setTimeout(() => searchInputRef.current?.focus(), 10)
          }}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
            scanMode
              ? 'border-primary-500 bg-primary-500/10 text-primary-500'
              : 'border-border bg-background-secondary text-foreground-muted hover:text-foreground'
          }`}
          title="Bật để máy quét barcode tự cộng dòng liên tục"
        >
          <ScanSearch size={14} />
        </button>

        {isExistingReceipt ? (
          <button
            type="button"
            onClick={handleDuplicateReceipt}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background-secondary text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
            title="Copy đơn nhập"
            aria-label="Copy đơn nhập"
          >
            <Copy size={14} />
          </button>
        ) : null}

        {resolvedReceiptId ? (
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
            >
              <Printer size={15} />
              In / Xuất đơn
              <ChevronDown size={13} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">In phiếu</div>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false)
                    handlePrintReceipt('a4')
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                >
                  <Printer size={14} className="text-foreground-muted" />
                  In khổ A4
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false)
                    handlePrintReceipt('k80')
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                >
                  <Printer size={14} className="text-foreground-muted" />
                  In khổ K80 (nhiệt)
                </button>

                <div className="mx-3 my-1 border-t border-border" />

                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Xuất đơn</div>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false)
                    handlePrintReceipt('pdf')
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                >
                  <FileDown size={14} className="text-foreground-muted" />
                  Xuất PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false)
                    handleExportExcel()
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                >
                  <FileSpreadsheet size={14} className="text-foreground-muted" />
                  Xuất Excel (.xlsx)
                </button>
              </div>
            )}
          </div>
        ) : null}

        {isExistingReceipt && !isReceiptLocked && canUpdateReceipt ? (
          <button
            type="button"
            onClick={() => {
              if (isEditingSession) {
                handleSubmit('draft')
                return
              }
              handleStartEditing()
            }}
            disabled={
              isEditingSession
                ? saveMutation.isPending || !hasPendingReceiptChanges || items.length === 0 || !branchId
                : false
            }
            className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              isEditingSession
                ? 'bg-primary-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.25)]'
                : 'border border-border bg-background-secondary text-foreground hover:border-primary-500/30 hover:text-primary-500'
            }`}
          >
            {isEditingSession ? (saveMutation.isPending ? 'Đang lưu...' : 'Lưu cập nhật') : 'Cập nhật'}
          </button>
        ) : null}

        {selectedLineIds.length > 0 && !isReadOnly ? (
          <button
            type="button"
            onClick={removeSelectedItems}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 text-sm font-medium text-error transition-colors hover:bg-error/15"
          >
            <Trash2 size={14} />
            Xóa {selectedLineIds.length} dòng đã chọn
          </button>
        ) : null}

        <div className="hidden ml-auto items-center gap-2 text-xs text-foreground-muted">
          <span className="font-medium text-foreground">{user?.fullName || user?.username}</span>
          <span>·</span>
          <span>{dayjs().format('DD/MM/YYYY HH:mm')}</span>
        </div>
      </div>

      {/* ─── MAIN CONTENT ──────────────────────────────────────────────────────── */}
      <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── LEFT: Product Table ─────────────────────────────────────────────── */}
        <aside className="hidden min-h-0 flex-col border-r border-border bg-background-secondary/30">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Danh sách sản phẩm</div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {items.length} mặt hàng • {totalQuantity} số lượng
                </div>
              </div>
              <div className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-primary-600">
                {items.length}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background-secondary text-foreground-muted">
                  <Package2 size={22} />
                </div>
                <div className="text-sm font-medium text-foreground">Chưa có sản phẩm</div>
                <div className="text-xs text-foreground-muted">
                  Tìm kiếm ở thanh trên để thêm hàng vào phiếu nhập.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const snapshot = getVariantSnapshot(item)
                  const itemCode = snapshot.displaySku || snapshot.displayBarcode || '—'
                  const itemImage = snapshot.selectedVariant?.image || item.image
                  const lineAmount = item.quantity * item.unitCost - item.discount

                  return (
                    <div
                      key={item.lineId}
                      className="rounded-2xl border border-border bg-background px-3 py-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background-secondary">
                          {itemImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={itemImage}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package2 size={16} className="text-foreground-muted" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {item.name}
                          </div>
                          <div className="mt-1 truncate text-[11px] text-foreground-muted">
                            {itemCode}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-foreground-muted">
                            <span>SL: {item.quantity}</span>
                            <span>{fmt(lineAmount)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.lineId)}
                          disabled={hasLockedReceiptQuantity(item)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-error/10 hover:text-error"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Table header */}
          <div className="shrink-0 border-b border-border bg-background-secondary/60">
            <div
              className="grid items-center px-0 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted"
              style={{ gridTemplateColumns: cols }}
            >
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-background"
                  checked={allLinesSelected}
                  onChange={toggleSelectAllLines}
                  aria-label="Chọn tất cả sản phẩm"
                />
              </div>
              <div className="text-center">STT</div>
              <div className="text-center">Ảnh</div>
              <div className="pl-1">Mã hàng</div>
              <div>Tên hàng</div>
              <div className="text-center">ĐVT</div>
              <div className="text-center">Tồn kho</div>
              <div className="text-center">Số lượng</div>
              <div className="pr-1 text-right">Đơn giá</div>
              <div className="text-right">Giảm giá</div>
              <div className="pr-4 text-right">Thành tiền</div>
            </div>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground-muted">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background-secondary border border-border">
                  <Package2 size={28} className="opacity-40" />
                </div>
                <p className="text-sm font-medium">Chưa có hàng hóa trong đơn</p>
                <p className="text-xs text-foreground-muted">
                  Dùng thanh tìm kiếm phía trên để thêm sản phẩm
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item, idx) => {
                  const lineAmount = item.quantity * item.unitCost - item.discount
                  const isEditingNote = editingNoteForId === item.lineId
                  const variants = item.variants ?? []
                  const trueVariants = getTrueVariants(variants)
                  const snapshot = getVariantSnapshot(item)
                  const currentVariant = snapshot.selectedVariant
                  const isCurrentConversion = isConversionVariant(currentVariant)
                  const currentTrueVariant = currentVariant
                    ? findParentTrueVariant(variants, currentVariant)
                    : (trueVariants[0] ?? null)
                  const conversionVariants = getConversionVariants(variants, currentTrueVariant)
                  const itemCode = snapshot.displaySku || snapshot.displayBarcode || '—'
                  const unitLabel =
                    currentVariant && isConversionVariant(currentVariant)
                      ? getVariantShortLabel(currentVariant.name) || item.baseUnit || item.unit || '—'
                      : item.baseUnit || item.unit || '—'

                  const itemIdentity = getItemIdentity(item.productId, item.productVariantId)
                  const duplicateCount = items.filter(
                    (candidate) =>
                      candidate.lineId !== item.lineId &&
                      getItemIdentity(candidate.productId, candidate.productVariantId) === itemIdentity,
                  ).length
                  // Stock for current branch
                  const currentBranchStock = (() => {
                    if (!branchId || !snapshot.branchStocks?.length) return snapshot.totalStock
                    const bs = snapshot.branchStocks.find(
                      (s) => s.branchId === branchId || s.branch?.id === branchId,
                    )
                    if (!bs) return null
                    return bs.availableStock !== undefined && bs.availableStock !== null
                      ? bs.availableStock
                      : (bs.stock ?? 0) - (bs.reservedStock ?? 0)
                  })()

                  return (
                    <div
                      key={item.lineId}
                      className="group hover:bg-background-secondary/40 transition-colors"
                    >
                      <div
                        className="grid items-center py-3"
                        style={{ gridTemplateColumns: cols }}
                      >
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border bg-background"
                            checked={selectedLineIds.includes(item.lineId)}
                            onChange={() => toggleLineSelection(item.lineId)}
                            aria-label={`Chọn sản phẩm ${snapshot.displayName}`}
                          />
                        </div>

                        {/* STT */}
                        <div className="text-center text-xs text-foreground-muted font-medium">
                          {idx + 1}
                        </div>

                        {/* Image */}
                        <div className="flex justify-center">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-tertiary text-foreground-muted">
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt={snapshot.displayName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package2 size={16} />
                            )}
                          </div>
                        </div>

                        {/* Mã hàng */}
                        <div className="pl-1">
                          <span className="text-xs font-medium text-primary-500 hover:text-primary-600 cursor-pointer">
                            {itemCode}
                          </span>
                        </div>

                        {/* Tên hàng + ghi chú + Detail link + Stock popup */}
                        <div className="min-w-0 pr-2">
                          {/* Product name row */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="truncate text-sm font-medium text-foreground"
                              title={snapshot.displayName}
                            >
                              {snapshot.displayName}
                            </span>

                            {trueVariants.length > 0 ? (
                              <div className="relative shrink-0">
                                <select
                                  className="h-6 appearance-none rounded-md border border-orange-200 bg-orange-500/10 px-2 pr-5 text-[11px] font-semibold text-orange-300 outline-none transition-all hover:border-orange-300 focus:border-orange-300 focus:ring-1 focus:ring-orange-300/30"
                                  value={currentTrueVariant?.id ?? item.productVariantId ?? ''}
                                  disabled={isReadOnly || hasLockedReceiptQuantity(item)}
                                  onChange={(e) =>
                                  updateItemVariant(
                                    item.lineId,
                                    e.target.value === 'base'
                                      ? currentTrueVariant?.id ?? 'base'
                                      : e.target.value,
                                  )
                                }
                                >
                                  {trueVariants.map((variant) => (
                                    <option key={variant.id} value={variant.id}>
                                      {getVariantShortLabel(variant.name) || variant.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  size={11}
                                  className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-orange-300"
                                />
                              </div>
                            ) : null}

                            {/* Stock info popup – identical mechanism to POS */}
                            <StockPopover item={item} branches={branches} />
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-muted">
                            <span className="truncate font-medium uppercase tracking-wide">
                              {itemCode}
                            </span>
                            {!isReadOnly && duplicateCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => mergeDuplicateItems(item.lineId)}
                                className="shrink-0 font-semibold text-primary-500 transition-colors hover:text-primary-600"
                              >
                                Gộp dòng
                              </button>
                            ) : null}
                            {!isReadOnly && !isEditingNote ? (
                              <button
                                type="button"
                                className="shrink-0 transition-colors hover:text-primary-500"
                                onClick={() => {
                                  setTempNote(item.note)
                                  setEditingNoteForId(item.lineId)
                                }}
                              >
                                {item.note ? 'Có ghi chú' : 'Ghi chú'}
                              </button>
                            ) : null}
                          </div>

                          {/* Inline note */}
                          {isEditingNote ? (
                            <div className="mt-1 flex items-center gap-1">
                              <input
                                type="text"
                                className="h-5 flex-1 rounded border border-border bg-background px-1.5 text-xs text-foreground placeholder:text-foreground-muted outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
                                placeholder="Nhập ghi chú..."
                                value={tempNote}
                                onChange={(e) => setTempNote(e.target.value)}
                                onBlur={() => {
                                  updateItemNote(item.lineId, tempNote)
                                  setEditingNoteForId(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateItemNote(item.lineId, tempNote)
                                    setEditingNoteForId(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingNoteForId(null)
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="text-foreground-muted hover:text-error"
                                onMouseDown={() => {
                                  setTempNote('')
                                  setEditingNoteForId(null)
                                }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="hidden mt-0.5 text-[11px] text-foreground-muted hover:text-primary-500 transition-colors"
                              onClick={() => {
                                setTempNote(item.note)
                                setEditingNoteForId(item.lineId)
                              }}
                            >
                              {item.note ? (
                                <span className="italic">{item.note}</span>
                              ) : (
                                <span className="opacity-60">Ghi chú...</span>
                              )}
                            </button>
                          )}

                          {!isReadOnly && duplicateCount > 0 ? (
                            <div className="hidden mt-1 items-center gap-1.5 text-[11px] text-warning">
                              <AlertTriangle size={11} />
                              <span>{duplicateCount} dong cung ma</span>
                              <button
                                type="button"
                                onClick={() => mergeDuplicateItems(item.lineId)}
                                className="font-semibold text-primary-500 transition-colors hover:text-primary-600"
                              >
                                Gop dong
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {/* ĐVT */}
                        <div className="text-center text-xs text-foreground-muted">
                          {conversionVariants.length > 0 ? (
                            <div className="relative inline-flex max-w-full items-center">
                              <select
                                className="h-6 max-w-full appearance-none rounded-md border border-sky-200 bg-sky-500/10 px-2 pr-5 text-center text-[11px] font-semibold text-sky-300 outline-none transition-all hover:border-sky-300 focus:border-sky-300 focus:ring-1 focus:ring-sky-300/30"
                                value={isCurrentConversion ? item.productVariantId ?? 'base' : 'base'}
                                disabled={isReadOnly || hasLockedReceiptQuantity(item)}
                                onChange={(e) =>
                                  updateItemVariant(
                                    item.lineId,
                                    e.target.value === 'base'
                                      ? currentTrueVariant?.id ?? 'base'
                                      : e.target.value,
                                  )
                                }
                              >
                                <option value="base">{item.baseUnit || item.unit || '—'}</option>
                                {conversionVariants.map((variant) => (
                                  <option key={variant.id} value={variant.id}>
                                    {getVariantShortLabel(variant.name) || variant.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={11}
                                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-sky-300"
                              />
                            </div>
                          ) : (
                            unitLabel
                          )}
                        </div>

                        {/* Tồn kho (before quantity) */}
                        <div className="text-center">
                          {currentBranchStock !== null && currentBranchStock !== undefined ? (
                            <span
                              className={`text-xs font-semibold tabular-nums ${
                                currentBranchStock <= 0
                                  ? 'text-error'
                                  : currentBranchStock <= 10
                                    ? 'text-warning'
                                    : 'text-foreground-muted'
                              }`}
                            >
                              {currentBranchStock}
                            </span>
                          ) : (
                            <span className="text-xs text-foreground-muted opacity-40">—</span>
                          )}
                        </div>

                        {/* Số lượng */}
                        <div className="flex justify-center">
                          <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                            <button
                              type="button"
                              className="flex h-7 w-6 items-center justify-center text-foreground-muted hover:bg-background-secondary disabled:opacity-30 transition-colors"
                              onClick={() => updateItem(item.lineId, 'quantity', item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus size={11} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="h-7 w-11 border-x border-border bg-transparent p-0 text-center text-sm font-semibold text-foreground outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.lineId, 'quantity', Number(e.target.value))}
                            />
                            <button
                              type="button"
                              className="flex h-7 w-6 items-center justify-center text-foreground-muted hover:bg-background-secondary transition-colors"
                              onClick={() => updateItem(item.lineId, 'quantity', item.quantity + 1)}
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Đơn giá */}
                        <div className="pr-1">
                          <NumericFormat
                            thousandSeparator="."
                            decimalSeparator=","
                            allowNegative={false}
                            className="h-7 w-full rounded-lg border border-border bg-transparent px-2 text-right text-sm font-medium text-foreground outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                            value={item.unitCost}
                            onValueChange={(values) => updateItem(item.lineId, 'unitCost', values.floatValue || 0)}
                          />
                        </div>

                        {/* Giảm giá */}
                        <div>
                          <NumericFormat
                            thousandSeparator="."
                            decimalSeparator=","
                            allowNegative={false}
                            className="h-7 w-full rounded-lg border border-border bg-transparent px-2 text-right text-sm text-foreground outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                            value={item.discount || ''}
                            placeholder="0"
                            onValueChange={(values) => updateItem(item.lineId, 'discount', values.floatValue || 0)}
                          />
                        </div>

                        {/* Thành tiền */}
                        <div className="pr-4 text-right">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {fmt(lineAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ──────────────────────────────────────────────────── */}
        <div className="flex min-h-0 w-[420px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background custom-scrollbar">
          {/* Supplier card */}
          <div className="hidden p-3 border-b border-border">
            {selectedSupplier ? (
              <div className="group relative rounded-xl border border-border bg-background-secondary p-3 transition-colors hover:border-primary-500/30">
                <button
                  type="button"
                  onClick={() => {
                    setSupplierId('')
                    setSupplierQuery('')
                  }}
                  className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-error/10 hover:text-error"
                >
                  <X size={12} />
                </button>
                <div className="pr-6">
                  <div className="text-sm font-bold text-primary-500 leading-tight">
                    {selectedSupplier.name}
                  </div>
                  {selectedSupplier.phone && (
                    <div className="mt-0.5 text-xs text-foreground-muted">
                      {selectedSupplier.phone}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applyLatestSupplierPricesToItems}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary-500/30 bg-primary-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary-500 transition-colors hover:border-primary-500/50 hover:bg-primary-500/15"
                >
                  <History size={11} />
                  Ap gia NCC gan nhat
                </button>
                {currentDebt > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-error/8 px-2.5 py-1.5">
                    <span className="text-xs text-foreground-muted">Công nợ:</span>
                    <span className="text-xs font-bold text-error">{fmt(currentDebt)}</span>
                  </div>
                )}

                <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
                    <History size={12} className="text-primary-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                      Lich su nhap gan day
                    </span>
                  </div>

                  {supplierReceipts.length > 0 ? (
                    <div className="divide-y divide-border">
                      {supplierReceipts.slice(0, 4).map((receipt: any) => (
                        <Link
                          key={receipt.id}
                          href={`/dashboard/inventory/receipts/${receipt.receiptNumber || receipt.id}`}
                          className="flex items-center justify-between gap-3 px-2.5 py-2 transition-colors hover:bg-background-secondary"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-semibold text-foreground">
                              {receipt.receiptNumber || receipt.id?.slice(0, 8)?.toUpperCase()}
                            </div>
                            <div className="mt-0.5 text-[10px] text-foreground-muted">
                              {dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm')}
                            </div>
                          </div>
                          <div className="text-right text-[11px] font-semibold text-primary-500">
                            {fmt(Number(receipt.totalAmount ?? 0))}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="px-2.5 py-2.5 text-[11px] text-foreground-muted">
                      Chua co lich su nhap voi nha cung cap nay.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative">
                <Building2
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                />
                <input
                  type="text"
                  className="h-10 w-full rounded-xl border border-border bg-background-secondary pl-9 pr-10 text-sm text-foreground placeholder:text-foreground-muted outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Tìm nhà cung cấp"
                  value={supplierQuery}
                  onChange={(e) => {
                    setSupplierQuery(e.target.value)
                    setShowSupplierSearch(true)
                  }}
                  onFocus={() => setShowSupplierSearch(true)}
                />
                <button
                  type="button"
                  onClick={handleOpenQuickSupplier}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background hover:text-primary-500"
                  title="Thêm nhà cung cấp nhanh"
                >
                  <UserPlus size={14} />
                </button>

                {showSupplierSearch ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                    <div className="max-h-72 overflow-y-auto custom-scrollbar">
                      {filteredSuppliers.map((supplier: any) => (
                        <button
                          key={supplier.id}
                          type="button"
                          className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-background-secondary"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectSupplier(supplier)}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
                            <Building2 size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">
                              {supplier.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-muted">
                              {supplier.phone ? (
                                <span className="inline-flex items-center gap-1">
                                  <Phone size={11} />
                                  {supplier.phone}
                                </span>
                              ) : (
                                <span>Không có SĐT</span>
                              )}
                            </div>
                          </div>
                          {Number(supplier.debt ?? 0) > 0 ? (
                            <div className="text-right text-[11px] font-semibold text-error">
                              {fmt(Number(supplier.debt ?? 0))}
                            </div>
                          ) : null}
                        </button>
                      ))}

                      {supplierQuery.trim() && filteredSuppliers.length === 0 ? (
                        <div className="space-y-3 px-3 py-4">
                          <div className="text-sm text-foreground-muted">
                            Không tìm thấy nhà cung cấp phù hợp
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleOpenQuickSupplier}
                            className="btn-primary w-full justify-center rounded-xl py-2 text-sm"
                          >
                            <Plus size={14} />
                            Thêm nhanh &quot;{supplierQuery.trim()}&quot;
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

              <select
                className="hidden"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">— Chọn nhà cung cấp —</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </option>
                ))}
              </select>
              </div>
            )}

            {/* Branch */}
            <div className="mt-2">
              <select
                className="form-input h-10 cursor-pointer"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">Chọn chi nhánh nhận hàng</option>
                {allowedBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hidden border-b border-border px-3 py-3">
            <div className="rounded-xl border border-border bg-background-secondary p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                    Nhà cung cấp
                  </div>
                  <div className="mt-2 truncate text-sm font-semibold text-foreground">
                    {selectedSupplier?.name || 'Chưa chọn nhà cung cấp'}
                  </div>
                  <div className="mt-1 truncate text-xs text-foreground-muted">
                    {selectedSupplier?.phone || currentBranch?.name || 'Chọn NCC ở thanh trên'}
                  </div>
                </div>
                {currentDebt > 0 ? (
                  <div className="rounded-lg bg-error/10 px-2 py-1 text-[11px] font-semibold text-error">
                    Nợ: {fmt(currentDebt)}
                  </div>
                ) : null}
              </div>

              {supplierReceipts.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {supplierReceipts.slice(0, 3).map((receipt: any) => (
                    <Link
                      key={receipt.id}
                      href={`/dashboard/inventory/receipts/${receipt.receiptNumber || receipt.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-background"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-foreground">
                          {receipt.receiptNumber || receipt.id?.slice(0, 8)?.toUpperCase()}
                        </div>
                        <div className="text-[10px] text-foreground-muted">
                          {dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm')}
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold text-primary-500">
                        {fmt(Number(receipt.totalAmount ?? 0))}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Order meta */}
          <div className="hidden border-b border-border px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-muted">Mã đặt hàng nhập</span>
              <span className="text-xs italic text-foreground-muted">Tự động</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-muted">Trạng thái</span>
              <span className="badge badge-warning text-[11px]">Đặt hàng</span>
            </div>
          </div>

          {/* Totals */}
          <div className="border-b border-border px-3 py-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground-muted flex items-center gap-1.5">
                Tổng tiền hàng
                {items.length > 0 && (
                  <span className="badge badge-primary text-[10px] px-1.5 py-0">
                    {items.length}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {fmt(merchandiseTotal)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground-muted shrink-0">Giảm giá</span>
              <NumericFormat
                thousandSeparator="."
                decimalSeparator=","
                allowNegative={false}
                className="h-7 w-28 rounded-lg border border-border bg-background-secondary px-2 text-right text-sm text-foreground outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                value={receiptDiscount || ''}
                placeholder="0"
                onValueChange={(values) => setReceiptDiscount(Math.max(0, values.floatValue || 0))}
                disabled={isReadOnly}
              />
            </div>

            {/* Extra costs – hidden from UI but still computed for legacy data */}

            {/* Grand total */}
            <div className="flex items-center justify-between rounded-xl bg-background-secondary px-3 py-2.5 border border-border">
              <span className="text-sm font-semibold text-foreground">Cần trả NCC</span>
              <span className="text-base font-black text-primary-500 tabular-nums">
                {fmt(grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment info */}
          <div className="border-b border-border px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-muted">Tiền trả NCC (F8)</span>
              <span className="text-xs font-medium text-foreground">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-muted">Tính vào công nợ</span>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {fmt(grandTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-foreground-muted shrink-0">Chi phí phát sinh</span>
              <NumericFormat
                thousandSeparator="."
                decimalSeparator=","
                allowNegative={false}
                className="h-6 w-24 rounded-lg border border-border bg-background-secondary px-2 text-right text-xs text-foreground outline-none focus:border-primary-500"
                value={taxAmount || ''}
                placeholder="0"
                onValueChange={(values) => setReceiptTax(Math.max(0, values.floatValue || 0))}
                disabled={isReadOnly}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-muted">Dự kiến ngày nhập hàng</span>
              <button
                type="button"
                className="text-foreground-muted hover:text-primary-500 transition-colors"
              >
                <CalendarDays size={14} />
              </button>
            </div>
          </div>

          <div className="hidden border-b border-border px-3 py-3">
            <div className="rounded-xl border border-border bg-background-secondary p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Lịch sử
                </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusView.toneClass}`}>
            {statusView.label}
          </span>
              </div>

              <div className="mt-3 space-y-3">
          {enhancedActivityTimelineEntries.map((entry, index) => (
                  <div key={`${entry.title}-${entry.time}-${entry.detail}-${index}`} className="grid grid-cols-[18px_1fr] gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${entry.tone === 'text-primary-500' ? 'bg-primary-500' : entry.tone === 'text-amber-500' ? 'bg-amber-500' : 'bg-border'}`} />
                {index < enhancedActivityTimelineEntries.length - 1 ? (
                        <span className="mt-1 h-full w-px bg-border" />
                      ) : null}
                    </div>
                    <div className="pb-1">
                      <div className={`text-sm font-semibold ${entry.tone}`}>{entry.title}</div>
                      <div className="mt-0.5 text-xs text-foreground">{entry.detail}</div>
                      {entry.href && entry.linkLabel ? (
                        <Link
                          href={entry.href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex text-[11px] font-medium text-amber-400 transition-colors hover:text-amber-300"
                        >
                          {entry.linkLabel}
                        </Link>
                      ) : null}
                      <div className="mt-0.5 text-[11px] text-foreground-muted">{entry.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="flex-1 px-3 py-2.5">
            <textarea
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background-secondary p-2.5 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              placeholder="Ghi chú cho đơn hàng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="border-b border-border px-3 py-3">
            <div className="rounded-xl border border-border bg-background-secondary p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Lịch sử
                </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusView.toneClass}`}>
            {statusView.label}
          </span>
              </div>

              <div className="mt-3 space-y-3">
          {enhancedActivityTimelineEntries.map((entry, index) => (
                  <div key={`${entry.title}-${entry.time}-${entry.detail}-${index}`} className="grid grid-cols-[18px_1fr] gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${entry.tone === 'text-primary-500' ? 'bg-primary-500' : entry.tone === 'text-amber-500' ? 'bg-amber-500' : 'bg-border'}`} />
                {index < enhancedActivityTimelineEntries.length - 1 ? (
                        <span className="mt-1 h-full w-px bg-border" />
                      ) : null}
                    </div>
                    <div className="pb-1">
                      <div className={`text-sm font-semibold ${entry.tone}`}>{entry.title}</div>
                      <div className="mt-0.5 text-xs text-foreground">{entry.detail}</div>
                      {entry.href && entry.linkLabel ? (
                        <Link
                          href={entry.href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex text-[11px] font-medium text-amber-400 transition-colors hover:text-amber-300"
                        >
                          {entry.linkLabel}
                        </Link>
                      ) : null}
                      <div className="mt-0.5 text-[11px] text-foreground-muted">{entry.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="hidden shrink-0 border-t border-border p-3 flex gap-2.5">
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={saveMutation.isPending || items.length === 0 || !branchId}
              className="btn-primary flex-1 rounded-xl py-2.5 text-sm justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Đang xử lý...' : isEditMode ? 'Cập nhật phiếu nháp' : 'Tạo đơn nhập'}
            </button>
          </div>
        </div>
      </div>
    </ReceiptWorkspace>
  )
}

interface ReceiptPaymentModalProps {
  isOpen: boolean
  form: ReceiptPaymentFormState
  debtAmount: number
  isPending: boolean
  onClose: () => void
  onChange: (
    field: keyof ReceiptPaymentFormState,
    value: ReceiptPaymentFormState[keyof ReceiptPaymentFormState],
  ) => void
  onConfirm: () => void
}

interface ReceiptReturnModalProps {
  isOpen: boolean
  form: ReceiptReturnFormState
  isPending: boolean
  onClose: () => void
  onChangeNotes: (value: string) => void
  onChangeQuantity: (receiptItemId: string, quantity: number) => void
  onConfirm: () => void
}

function ReceiptPaymentModal({
  isOpen,
  form,
  debtAmount,
  isPending,
  onClose,
  onChange,
  onConfirm,
}: ReceiptPaymentModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
              Thanh toán phiếu nhập
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">Ghi nhận thanh toán cho nhà cung cấp</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Công nợ hiện tại: <span className="font-semibold text-foreground">{fmt(debtAmount)} đ</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background-secondary text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Số tiền thanh toán
              </span>
              <NumericFormat
                thousandSeparator="."
                decimalSeparator=","
                allowNegative={false}
                value={form.amount || ''}
                placeholder="0"
                className="h-12 w-full rounded-2xl border border-border bg-background-secondary px-4 text-base font-semibold text-foreground outline-none transition-colors focus:border-primary-500"
                onValueChange={(values) => onChange('amount', Math.max(0, values.floatValue || 0))}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Hình thức thanh toán
              </span>
              <select
                value={form.paymentMethod}
                onChange={(event) => onChange('paymentMethod', event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-background-secondary px-4 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary-500"
              >
                {RECEIPT_PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              Ghi chú thanh toán
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => onChange('notes', event.target.value)}
              placeholder="Nhập ghi chú cho lần thanh toán này"
              className="w-full resize-none rounded-2xl border border-border bg-background-secondary px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary-500/30 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || form.amount <= 0}
            className="btn-primary inline-flex h-11 min-w-[160px] items-center justify-center rounded-2xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReceiptReturnModal({
  isOpen,
  form,
  isPending,
  onClose,
  onChangeNotes,
  onChangeQuantity,
  onConfirm,
}: ReceiptReturnModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
              Hoàn trả phiếu nhập
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">Chọn hàng cần hoàn trả cho nhà cung cấp</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background-secondary text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
            {form.items.map((item) => (
              <div
                key={item.receiptItemId}
                className="grid gap-3 rounded-2xl border border-border bg-background-secondary/70 px-4 py-3 md:grid-cols-[minmax(0,1fr)_132px]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
                  <div className="mt-1 text-xs text-foreground-muted">
                    {item.sku || 'Không có mã'} • Có thể hoàn {item.availableQty}
                  </div>
                </div>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    Số lượng hoàn
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={item.availableQty}
                    value={item.quantity}
                    onChange={(event) => onChangeQuantity(item.receiptItemId, Number(event.target.value))}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary-500"
                  />
                </label>
              </div>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              Ghi chú hoàn trả
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => onChangeNotes(event.target.value)}
              placeholder="Nhập lý do hoặc ghi chú cho đợt hoàn trả"
              className="w-full resize-none rounded-2xl border border-border bg-background-secondary px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary-500/30 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="btn-primary inline-flex h-11 min-w-[160px] items-center justify-center rounded-2xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận hoàn trả'}
          </button>
        </div>
      </div>
    </div>
  )
}
