'use client'

import { getReceiptStatusView, fmt } from './receipt.utils';
import dayjs from 'dayjs';
import React from 'react';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthStore } from '@/stores/auth.store'
import { useAuthorization } from '@/hooks/useAuthorization'
import { api } from '@/lib/api'
import { stockApi } from '@/lib/api/stock.api'
import { inventoryApi } from '@/lib/api/inventory.api'
import { buildFinanceVoucherHref } from '@/lib/finance-routes'
import { normalizeBranchCode, suggestBranchCodeFromName } from '@petshop/shared'

import type {
  ExtraCostRow,
  ReceiptEditSession,
  ReceiptPaymentFormState,
  ReceiptReturnFormState,
  ReceiptReturnLineDraft,
  ReceiptScreenMode,
  SelectedItem,
  SubmitMode,
  SupplierQuickDraftPayload,
  SupplierQuickForm,
} from './receipt.types'
import { LOCAL_RECEIPT_DRAFT_KEY, SUPPLIER_RECEIPT_DRAFT_KEY } from './receipt.constants'
import {
  applyVariantSelection,
  buildReceiptNotes,
  createExtraCostRow,
  createLineId,
  createReceiptDraftSignature,
  createSupplierDraft,
  filterSuppliers,
  findExactProductMatch,
  formatReceiptDateTime,
  getItemIdentity,
  getPaymentMethodLabel,
  getProducts,
  getReceipts,
  getReceiptRedirectId,
  getSuppliers,
  normalizeExtraCosts,
  normalizeProduct,
  normalizeReceiptItem,
  normalizeSupplierQuickDraftItem,
  parseReceiptNotes,
} from './receipt.utils'

export interface UseReceiptFormOptions {
  mode?: ReceiptScreenMode
  receiptId?: string
}

interface LocalReceiptDraftPayload {
  version: 1
  updatedAt: string
  branchId: string
  supplierId: string
  supplierQuery: string
  notes: string
  items: SelectedItem[]
  receiptDiscount: number
  receiptTax: number
  extraCosts: ExtraCostRow[]
  showExtraCosts: boolean
  splitDuplicateLines: boolean
}

interface ReceiptTimelineEntry {
  title: string
  detail: string | null
  actor: string | null
  time: string
  tone: string
  sortAt: number
  sortOrder: number
  voucherLabel?: string | null
  voucherHref?: string | null
}

function restoreDraftItems(rawItems: unknown): SelectedItem[] {
  if (!Array.isArray(rawItems)) return []

  return rawItems
    .filter((item: any) => item?.productId && item?.name)
    .map((item: any) => ({
      lineId: `${item.lineId ?? createLineId()}`,
      receiptItemId: item.receiptItemId ? `${item.receiptItemId}` : null,
      productId: `${item.productId}`,
      productVariantId: item.productVariantId ? `${item.productVariantId}` : null,
      barcode: item.barcode ? `${item.barcode}` : null,
      sku: item.sku ? `${item.sku}` : null,
      name: `${item.name}`,
      image: item.image ? `${item.image}` : null,
      unit: item.unit ? `${item.unit}` : null,
      sellingPrice: Math.max(0, Number(item.sellingPrice ?? 0)),
      quantity: Math.max(1, Number(item.quantity ?? 1)),
      unitCost: Math.max(0, Number(item.unitCost ?? 0)),
      discount: Math.max(0, Number(item.discount ?? 0)),
      note: `${item.note ?? ''}`.trim(),
      totalStock:
        item.totalStock === null || item.totalStock === undefined ? null : Number(item.totalStock),
      monthlySellThrough:
        item.monthlySellThrough === null || item.monthlySellThrough === undefined
          ? null
          : Number(item.monthlySellThrough),
      branchStocks: Array.isArray(item.branchStocks) ? item.branchStocks : [],
      variants: Array.isArray(item.variants) ? item.variants : [],
      variantName: item.variantName ? `${item.variantName}` : null,
      variantLabel: item.variantLabel ? `${item.variantLabel}` : null,
      unitLabel: item.unitLabel ? `${item.unitLabel}` : null,
      baseSku: item.baseSku ? `${item.baseSku}` : null,
      baseBarcode: item.baseBarcode ? `${item.baseBarcode}` : null,
      baseUnit: item.baseUnit ? `${item.baseUnit}` : null,
      baseUnitCost: Math.max(0, Number(item.baseUnitCost ?? item.unitCost ?? 0)),
      baseTotalStock:
        item.baseTotalStock === null || item.baseTotalStock === undefined
          ? null
          : Number(item.baseTotalStock),
      baseMonthlySellThrough:
        item.baseMonthlySellThrough === null || item.baseMonthlySellThrough === undefined
          ? null
          : Number(item.baseMonthlySellThrough),
      baseBranchStocks: Array.isArray(item.baseBranchStocks) ? item.baseBranchStocks : [],
      receivedQuantity: Math.max(0, Number(item.receivedQuantity ?? 0)),
      returnedQuantity: Math.max(0, Number(item.returnedQuantity ?? 0)),
      closedQuantity: Math.max(0, Number(item.closedQuantity ?? 0)),
    }))
}

