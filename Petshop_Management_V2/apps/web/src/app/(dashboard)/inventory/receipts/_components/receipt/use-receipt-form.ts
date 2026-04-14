'use client'

import { getReceiptStatusView, fmt } from './receipt.utils';
import dayjs from 'dayjs';
import React from 'react';

import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useAuthStore } from '@/stores/auth.store'
import { useAuthorization } from '@/hooks/useAuthorization'
import { api } from '@/lib/api'
import { stockApi } from '@/lib/api/stock.api'
import { inventoryApi } from '@/lib/api/inventory.api'
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
import { SUPPLIER_RECEIPT_DRAFT_KEY } from './receipt.constants'
import {
  applyVariantSelection,
  buildReceiptNotes,
  createExtraCostRow,
  createLineId,
  createReceiptDraftSignature,
  createSupplierDraft,
  filterSuppliers,
  findExactProductMatch,
  getItemIdentity,
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
  const [paymentForm, setPaymentForm] = useState<ReceiptPaymentFormState>({
    amount: 0,
    paymentMethod: 'BANK',
    notes: '',
  })
  const [returnForm, setReturnForm] = useState<ReceiptReturnFormState>({
    notes: '',
    items: [],
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
    if (!resolvedReceiptId || currentDebt <= 0) return
    setPaymentForm({ amount: currentDebt, paymentMethod: 'BANK', notes: '' })
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
      Array.isArray(receipt.items) ? receipt.items.map((item: any) => normalizeReceiptItem(item)) : [],
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
        // keep scan mode non-blocking
      }
    }, 120)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, manualSearching, productResults, scanMode, search])

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
    setItems((current) =>
      current.filter((item) => item.lineId !== lineId || hasLockedReceiptQuantity(item)),
    )
  }

  const toggleLineSelection = (lineId: string) => {
    if (isReadOnly) return
    setSelectedLineIds((current) =>
      current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId],
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
      current.filter(
        (item) => !selectedLineIds.includes(item.lineId) || hasLockedReceiptQuantity(item),
      ),
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
      if (results.length === 0) {
        toast.error('Không tìm thấy sản phẩm phù hợp.')
        return
      }
      const exact = findExactProductMatch(results, query)
      if (exact) {
        addProductToReceipt(exact.product, {
          productVariantId: exact.productVariantId,
          mergeIdentity: true,
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

  
  
  // ── Derived View State ────────────────────────────────────────────────────────
  const statusView = getReceiptStatusView(receipt)

  const canShowPaymentAction =
    receipt?.status !== 'CANCELLED' && receipt?.status !== 'DRAFT' && !isFullyPaid

  const canShowReceiveAction =
    receipt?.status !== 'CANCELLED' && receipt?.status !== 'DRAFT' && !isReceiveDone

  const canShowCancelAction =
    receipt?.status !== 'CANCELLED' && receipt?.status !== 'COMPLETED'

  const canShowReturnAction =
    receipt?.status === 'COMPLETED'

  const visibleProgressSteps = (() => {
    if (receipt?.status === 'CANCELLED') {
      return [
        { title: 'Tạo đơn', state: 'alert', meta: 'Đã hủy' },
      ]
    }
    const steps = [
      { title: 'Tạo đơn', state: 'completed', meta: '' },
      {
        title: 'Thanh toán',
        state: hasAnyPayment ? (isFullyPaid ? 'completed' : 'active') : 'pending',
        meta: isFullyPaid ? 'Hoàn tất' : hasAnyPayment ? 'Một phần' : 'Chờ TT',
      },
      {
        title: 'Nhập kho',
        state: hasAnyReceive ? (isReceiveDone ? 'completed' : 'active') : 'pending',
        meta: isReceiveDone ? 'Hoàn tất' : hasAnyReceive ? 'Một phần' : 'Chờ nhập',
      },
      {
        title: 'Hoàn thành',
        state: isCompleted ? 'completed' : 'pending',
        meta: isCompleted ? 'Hoàn thành' : '',
      },
    ]
    return steps
  })()

  const enhancedActivityTimelineEntries = React.useMemo(() => {
    if (!receipt) return []
    const _entries: any[] = []
    
    receipt.payments?.forEach((p: any) => {
      _entries.push({
        title: 'Thanh toán ' + (p.paymentMethod || 'Tiền mặt'),
        time: dayjs(p.createdAt || new Date()).format('DD/MM/YYYY HH:mm'),
        detail: fmt(Number(p.amount)),
        tone: 'text-primary-500',
        timestamp: p.createdAt || new Date().toISOString()
      })
    })

    if (receipt.activityTimeline) {
      receipt.activityTimeline.forEach((t: any) => {
         _entries.push({
           ...t,
           timestamp: t.createdAt
         })
      })
    }

    return _entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [receipt])

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
    selectedLineIds, setSelectedLineIds,
    receiptDiscount, setReceiptDiscount,
    receiptTax, setReceiptTax,
    extraCosts, setExtraCosts,
    showExtraCosts, setShowExtraCosts,
    editingNoteForId, setEditingNoteForId,
    tempNote, setTempNote,
    scanMode, setScanMode,
    isEditingSession,
    editSessions,
    showPaymentModal, setShowPaymentModal,
    showReturnModal, setShowReturnModal,
    showExportMenu, setShowExportMenu,
    paymentForm, setPaymentForm,
    returnForm, setReturnForm,

    // derived
    statusView,
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
    currentReceiptPaidAmount,
    currentReceiptTotalAmount,
    latestPaymentAt,
    latestReceiveAt,
    paymentAllocationCount,
    returnableReceiptItems,

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
    toggleLineSelection,
    toggleSelectAllLines,
    removeSelectedItems,
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