export function useReceiptForm({ mode = 'create', receiptId }: UseReceiptFormOptions = {}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // ── Refs ─────────────────────────────────────────────────────────────────────

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const supplierPanelRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const hydratedSupplierDraftRef = useRef(false)
  const hydratedReceiptRef = useRef<string | null>(null)
  const scanRequestRef = useRef(0)
  const lastAutoScannedRef = useRef('')

  // ── Auth ─────────────────────────────────────────────────────────────────────

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

  // ── State ─────────────────────────────────────────────────────────────────────

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
  const [receiptDiscount, setReceiptDiscount] = useState(0)
  const [receiptTax, setReceiptTax] = useState(0)
  const [extraCosts, setExtraCosts] = useState<ExtraCostRow[]>([])
  const [showExtraCosts, setShowExtraCosts] = useState(false)
  const [editingNoteForId, setEditingNoteForId] = useState<string | null>(null)
  const [tempNote, setTempNote] = useState('')
  const [splitDuplicateLines, setSplitDuplicateLines] = useState(false)
  const [isEditingSession, setIsEditingSession] = useState(false)
  const [editBaseSignature, setEditBaseSignature] = useState('')
  const [editSessions, setEditSessions] = useState<ReceiptEditSession[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showReceiptExcelModal, setShowReceiptExcelModal] = useState(false)
  const [isLocalDraftHydrated, setIsLocalDraftHydrated] = useState(isExistingReceipt)

  const [paymentForm, setPaymentForm] = useState<ReceiptPaymentFormState>({
    amount: 0,
    paymentMethod: 'BANK',
    notes: '',
  })
  const [returnForm, setReturnForm] = useState<ReceiptReturnFormState>({
    notes: '',
    items: [],
    settlementMode: 'OFFSET_DEBT',
    refundPaymentMethod: 'BANK',
  })

  const deferredSearch = useDeferredValue(search.trim())

  // ── Queries ──────────────────────────────────────────────────────────────────

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

  const { data: stockSearchRes } = useQuery({
    queryKey: ['stock', 'products', 'receipt-search-metrics', deferredSearch, branchId],
    queryFn: () =>
      stockApi.getProducts({
        search: deferredSearch,
        branchId: branchId || undefined,
        limit: 50,
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

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/settings/branches').then((r: any) => r.data.data ?? r.data),
  })

  // ── Derived values ───────────────────────────────────────────────────────────

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
  const stockMetricMap = useMemo(() => {
    const rows = getProducts(stockSearchRes)
    const entries = rows.map((row: any) => [
      getItemIdentity(row.productId, row.productVariantId ?? null),
      row.monthlySellThrough ?? null,
    ] as const)

    return new Map(entries)
  }, [stockSearchRes])

  const attachStockMetrics = useCallback(
    (product: any) => ({
      ...product,
      monthlySellThrough: stockMetricMap.get(getItemIdentity(product.id, null)) ?? null,
      variants: Array.isArray(product.variants)
        ? product.variants.map((variant: any) => ({
          ...variant,
          monthlySellThrough:
            stockMetricMap.get(getItemIdentity(product.id, variant.id)) ?? null,
        }))
        : product.variants,
    }),
    [stockMetricMap],
  )

  const productResults = useMemo(() => {
    const products = getProducts(productSearchRes)

    return products.map((product: any) => attachStockMetrics(product))
  }, [attachStockMetrics, productSearchRes])
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
  const hasCreateDraftContent =
    !isExistingReceipt &&
    (Boolean(branchId) ||
      Boolean(supplierId) ||
      Boolean(supplierQuery.trim()) ||
      Boolean(notes.trim()) ||
      items.length > 0 ||
      discountAmount > 0 ||
      taxAmount > 0 ||
      normalizedExtraCosts.length > 0 ||
      showExtraCosts ||
      splitDuplicateLines)

  const currentReceiptPaidAmount = Math.max(0, Number(receipt?.paidAmount ?? 0))
  const currentReceiptDebtAmount = Math.max(0, Number(receipt?.debtAmount ?? 0))
  const currentReceiptTotalAmount = Math.max(
    0,
    Number(isExistingReceipt ? receipt?.totalAmount ?? grandTotal : grandTotal),
  )
  const currentReceiptPayableAmount = Math.max(
    0,
    Number(isExistingReceipt ? receipt?.payableAmount ?? currentReceiptTotalAmount : grandTotal),
  )
  const currentReceiptOverpaidAmount = Math.max(0, Number(receipt?.overpaidAmount ?? 0))
  const receiptPaymentSummary = receipt?.paymentSummary ?? null
  const orderPaymentAmount = Math.max(
    0,
    Number(isExistingReceipt ? receiptPaymentSummary?.orderPaymentAmount ?? currentReceiptPaidAmount : 0),
  )
  const currentReceiptOutstandingAmount = Math.max(
    0,
    currentReceiptTotalAmount - orderPaymentAmount,
  )
  const debtSettlementAmount = Math.max(
    0,
    Number(isExistingReceipt ? receiptPaymentSummary?.debtSettlementAmount ?? 0 : 0),
  )
  const totalAppliedPaymentAmount = Math.max(
    0,
    orderPaymentAmount + debtSettlementAmount,
  )
  const currentDebt = isExistingReceipt
    ? currentReceiptDebtAmount
    : 0
  const currentSupplierDebt = Math.max(
    currentDebt,
    Number(selectedSupplier?.stats?.totalDebt ?? selectedSupplier?.debt ?? displaySupplier?.stats?.totalDebt ?? displaySupplier?.debt ?? 0),
  )
  const otherSupplierDebt = Math.max(0, currentSupplierDebt - currentDebt)
  const maxPayableAmount = Math.max(0, otherSupplierDebt + currentReceiptOutstandingAmount)
  const selectedReturnAmount = useMemo(
    () =>
      returnForm.items.reduce(
        (sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)) * Math.max(0, Number(item.unitPrice ?? 0)),
        0,
      ),
    [returnForm.items],
  )
  const estimatedRefundAmount = useMemo(() => {
    if (!isExistingReceipt || selectedReturnAmount <= 0) return 0
    const nextPayableAmount = Math.max(0, currentReceiptPayableAmount - selectedReturnAmount)
    const nextOverpaidAmount = Math.max(0, currentReceiptPaidAmount - nextPayableAmount)
    return Math.max(0, nextOverpaidAmount - currentReceiptOverpaidAmount)
  }, [
    currentReceiptOverpaidAmount,
    currentReceiptPaidAmount,
    currentReceiptPayableAmount,
    isExistingReceipt,
    selectedReturnAmount,
  ])

  const paymentAllocationCount = Array.isArray(receipt?.paymentAllocations)
    ? receipt.paymentAllocations.length
    : 0
  const latestPaymentAllocation = [...(receipt?.paymentAllocations ?? [])].sort(
    (left: any, right: any) =>
      new Date(right?.payment?.paidAt ?? 0).getTime() -
      new Date(left?.payment?.paidAt ?? 0).getTime(),
  )[0]
  const latestReceiveEvent = [...(receipt?.receiveEvents ?? [])].sort(
    (left: any, right: any) =>
      new Date(right?.receivedAt ?? 0).getTime() - new Date(left?.receivedAt ?? 0).getTime(),
  )[0]
  const latestPaymentAt = latestPaymentAllocation?.payment?.paidAt ?? receipt?.paymentDate ?? null
  const latestPaymentMethodLabel =
    latestPaymentAllocation?.payment?.paymentMethod
      ? getPaymentMethodLabel(latestPaymentAllocation.payment.paymentMethod)
      : receipt?.paymentMethod
        ? getPaymentMethodLabel(receipt.paymentMethod)
        : '—'
  const latestReceiveAt =
    latestReceiveEvent?.receivedAt ?? receipt?.receivedAt ?? receipt?.completedAt ?? null
  const hasAnyPayment = currentReceiptPaidAmount > 0 || paymentAllocationCount > 0
  const isFullyPaid =
    !!receipt &&
    (currentReceiptTotalAmount > 0
      ? currentReceiptPaidAmount >= Math.max(0, currentReceiptTotalAmount - 1)
      : receipt.paymentStatus === 'PAID')
  const hasAnyReceive =
    Math.max(0, Number(receipt?.receivedQty ?? 0)) > 0 ||
    !!receipt?.receivedAt ||
    receipt?.status === 'RECEIVED'
  const isReceiveDone =
    !!receipt &&
    (receipt.receiptStatus === 'FULL_RECEIVED' ||
      receipt.receiptStatus === 'SHORT_CLOSED' ||
      receipt.status === 'RECEIVED' ||
      !!receipt.completedAt)
  const isCancelled =
    !!receipt && (receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED')
  const isCompleted = !!receipt && !isCancelled && isFullyPaid && isReceiveDone

  const getLockedReceiptQuantity = (item: SelectedItem) =>
    Math.max(0, Number(item.receivedQuantity ?? 0)) +
    Math.max(0, Number(item.closedQuantity ?? 0))
  const hasLockedReceiptQuantity = (item: SelectedItem) => getLockedReceiptQuantity(item) > 0

  const returnableReceiptItems: ReceiptReturnLineDraft[] = Array.isArray(receipt?.items)
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
            unitPrice: Number(item.unitPrice ?? 0),
            availableQty,
            quantity: 0,
          }
          : null
      })
      .filter(Boolean)
    : []

  const latestImportPriceMap = supplierReceipts.reduce(
    (map, r: any) => {
      for (const item of r.items ?? []) {
        const identity = getItemIdentity(item.productId, item.productVariantId)
        if (!map.has(identity)) {
          map.set(identity, {
            unitPrice: Number(item.unitPrice ?? 0),
            receiptNumber: r.receiptNumber,
            createdAt: r.createdAt,
          })
        }
      }
      return map
    },
    new Map<string, { unitPrice: number; receiptNumber?: string; createdAt?: string }>(),
  )
  const latestProductPriceMap = supplierReceipts.reduce(
    (map, r: any) => {
      for (const item of r.items ?? []) {
        if (!map.has(item.productId)) {
          map.set(item.productId, {
            unitPrice: Number(item.unitPrice ?? 0),
            receiptNumber: r.receiptNumber,
            createdAt: r.createdAt,
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

  // ── Memoized display derived values ──────────────────────────────────────────

  const statusView = useMemo(() => getReceiptStatusView(receipt), [receipt])

  const creatorDisplayName = useMemo(
    () =>
      receipt?.createdBy?.fullName ||
      receipt?.createdBy?.username ||
      receipt?.createdBy?.name ||
      (user as any)?.fullName ||
      (user as any)?.username ||
      (user as any)?.name ||
      'Chưa xác định',
    [receipt, user],
  )

  const toTimelineTimestamp = (value?: string | Date | null) => {
    if (!value) return 0
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  const activityTimeline = useMemo<ReceiptTimelineEntry[]>(
    () => [
      {
        title: 'Tạo đơn nhập',
        detail: null,
        actor: creatorDisplayName,
        time: receipt?.createdAt ? formatReceiptDateTime(receipt.createdAt) : dayjs().format('DD/MM/YYYY HH:mm'),
        tone: 'text-primary-500',
        sortAt: toTimelineTimestamp(receipt?.createdAt),
        sortOrder: 0,
      },
      ...editSessions
        .map((session) => ({
          title: 'Cập nhật sản phẩm',
          detail: `${session.itemCount} mặt hàng - ${session.totalQuantity} số lượng`,
          actor: session.editedBy,
          time: formatReceiptDateTime(session.editedAt),
          tone: 'text-foreground',
          sortAt: toTimelineTimestamp(session.editedAt),
          sortOrder: 1,
        })),
    ],
    [creatorDisplayName, editSessions, receipt?.createdAt],
  )

  const paymentTimelineEntries = useMemo<ReceiptTimelineEntry[]>(() => {
    const sorted = (receipt?.paymentAllocations ?? [])
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b?.payment?.paidAt ?? 0).getTime() - new Date(a?.payment?.paidAt ?? 0).getTime(),
      )
    return sorted.map((allocation: any) => {
      const voucherNumber = allocation?.payment?.transactionVoucherNumber || null
      const paymentTotalAmount = Math.max(
        0,
        Number(allocation?.payment?.appliedAmount ?? allocation?.payment?.amount ?? allocation?.amount ?? 0),
      )
      const paymentMethodLabel = getPaymentMethodLabel(allocation.payment?.paymentMethod)
      return {
        title: 'Thanh toán',
        detail: `${paymentMethodLabel} - ${fmt(paymentTotalAmount)} đ`,
        actor: allocation.payment?.staff?.fullName || creatorDisplayName,
        time: formatReceiptDateTime(allocation.payment?.paidAt ?? receipt?.paymentDate ?? receipt?.updatedAt),
        tone: 'text-primary-500',
        sortAt: toTimelineTimestamp(allocation.payment?.paidAt ?? receipt?.paymentDate ?? receipt?.updatedAt),
        sortOrder: 2,
        voucherLabel: voucherNumber,
        voucherHref: voucherNumber ? buildFinanceVoucherHref(voucherNumber) : null,
      }
    })
  }, [creatorDisplayName, receipt?.paymentAllocations, receipt?.paymentDate, receipt?.updatedAt])

  const fallbackPaymentEntries = useMemo<ReceiptTimelineEntry[]>(
    () =>
      paymentTimelineEntries.length === 0 && hasAnyPayment
        ? [
          {
            title: isFullyPaid ? 'Đã thanh toán' : 'Thanh toán 1 phần',
            detail: `${receipt?.paymentMethod ? getPaymentMethodLabel(receipt.paymentMethod) : 'Thanh toán'} - ${fmt(totalAppliedPaymentAmount || currentReceiptPaidAmount)} đ`,
            actor: latestPaymentAllocation?.payment?.staff?.fullName || creatorDisplayName,
            time: formatReceiptDateTime(receipt?.paymentDate ?? receipt?.updatedAt),
            tone: 'text-primary-500',
            sortAt: toTimelineTimestamp(receipt?.paymentDate ?? receipt?.updatedAt),
            sortOrder: 2,
            voucherLabel: latestPaymentAllocation?.payment?.transactionVoucherNumber || null,
            voucherHref: latestPaymentAllocation?.payment?.transactionVoucherNumber
              ? buildFinanceVoucherHref(latestPaymentAllocation.payment.transactionVoucherNumber)
              : null,
          },
        ]
        : [],
    [creatorDisplayName, currentReceiptPaidAmount, hasAnyPayment, isFullyPaid, latestPaymentAllocation?.payment?.staff?.fullName, paymentTimelineEntries.length, receipt, totalAppliedPaymentAmount],
  )

  const receiveHistoryEntries = useMemo<ReceiptTimelineEntry[]>(
    () =>
      (receipt?.receiveEvents ?? [])
        .slice()
        .sort(
          (a: any, b: any) =>
            new Date(b?.receivedAt ?? 0).getTime() - new Date(a?.receivedAt ?? 0).getTime(),
        )
        .map((event: any) => ({
          title: 'Nhập kho',
          detail: `Nhập kho ${Number(event.totalQuantity ?? 0)} SP - ${fmt(Number(event.totalAmount ?? 0))} đ`,
          actor: event.staff?.fullName || creatorDisplayName,
          time: formatReceiptDateTime(event.receivedAt),
          tone: 'text-sky-500',
          sortAt: toTimelineTimestamp(event.receivedAt),
          sortOrder: 3,
        })),
    [creatorDisplayName, receipt?.receiveEvents],
  )

  const fallbackReceiveEntries = useMemo<ReceiptTimelineEntry[]>(
    () =>
      receiveHistoryEntries.length === 0 && hasAnyReceive
        ? [
          {
            title: isReceiveDone ? 'Đã nhập kho' : 'Nhập kho 1 phần',
            detail: `Nhập kho ${Math.max(0, Number(receipt?.receivedQty ?? 0))} SP${Number(receipt?.totalReceivedAmount ?? 0) > 0 ? ` - ${fmt(Number(receipt?.totalReceivedAmount ?? 0))} đ` : ''}`,
            actor: latestReceiveEvent?.staff?.fullName || creatorDisplayName,
            time: formatReceiptDateTime(receipt?.receivedAt ?? receipt?.completedAt ?? receipt?.updatedAt),
            tone: 'text-sky-500',
            sortAt: toTimelineTimestamp(receipt?.receivedAt ?? receipt?.completedAt ?? receipt?.updatedAt),
            sortOrder: 3,
          },
        ]
        : [],
    [creatorDisplayName, hasAnyReceive, isReceiveDone, latestReceiveEvent?.staff?.fullName, receiveHistoryEntries.length, receipt],
  )

  const returnHistoryEntries = useMemo<ReceiptTimelineEntry[]>(() => {
    const supplierReturns = (receipt?.supplierReturns ?? [])
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b?.returnedAt ?? 0).getTime() - new Date(a?.returnedAt ?? 0).getTime(),
      )

    return supplierReturns.flatMap((supplierReturn: any) => {
      const returnedQuantity = Number(
        supplierReturn.items?.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0) ?? 0,
      )
      const returnEntry: ReceiptTimelineEntry = {
        title: 'Hoàn trả NCC',
        detail: `Hoàn trả ${returnedQuantity} SP - ${fmt(Number(supplierReturn.totalAmount ?? 0))} đ`,
        actor: supplierReturn.staff?.fullName || creatorDisplayName,
        time: formatReceiptDateTime(supplierReturn.returnedAt),
        tone: 'text-orange-400',
        sortAt: toTimelineTimestamp(supplierReturn.returnedAt),
        sortOrder: 4,
      }

      const refundEntries: ReceiptTimelineEntry[] = (supplierReturn.refunds ?? []).map((refund: any) => {
        const voucherNumber = refund?.transactionVoucherNumber || null
        return {
          title: 'Nhận tiền hoàn trả',
          detail: `${getPaymentMethodLabel(refund?.paymentMethod)} - ${fmt(Number(refund?.amount ?? 0))} đ`,
          actor: refund?.staff?.fullName || supplierReturn.staff?.fullName || creatorDisplayName,
          time: formatReceiptDateTime(refund?.receivedAt ?? refund?.createdAt ?? supplierReturn.returnedAt),
          tone: 'text-emerald-400',
          sortAt: toTimelineTimestamp(refund?.receivedAt ?? refund?.createdAt ?? supplierReturn.returnedAt),
          sortOrder: 5,
          voucherLabel: voucherNumber,
          voucherHref: voucherNumber ? buildFinanceVoucherHref(voucherNumber) : null,
        }
      })

      return [returnEntry, ...refundEntries]
    })
  }, [creatorDisplayName, receipt?.supplierReturns])

  const hasAnyReturn = useMemo(
    () =>
      Number(receipt?.returnedQty ?? 0) > 0 ||
      receipt?.receiptStatus === 'RETURNED' ||
      returnHistoryEntries.length > 0,
    [receipt?.returnedQty, receipt?.receiptStatus, returnHistoryEntries.length],
  )

  const enhancedActivityTimelineEntries = useMemo(
    () =>
      [
        ...activityTimeline,
        ...paymentTimelineEntries,
        ...fallbackPaymentEntries,
        ...receiveHistoryEntries,
        ...fallbackReceiveEntries,
        ...returnHistoryEntries,
      ]
        .map((entry, index) => ({ ...entry, _index: index }))
        .sort((left, right) => {
          if (left.sortAt !== right.sortAt) return right.sortAt - left.sortAt
          return right._index - left._index
        })
        .map(({ sortAt, sortOrder, _index, ...entry }) => entry),
    [activityTimeline, fallbackPaymentEntries, fallbackReceiveEntries, paymentTimelineEntries, receiveHistoryEntries, returnHistoryEntries],
  )

  const progressSteps = useMemo(() => {
    const terminalStep = isCancelled
      ? { title: 'Hủy', meta: formatReceiptDateTime(receipt?.updatedAt), state: 'alert' as const }
      : hasAnyReturn
        ? {
          title: 'Hoàn trả',
          meta: returnHistoryEntries[0]?.time ?? formatReceiptDateTime(receipt?.updatedAt),
          state: 'alert' as const,
        }
        : { title: 'Hoàn trả', meta: '—', state: 'hidden' as const }
    return [
      {
        title: 'Đặt hàng',
        meta: receipt?.createdAt ? formatReceiptDateTime(receipt.createdAt) : '—',
        state: (receipt ? 'completed' : 'active') as 'completed' | 'active',
      },
      {
        title: 'Thanh toán',
        meta: hasAnyPayment ? formatReceiptDateTime(receipt?.paymentDate ?? receipt?.updatedAt) : '—',
        state: (isFullyPaid ? 'completed' : hasAnyPayment ? 'active' : 'pending') as 'completed' | 'active' | 'pending',
      },
      {
        title: 'Nhập kho',
        meta: hasAnyReceive ? formatReceiptDateTime(receipt?.receivedAt ?? receipt?.completedAt ?? receipt?.updatedAt) : '—',
        state: (isReceiveDone ? 'completed' : hasAnyReceive ? 'active' : 'pending') as 'completed' | 'active' | 'pending',
      },
      terminalStep,
    ]
  }, [hasAnyPayment, hasAnyReceive, hasAnyReturn, isCancelled, isFullyPaid, isReceiveDone, receipt, returnHistoryEntries])

  const visibleProgressSteps = useMemo(
    () => progressSteps.filter((step) => step.state !== 'hidden'),
    [progressSteps],
  )

  const canShowPaymentAction = useMemo(
    () => isExistingReceipt && canPayReceipt && !isCancelled && !isCompleted && maxPayableAmount > 0,
    [canPayReceipt, isCancelled, isCompleted, isExistingReceipt, maxPayableAmount],
  )
  const canShowReceiveAction = useMemo(
    () => isExistingReceipt && canReceiveReceipt && !isCancelled && !isCompleted && !isReceiveDone,
    [canReceiveReceipt, isCancelled, isCompleted, isExistingReceipt, isReceiveDone],
  )
  const canShowCancelAction = useMemo(
    () => isExistingReceipt && canCancelReceipt && !isCancelled && !hasAnyPayment && !hasAnyReceive,
    [canCancelReceipt, hasAnyPayment, hasAnyReceive, isCancelled, isExistingReceipt],
  )
  const canShowReturnAction = useMemo(
    () => isExistingReceipt && canReturnReceipt && isCompleted && returnableReceiptItems.length > 0,
    [canReturnReceipt, isCompleted, isExistingReceipt, returnableReceiptItems.length],
  )

  // ── Query helpers ─────────────────────────────────────────────────────────────

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
      new Set(
        [receiptId, nextReceipt?.id, nextReceipt?.receiptNumber].filter(Boolean) as string[],
      ),
    )
    nextQueryIds.forEach((queryId) => {
      queryClient.setQueryData(['receipt', queryId], { data: { data: nextReceipt } })
      queryClient.invalidateQueries({ queryKey: ['receipt', queryId] })
    })
  }

  // ── Item helpers ─────────────────────────────────────────────────────────────

  const applyLatestSupplierPrice = (item: SelectedItem) => {
    if (!supplierId) return item
    const latest = getLatestSupplierPrice(item.productId, item.productVariantId)
    if (!latest) return item

    return { ...item, unitCost: Number(latest.unitCost ?? latest.unitPrice ?? item.unitCost) }
  }


  // ── Modal openers ─────────────────────────────────────────────────────────────

  const openPaymentModal = () => {
    if (!resolvedReceiptId || maxPayableAmount <= 0) return
    setPaymentForm({
      amount: currentReceiptOutstandingAmount > 0 ? currentReceiptOutstandingAmount : maxPayableAmount,
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
      settlementMode: 'OFFSET_DEBT',
      refundPaymentMethod: 'BANK',
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

    const rawSupplierDraft = window.localStorage.getItem(SUPPLIER_RECEIPT_DRAFT_KEY)
    if (rawSupplierDraft) {
      window.localStorage.removeItem(SUPPLIER_RECEIPT_DRAFT_KEY)

    try {
      const parsed = JSON.parse(rawSupplierDraft) as SupplierQuickDraftPayload
      const draftItems = Array.isArray(parsed.items)
        ? parsed.items
          .filter((item) => item?.productId && item?.name)
          .map((item) => normalizeSupplierQuickDraftItem(item))
        : []
      if (parsed.supplierId) setSupplierId(String(parsed.supplierId))
      if (parsed.notes) setNotes(String(parsed.notes))
      if (draftItems.length > 0) setItems(draftItems)
      setIsLocalDraftHydrated(true)
      return
    } catch {
      toast.error('Không đọc được dữ liệu nháp phiếu nhập từ màn nhà cung cấp.')
    }
    }

    const rawLocalDraft = window.localStorage.getItem(LOCAL_RECEIPT_DRAFT_KEY)
    if (!rawLocalDraft) {
      setIsLocalDraftHydrated(true)
      return
    }

    try {
      const parsed = JSON.parse(rawLocalDraft) as Partial<LocalReceiptDraftPayload>
      const draftItems = restoreDraftItems(parsed.items)
      if (parsed.branchId) setBranchId(String(parsed.branchId))
      if (parsed.supplierId) setSupplierId(String(parsed.supplierId))
      if (parsed.supplierQuery) setSupplierQuery(String(parsed.supplierQuery))
      if (parsed.notes) setNotes(String(parsed.notes))
      if (draftItems.length > 0) setItems(draftItems)
      setReceiptDiscount(Math.max(0, Number(parsed.receiptDiscount ?? 0)))
      setReceiptTax(Math.max(0, Number(parsed.receiptTax ?? 0)))
      setExtraCosts(Array.isArray(parsed.extraCosts) ? parsed.extraCosts : [])
      setShowExtraCosts(Boolean(parsed.showExtraCosts))
      setSplitDuplicateLines(Boolean(parsed.splitDuplicateLines))
      toast.success('Da khoi phuc phieu nhap tam luu tren may nay.')
      setIsLocalDraftHydrated(true)
      return
      // eslint-disable-next-line no-unreachable
      toast.success('Đã khôi phục phiếu nhập tạm lưu trên máy này.')
    } catch {
      window.localStorage.removeItem(LOCAL_RECEIPT_DRAFT_KEY)
      toast.error('Không đọc được bản nháp phiếu nhập tạm lưu.')
      setIsLocalDraftHydrated(true)
      return
      // eslint-disable-next-line no-unreachable
      toast.error('Không đọc được bản nháp phiếu nhập tạm lưu.')
    }
    // eslint-disable-next-line no-unreachable
    setIsLocalDraftHydrated(true)
  }, [isExistingReceipt])

  useEffect(() => {
    if (isExistingReceipt || !isLocalDraftHydrated) return

    if (!hasCreateDraftContent) {
      window.localStorage.removeItem(LOCAL_RECEIPT_DRAFT_KEY)
      return
    }

    const payload: LocalReceiptDraftPayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      branchId,
      supplierId,
      supplierQuery,
      notes,
      items,
      receiptDiscount: discountAmount,
      receiptTax: taxAmount,
      extraCosts,
      showExtraCosts,
      splitDuplicateLines,
    }

    window.localStorage.setItem(LOCAL_RECEIPT_DRAFT_KEY, JSON.stringify(payload))
  }, [
    branchId,
    discountAmount,
    extraCosts,
    hasCreateDraftContent,
    isExistingReceipt,
    isLocalDraftHydrated,
    items,
    notes,
    showExtraCosts,
    splitDuplicateLines,
    supplierId,
    supplierQuery,
    taxAmount,
  ])

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
      Array.isArray(receipt.items) ? receipt.items.map((item: any) => normalizeReceiptItem(item)) : [],
    )
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
    // Only highlight if items exist but input is blurred
  }, [items])

  useEffect(() => {
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
        const results = getProducts(response).map((product: any) => attachStockMetrics(product))
        const exact = findExactProductMatch(results, query)
        if (!exact) return

        lastAutoScannedRef.current = normalizedQuery
        addProductToReceipt(exact.product, {
          productVariantId: exact.productVariantId,
        })
      } catch {
        // Keep barcode scanning non-blocking.
      }
    }, 120)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachStockMetrics, branchId, manualSearching, productResults, search])

  // ── Item handlers ─────────────────────────────────────────────────────────────

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
      const shouldMergeIdentity = options?.mergeIdentity ?? !splitDuplicateLines
      if (shouldMergeIdentity) {
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
    setItems((current) =>
      current.filter((item) => item.lineId !== lineId || hasLockedReceiptQuantity(item)),
    )
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
      toast.error('Vui lòng chọn nhà cung cấp trước khi áp giá gần nhất.')
      return
    }
    let changedCount = 0
    setItems((current) =>
      current.map((item) => {
        const nextItem = applyLatestSupplierPrice(item)
        if (Number(nextItem.unitCost) !== Number(item.unitCost)) changedCount += 1
        return nextItem
      }),
    )
    if (changedCount > 0) {
      toast.success(`Đã áp giá nhập gần nhất cho ${changedCount} dòng hàng.`)
      return
    }
    toast.info('Không có dòng nào cần cập nhật giá nhập từ nhà cung cấp này.')
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

  // ── Search handlers ───────────────────────────────────────────────────────────

  const resolveProductSearch = async () => {
    if (isReadOnly) return
    const query = search.trim()
    if (!query) return
    const localExact = findExactProductMatch(productResults, query)
    if (localExact) {
      addProductToReceipt(localExact.product, {
        productVariantId: localExact.productVariantId,
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
      if (results.length === 0) {
        toast.error('Không tìm thấy sản phẩm phù hợp.')
        return
      }
      const exact = findExactProductMatch(results, query)
      if (exact) {
        addProductToReceipt(exact.product, {
          productVariantId: exact.productVariantId,
        })
        return
      }
      if (results.length === 1) {
        addProductToReceipt(results[0])
        return
      }
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
    if (event.key === 'Escape') {
      setIsSuggestionOpen(false)
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    const localExact = findExactProductMatch(productResults, search)
    if (localExact) {
      addProductToReceipt(localExact.product, {
        productVariantId: localExact.productVariantId,
      })
      return
    }
    if (isSuggestionOpen && productResults[highlightedIndex]) {
      addProductToReceipt(productResults[highlightedIndex])
      return
    }
    await resolveProductSearch()
  }

  // ── Supplier handlers ─────────────────────────────────────────────────────────

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
      code: normalizeBranchCode(
        supplierForm.code || suggestBranchCodeFromName(supplierForm.name),
      ),
      name: supplierForm.name.trim(),
      phone: supplierForm.phone.trim(),
      email: supplierForm.email.trim(),
      address: supplierForm.address.trim(),
      notes: supplierForm.notes.trim(),
    })
  }

  // ── Edit session ──────────────────────────────────────────────────────────────

  const handleStartEditing = () => {
    if (!isExistingReceipt || isReceiptLocked || !canUpdateReceipt) return
    setEditBaseSignature(currentDraftSignature)
    setIsEditingSession(true)
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

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
    mutationFn: async (payload: ReceiptReturnFormState) =>
      (async () => {
        const returnResponse = await stockApi.returnReceipt(resolvedReceiptId, {
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
        })

        let nextReceipt = returnResponse?.data?.data ?? returnResponse?.data ?? null
        let refundProcessed = false
        let refundAmount = 0

        if (payload.settlementMode === 'CREATE_REFUND') {
          const latestSupplierReturn = Array.isArray(nextReceipt?.supplierReturns)
            ? nextReceipt.supplierReturns[0]
            : null
          const refundableAmount = Math.max(
            0,
            Number(latestSupplierReturn?.creditedAmount ?? 0) - Number(latestSupplierReturn?.refundedAmount ?? 0),
          )

          if (latestSupplierReturn?.id && refundableAmount > 0) {
            await stockApi.refundSupplierReturn(latestSupplierReturn.id, {
              amount: refundableAmount,
              paymentMethod: payload.refundPaymentMethod,
              notes: payload.notes.trim() || undefined,
              receivedAt: new Date().toISOString(),
              branchId: branchId || undefined,
            })
            refundProcessed = true
            refundAmount = refundableAmount
            const refreshedReceipt = await stockApi.getReceipt(resolvedReceiptId)
            nextReceipt = refreshedReceipt?.data?.data ?? refreshedReceipt?.data ?? nextReceipt
          }
        }

        return { nextReceipt, refundProcessed, refundAmount }
      })(),
    onSuccess: async ({ nextReceipt, refundProcessed, refundAmount }) => {
      syncCurrentReceiptQueries(nextReceipt)
      await refetchCurrentReceiptQueries()
      toast.success(
        refundProcessed
          ? `Đã ghi nhận hoàn trả và tạo phiếu thu ${fmt(refundAmount)} đ.`
          : 'Đã ghi nhận hoàn trả cho phiếu nhập.',
      )
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
    mutationFn: async ({ mode: submitMode }: { mode: SubmitMode }) => {
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
          mode: submitMode,
          action: 'update' as const,
          nextEditSessions,
          receiptData,
        }
      }

      const response = await stockApi.createReceipt(payload)
      const receiptData = response.data?.data || response.data || {}
      const nextReceiptId = getReceiptRedirectId(receiptData, response.data?.id)
      if (!nextReceiptId) throw new Error('Không nhận được mã phiếu nhập từ hệ thống.')
      return {
        receiptId: nextReceiptId,
        mode: submitMode,
        action: 'create' as const,
        nextEditSessions,
        receiptData,
      }
    },
    onSuccess: ({ receiptId: savedReceiptId, action, nextEditSessions, receiptData }) => {
      if (action === 'create') {
        window.localStorage.removeItem(LOCAL_RECEIPT_DRAFT_KEY)
      }
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      syncCurrentReceiptQueries(receiptData)
      invalidateCurrentReceiptQueries()
      if (savedReceiptId) {
        queryClient.invalidateQueries({ queryKey: ['receipt', savedReceiptId] })
      }
      setEditSessions(nextEditSessions)
      setEditBaseSignature(currentDraftSignature)
      setIsEditingSession(false)
      toast.success(
        action === 'update' ? 'Đã lưu cập nhật danh sách sản phẩm.' : 'Đã tạo đơn nhập thành công.',
      )
      if (action === 'update') {
        router.replace(`/inventory/receipts/${savedReceiptId}`)
        return
      }
      router.push(`/inventory/receipts/${savedReceiptId}`)
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
        (isEditMode ? 'Không thể lưu cập nhật phiếu nhập.' : 'Lỗi khi tạo phiếu nhập.'),
      )
    },
  })

  const handleSubmit = (submitMode: SubmitMode) => {
    if (!canSubmitReceipt) {
      toast.error(
        isEditMode ? 'Bạn không có quyền cập nhật phiếu nhập.' : 'Bạn không có quyền tạo phiếu nhập.',
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
    saveMutation.mutate({ mode: submitMode })
  }

  const handleConfirmPayment = () => {
    if (!resolvedReceiptId) {
      toast.error('Không xác định được phiếu nhập cần thanh toán.')
      return
    }
    if (paymentForm.amount <= 0) {
      toast.error('Vui lòng nhập số tiền thanh toán lớn hơn 0.')
      return
    }
    if (paymentForm.amount > maxPayableAmount) {
      toast.error('Số tiền thanh toán không được vượt quá số tiền còn có thể thanh toán cho NCC.')
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


  // ── Extra cost helpers ──────────────────────────────────────────────────────── 

  const addExtraCost = () => setExtraCosts((c) => [...c, createExtraCostRow()])
  const removeExtraCost = (id: string) => setExtraCosts((c) => c.filter((r) => r.id !== id))

  // ── Return ────────────────────────────────────────────────────────────────────

  return {
    // refs
    searchInputRef,
    searchPanelRef,
    supplierPanelRef,
    exportMenuRef,

    // auth
    user,
    activeBranchId,
    allowedBranches,
    isAuthLoading,
    canReadReceipt,
    canCreateReceipt,
    canUpdateReceipt,
    canPayReceipt,
    canReceiveReceipt,
    canCancelReceipt,
    canReturnReceipt,
    isCreateMode,
    isEditMode,
    isExistingReceipt,
    canAccessScreen,
    canSubmitReceipt,

    // queries
    receipt,
    isReceiptLoading,
    branches,
    suppliers,
    filteredSuppliers,
    productResults,
    isSearchingSuggestions,
    supplierReceipts,

    // state
    branchId, setBranchId,
    supplierId, setSupplierId,
    supplierQuery, setSupplierQuery,
    showSupplierSearch, setShowSupplierSearch,
    showSupplierModal, setShowSupplierModal,
    supplierForm, setSupplierForm,
    supplierCodeTouched, setSupplierCodeTouched,
    notes, setNotes,
    search, setSearch,
    manualSearching,
    isSuggestionOpen, setIsSuggestionOpen,
    highlightedIndex, setHighlightedIndex,
    items, setItems,
    receiptDiscount, setReceiptDiscount,
    receiptTax, setReceiptTax,
    extraCosts, setExtraCosts,
    showExtraCosts, setShowExtraCosts,
    editingNoteForId, setEditingNoteForId,
    tempNote, setTempNote,
    splitDuplicateLines, setSplitDuplicateLines,
    isEditingSession,
    editSessions,
    showPaymentModal, setShowPaymentModal,
    showReturnModal, setShowReturnModal,
    showExportMenu, setShowExportMenu,
    showReceiptExcelModal, setShowReceiptExcelModal,
    paymentForm, setPaymentForm,
    returnForm, setReturnForm,

    // derived
    statusView,
    creatorDisplayName,
    canShowPaymentAction,
    canShowReceiveAction,
    canShowCancelAction,
    canShowReturnAction,
    visibleProgressSteps,
    enhancedActivityTimelineEntries,
    resolvedReceiptId,
    isReceiptLocked,
    isReadOnly,
    isReceiveDone,
    isCancelled,
    isCompleted,
    isFullyPaid,
    hasAnyPayment,
    hasAnyReceive,
    selectedSupplier,
    displaySupplier,
    currentBranch,
    totalQuantity,
    merchandiseTotal,
    discountAmount,
    taxAmount,
    extraCostTotal,
    grandTotal,
    normalizedExtraCosts,
    hasPendingReceiptChanges,
    currentDebt,
    currentSupplierDebt,
    maxPayableAmount,
    currentReceiptPaidAmount,
    currentReceiptTotalAmount,
    currentReceiptOutstandingAmount,
    orderPaymentAmount,
    debtSettlementAmount,
    totalAppliedPaymentAmount,
    latestPaymentMethodLabel,
    latestPaymentAt,
    latestReceiveAt,
    paymentAllocationCount,
    returnableReceiptItems,
    estimatedRefundAmount,

    // helpers
    getLockedReceiptQuantity,
    hasLockedReceiptQuantity,
    getLatestSupplierPrice,
    openPaymentModal,
    openReturnModal,

    // handlers
    addProductToReceipt,
    updateItem,
    updateItemNote,
    updateItemVariant,
    removeItem,
    duplicateItem,
    mergeDuplicateItems,
    applyLatestSupplierPricesToItems,
    updateExtraCost,
    addExtraCost,
    removeExtraCost,
    resolveProductSearch,
    handleSearchKeyDown,
    handleOpenQuickSupplier,
    handleSelectSupplier,
    handleSaveQuickSupplier,
    handleStartEditing,
    handleSubmit,
    handleConfirmPayment,
    handleReturnItemQuantityChange,
    handleConfirmReturn,

    // mutations (for isPending states)
    saveMutation,
    payMutation,
    receiveMutation,
    cancelMutation,
    returnMutation,
    createSupplierMutation,
  }
}
