'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { resolveProductVariantLabels } from '@petshop/shared'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { orderApi } from '@/lib/api/order.api'
import { settingsApi } from '@/lib/api/settings.api'
import { filterVisiblePaymentMethods } from '@/lib/payment-methods'
import { useAuthorization } from '@/hooks/useAuthorization'
import {
  buildDirectServiceCartItem,
  buildDraftFromOrder,
  buildGroomingCartItem,
  buildProductCartItem,
  buildCartLineId,
  canExportCurrentOrder,
  canPayCurrentOrder,
  canRefundCurrentOrder,
  canReturnCurrentOrder,
  canSettleCurrentOrder,
  createEmptyDraft,
  isGroomingService,
  isHotelService,
  isOrderReadonly,
  canCancelCurrentOrder,
  parseDecimalInput,
} from './order.utils'
import type { OrderDraft, OrderPrintPayload, OrderWorkspaceMode } from './order.types'
import { useOrderWorkspaceMutations } from './use-order-workspace-mutations'
import { useBranches } from '@/app/(dashboard)/_shared/branches/use-branches'
import {
  useCustomerDetail,
  useCustomerSearch,
  usePosProducts as useOrderProducts,
  usePosServices as useOrderServices,
} from '@/components/search/use-commerce-search'
import { buildDisplayTimeline } from './order-timeline.utils'
import { buildVisibleProgressSteps } from './order-progress.utils'

export function useOrderWorkspace({ mode, orderId }: { mode: OrderWorkspaceMode; orderId?: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, activeBranchId, isLoading: isAuthLoading, hasAnyPermission, hasPermission } = useAuthorization()

  const canAccessOrders =
    mode === 'create' ? hasPermission('order.create') : hasAnyPermission(['order.read.all', 'order.read.assigned'])
  const canUpdateOrder = hasPermission('order.update')
  const canPayOrder = hasPermission('order.pay')
  const canExportStock = hasPermission('order.export_stock')
  const canSettleOrder = hasPermission('order.settle')
  const canCancelOrder = hasPermission('order.cancel') || true
  const canRefundOrder = hasPermission('order.refund') || true // Default to true as refund might not be in permissions yet

  const [draft, setDraft] = useState<OrderDraft>(() => createEmptyDraft(activeBranchId ?? undefined))
  const [isEditing, setIsEditing] = useState(mode === 'create')
  const [itemSearch, setItemSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [showExportStockModal, setShowExportStockModal] = useState(false)
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [hotelServiceDraft, setHotelServiceDraft] = useState<any | null>(null)
  const [groomingServiceDraft, setGroomingServiceDraft] = useState<any | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1)
  const [pendingProductEntry, setPendingProductEntry] = useState<any | null>(null)
  const initializedOrderVersionRef = useRef<string | null>(null)

  const deferredItemSearch = useDeferredValue(itemSearch)
  const deferredCustomerSearch = useDeferredValue(customerSearch)

  const { data: branches = [] } = useBranches()
  const { data: order, isLoading: isOrderLoading, isError: isOrderError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderApi.get(orderId!),
    enabled: mode === 'detail' && Boolean(orderId),
  })
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['settings', 'payment-methods'],
    queryFn: () => settingsApi.getPaymentMethods(),
    staleTime: 30_000,
  })
  const { data: timeline = [] } = useQuery({
    queryKey: ['order-timeline', orderId],
    queryFn: () => orderApi.getTimeline(orderId!),
    enabled: mode === 'detail' && Boolean(orderId),
  })
  const { data: paymentIntents = [] } = useQuery({
    queryKey: ['order-payment-intents', orderId],
    queryFn: () => orderApi.listPaymentIntents(orderId!),
    enabled: mode === 'detail' && Boolean(orderId),
  })
  const { data: customerResults = [] } = useCustomerSearch(deferredCustomerSearch)
  const { data: customerDetail } = useCustomerDetail(draft.customerId)
  const { data: productResults = [] } = useOrderProducts(deferredItemSearch)
  const { data: serviceResults = [] } = useOrderServices(deferredItemSearch)

  useEffect(() => {
    if (isAuthLoading || canAccessOrders) return
    router.replace('/dashboard')
  }, [canAccessOrders, isAuthLoading, router])

  useEffect(() => {
    if (mode !== 'detail' || !order) return
    const orderVersion = `${order.id}:${order.updatedAt ?? order.createdAt ?? ''}`
    if (initializedOrderVersionRef.current === orderVersion && isEditing) return
    if (initializedOrderVersionRef.current === orderVersion && draft.items.length > 0) return
    setDraft(buildDraftFromOrder(order))
    setIsEditing(false)
    initializedOrderVersionRef.current = orderVersion
  }, [draft.items.length, isEditing, mode, order])

  const orderNeedsBranch = (items: any[]) =>
    items.some((item) => item.productVariantId || (item.variants && item.variants.length > 0))

  useEffect(() => {
    if (mode !== 'create' || draft.branchId || !activeBranchId) return
    if (draft.items.length > 0 && !orderNeedsBranch(draft.items)) return
    setDraft((current) => ({ ...current, branchId: activeBranchId }))
  }, [activeBranchId, draft.branchId, draft.items, mode])

  useEffect(() => {
    setSelectedRowIndex((current) => {
      if (draft.items.length === 0) return -1
      if (current < 0) return 0
      return Math.min(current, draft.items.length - 1)
    })
  }, [draft.items.length])

  // ── Derived timeline & progress (delegated to utils) ──────────────────────
  const displayTimeline = useMemo(
    () => buildDisplayTimeline(mode, order, timeline),
    [mode, order, timeline],
  )

  const branchName = useMemo(
    () =>
      branches.find((branch: any) => branch.id === (order?.branchId ?? draft.branchId))?.name ??
      'Chưa chọn chi nhánh',
    [branches, draft.branchId, order?.branchId],
  )

  const showBranch = useMemo(() => {
    if (mode === 'detail' && order?.branchId) return true
    const items = mode === 'detail' ? (order?.items ?? []) : draft.items
    return items.some((item: any) => item.productVariantId || (item.variants && item.variants.length > 0))
  }, [mode, order?.branchId, order?.items, draft.items])

  const operatorName = user?.fullName || user?.username || 'NHÂN VIÊN'
  const operatorCode = user?.staffCode || ''

  const visibleProgressSteps = useMemo(
    () => buildVisibleProgressSteps(mode, order, displayTimeline),
    [mode, order, displayTimeline],
  )

  const subtotal = useMemo(
    () =>
      draft.items.reduce(
        (sum, item) =>
          sum +
          Number(item.unitPrice || 0) * Number(item.quantity || 0) -
          Number(item.discountItem || 0),
        0,
      ),
    [draft.items],
  )
  const total = Math.max(0, subtotal + draft.shippingFee - draft.discount)
  const amountPaid = Number(order?.paidAmount ?? order?.amountPaid ?? 0)
  const remainingAmount = Math.max(0, total - amountPaid)
  const hasServiceItems = draft.items.some((item) => item.type === 'grooming' || item.type === 'hotel')
  const visiblePaymentMethods = useMemo(
    () =>
      filterVisiblePaymentMethods(paymentMethods, {
        branchId: order?.branchId ?? draft.branchId,
        amount: remainingAmount > 0 ? remainingAmount : total,
      }),
    [draft.branchId, order?.branchId, paymentMethods, remainingAmount, total],
  )
  const productMatches = useMemo(
    () => (deferredItemSearch.trim() ? (productResults as any[]).slice(0, 10) : []),
    [deferredItemSearch, productResults],
  )
  const serviceMatches = useMemo(
    () => (deferredItemSearch.trim() ? (serviceResults as any[]).slice(0, 8) : []),
    [deferredItemSearch, serviceResults],
  )
  const selectedPets = (customerDetail?.pets as any[]) ?? []
  const selectedCustomerName = customerDetail?.fullName || customerDetail?.name || draft.customerName
  const selectedCustomerPhone = customerDetail?.phone || order?.customer?.phone || ''
  const selectedCustomerAddress = customerDetail?.address || order?.customer?.address || ''
  const canEditCurrentOrder =
    mode === 'detail' && canUpdateOrder && !isOrderReadonly(order?.status)
  const actionFlags = {
    canAccessOrders,
    canUpdateOrder,
    canPayOrder,
    canExportStock,
    canSettleOrder,
    canEditCurrentOrder,
    canExportCurrentOrder: mode === 'detail' && canExportCurrentOrder(order, canExportStock),
    canCancelOrder: mode === 'detail' && canCancelCurrentOrder(order, canCancelOrder),
    canSettleCurrentOrder:
      mode === 'detail' && canSettleCurrentOrder(order, canSettleOrder, hasServiceItems),
    canPayCurrentOrder: mode === 'detail' && canPayCurrentOrder(order, canPayOrder),
    canRefundCurrentOrder: mode === 'detail' && canRefundCurrentOrder(order, canRefundOrder),
    canReturnCurrentOrder: mode === 'detail' && canReturnCurrentOrder(order, canRefundOrder),
    isOrderReadonly: isOrderReadonly(order?.status),
  }

  const {
    pendingAction,
    createOrderMutation,
    updateOrderMutation,
    payOrderMutation,
    exportStockMutation,
    settleOrderMutation,
    cancelOrderMutation,
    refundOrderMutation,
    createReturnRequestMutation,
  } = useOrderWorkspaceMutations({
    orderId,
    draft,
    router,
    queryClient,
    initializedOrderVersionRef,
    setDraft,
    setIsEditing,
    setShowPayModal,
    setShowExportStockModal,
    setShowSettleModal,
    setShowRefundModal,
    setShowReturnModal,
  })

  const mergeItemIntoDraft = (item: any) => {
    setDraft((current) => {
      const mergeableTypes = new Set(['product', 'service'])
      const existingIndex = mergeableTypes.has(item.type)
        ? current.items.findIndex((entry) => entry.id === item.id && entry.type === item.type)
        : -1

      if (existingIndex >= 0) {
        setSelectedRowIndex(existingIndex)
        const nextItems = [...current.items]
        nextItems[existingIndex] = {
          ...nextItems[existingIndex],
          quantity: Number(nextItems[existingIndex].quantity || 0) + Number(item.quantity || 1),
        }
        return { ...current, items: nextItems }
      }

      setSelectedRowIndex(current.items.length)
      return { ...current, items: [...current.items, item] }
    })
  }

  const addCatalogItem = (entry: any, _petId?: string, _petName?: string) => {
    if (!isEditing) return

    if (entry.entryType?.startsWith('product') || entry.productId) {
      mergeItemIntoDraft(buildProductCartItem(entry))
      setItemSearch('')
      return
    }

    if (isHotelService(entry)) {
      if (!draft.customerId) {
        toast.error('Cần chọn khách hàng trước khi thêm dịch vụ hotel')
        return
      }
      if (_petId) {
        const cartItem = buildDirectServiceCartItem(entry, _petId, _petName)
        if (_petName) cartItem.itemNotes = `Thú cưng: ${_petName}`
        mergeItemIntoDraft(cartItem)
        setItemSearch('')
        toast.success('Đã thêm dịch vụ lưu chuồng vào giỏ')
        return
      }
      setHotelServiceDraft(entry)
      return
    }

    if (isGroomingService(entry)) {
      if (!draft.customerId) {
        toast.error('Cần chọn khách hàng trước khi thêm dịch vụ grooming')
        return
      }
      if (_petId) {
        const cartItem = buildGroomingCartItem(entry, _petId, _petName)
        if (_petName) cartItem.itemNotes = `Thú cưng: ${_petName}`
        mergeItemIntoDraft(cartItem)
        setItemSearch('')
        toast.success('Đã thêm dịch vụ vào giỏ')
        return
      }
      setGroomingServiceDraft(entry)
      return
    }

    mergeItemIntoDraft(buildDirectServiceCartItem(entry))
    setItemSearch('')
  }

  const handleSelectProductVariant = (variant: any) => {
    if (!pendingProductEntry || !isEditing) {
      setPendingProductEntry(null)
      return
    }

    const resolvedVariant = resolveProductVariantLabels(
      pendingProductEntry.productName ?? pendingProductEntry.name,
      variant,
    )

    const variantEntry = {
      ...pendingProductEntry,
      id: `product:${pendingProductEntry.productId}:${variant.id}`,
      entryId: `product:${pendingProductEntry.productId}:${variant.id}`,
      entryType: 'product-variant',
      productVariantId: variant.id,
      variantLabel: resolvedVariant.variantLabel ?? undefined,
      unitLabel: resolvedVariant.unitLabel ?? undefined,
      displayName: variant.displayName ?? resolvedVariant.displayName ?? pendingProductEntry.displayName,
      sku: variant.sku ?? pendingProductEntry.sku,
      barcode: variant.barcode ?? pendingProductEntry.barcode,
      image: variant.image ?? pendingProductEntry.image,
      price: variant.sellingPrice ?? variant.price ?? pendingProductEntry.sellingPrice,
      sellingPrice: variant.sellingPrice ?? variant.price ?? pendingProductEntry.sellingPrice,
    }

    mergeItemIntoDraft(buildProductCartItem(variantEntry))
    setPendingProductEntry(null)
    setItemSearch('')
  }

  const handleCloseVariantSelector = () => {
    setPendingProductEntry(null)
  }

  const handleHotelBookingConfirm = (payload: any) => {
    const service = hotelServiceDraft
    const details = payload?.details
    const preview = details?.pricingPreview
    const bookingGroupKey = `hotel-${service?.id ?? 'service'}-${details?.petId}-${Date.now()}`
    const selectedPet = selectedPets.find((pet) => pet.id === details?.petId)
    const chargeLines = Array.isArray(preview?.chargeLines) ? preview.chargeLines : []

    if (service && chargeLines.length > 0) {
      chargeLines.forEach((line: any, index: number) => {
        mergeItemIntoDraft({
          ...buildDirectServiceCartItem(service, details.petId, selectedPet?.name),
          id: buildCartLineId('hotel', service.id, details.petId, bookingGroupKey, index),
          description: line.label || service.name,
          quantity: Number(line.quantityDays ?? 1),
          unitPrice: Number(line.unitPrice ?? service?.sellingPrice ?? service?.price ?? 0),
          hotelDetails: {
            petId: details.petId,
            checkIn: details.checkIn,
            checkOut: details.checkOut,
            lineType: details.lineType ?? line.dayType ?? 'REGULAR',
            bookingGroupKey,
            chargeLineIndex: index,
            chargeLineLabel: line.label,
            chargeDayType: line.dayType,
            chargeQuantityDays: Number(line.quantityDays ?? 1),
            chargeUnitPrice: Number(line.unitPrice ?? 0),
            chargeSubtotal: Number(line.subtotal ?? 0),
            chargeWeightBandId: preview?.weightBand?.id ?? null,
            chargeWeightBandLabel: preview?.weightBand?.label ?? null,
            pricingPreview: preview,
          },
        })
      })
    } else if (service) {
      mergeItemIntoDraft({
        ...buildDirectServiceCartItem(service, details?.petId, selectedPet?.name),
        hotelDetails: {
          petId: details.petId,
          checkIn: details.checkIn,
          checkOut: details.checkOut,
          lineType: details.lineType ?? 'REGULAR',
          pricingPreview: preview,
        },
      })
    }

    setHotelServiceDraft(null)
    setItemSearch('')
  }

  const handleGroomingConfirm = ({ petId, petName }: { petId: string; petName?: string }) => {
    if (!groomingServiceDraft) return
    mergeItemIntoDraft(buildGroomingCartItem(groomingServiceDraft, petId, petName))
    setGroomingServiceDraft(null)
    setItemSearch('')
  }

  const handleSave = () => {
    if (draft.items.length === 0) {
      toast.error('Đơn hàng phải có ít nhất một sản phẩm hoặc dịch vụ')
      return
    }

    if (mode === 'create') {
      createOrderMutation.mutate()
      return
    }

    updateOrderMutation.mutate()
  }

  const handleCancelEdit = () => {
    if (!order) return
    setDraft(buildDraftFromOrder(order))
    setIsEditing(false)
  }

  const showLoading = isAuthLoading || (mode === 'detail' && isOrderLoading)
  const showForbidden = !showLoading && !canAccessOrders
  const showNotFound = mode === 'detail' && !showLoading && (isOrderError || !order)
  const canKeepCredit = Boolean(order?.customer?.id ?? draft.customerId)

  const printPayload = useMemo<OrderPrintPayload | null>(() => {
    if (mode !== 'detail' || !order) return null
    return {
      order,
      branchName,
      customerName: selectedCustomerName || 'Khách lẻ',
      customerPhone: selectedCustomerPhone || undefined,
      items: draft.items,
      subtotal,
      discount: draft.discount,
      shippingFee: draft.shippingFee,
      total,
      amountPaid,
      remainingAmount,
      notes: draft.notes,
      paymentStatus: order?.paymentStatus,
      orderStatus: order?.status,
    }
  }, [
    amountPaid,
    branchName,
    draft.discount,
    draft.items,
    draft.notes,
    draft.shippingFee,
    mode,
    order,
    remainingAmount,
    selectedCustomerName,
    selectedCustomerPhone,
    subtotal,
    total,
  ])

  return {
    mode,
    orderId,
    order,
    draft,
    visibleProgressSteps,
    setDraft,
    itemSearch,
    setItemSearch,
    customerSearch,
    setCustomerSearch,
    isEditing,
    setIsEditing,
    showPayModal,
    setShowPayModal,
    showExportStockModal,
    setShowExportStockModal,
    showSettleModal,
    setShowSettleModal,
    showRefundModal,
    setShowRefundModal,
    showReturnModal,
    setShowReturnModal,
    hotelServiceDraft,
    setHotelServiceDraft,
    groomingServiceDraft,
    setGroomingServiceDraft,
    branches,
    timeline: displayTimeline,
    paymentIntents,
    customerResults,
    customerDetail,
    productMatches,
    serviceMatches,
    selectedPets,
    selectedCustomerName,
    selectedCustomerPhone,
    selectedCustomerAddress,
    branchName,
    showBranch,
    operatorName,
    operatorCode,
    subtotal,
    total,
    amountPaid,
    remainingAmount,
    selectedRowIndex,
    setSelectedRowIndex,
    visiblePaymentMethods,
    actionFlags,
    pendingAction,
    showLoading,
    showForbidden,
    showNotFound,
    printPayload,
    canKeepCredit,
    payOrderMutation,
    exportStockMutation,
    settleOrderMutation,
    cancelOrderMutation,
    refundOrderMutation,
    createReturnRequestMutation,
    addCatalogItem,
    handleHotelBookingConfirm,
    handleGroomingConfirm,
    handleSave,
    handleCancelEdit,
    handleBack: () => router.push('/orders'),
    handleGoPos: () => router.push('/pos'),
    handleStartEdit: () => setIsEditing(true),
    handleSelectCustomer: (customer: any) => {
      setDraft((current) => ({
        ...current,
        customerId: customer.id,
        customerName: customer.fullName || customer.name || 'Khách lẻ',
      }))
      setCustomerSearch('')
    },
    handleClearCustomer: () => {
      setDraft((current) => ({ ...current, customerId: undefined, customerName: 'Khách lẻ' }))
      setCustomerSearch('')
    },
    handleChangeBranch: (branchId?: string) =>
      setDraft((current) => ({ ...current, branchId })),
    handleChangeCustomerName: (customerName: string) =>
      setDraft((current) => ({ ...current, customerName })),
    handleChangeDiscount: (value: string) =>
      setDraft((current) => ({
        ...current,
        discount: Math.max(0, parseDecimalInput(value, current.discount)),
      })),
    handleChangeShippingFee: (value: string) =>
      setDraft((current) => ({
        ...current,
        shippingFee: Math.max(0, parseDecimalInput(value, current.shippingFee)),
      })),
    handleChangeNotes: (notes: string) =>
      setDraft((current) => ({ ...current, notes })),
    handleChangeItemQuantity: (index: number, value: string) =>
      setDraft((current) => ({
        ...current,
        items: current.items.map((entry, itemIndex) =>
          itemIndex === index
            ? {
              ...entry,
              quantity: Math.max(
                entry.type === 'hotel' ? 0.5 : 1,
                parseDecimalInput(value, entry.quantity),
              ),
            }
            : entry,
        ),
      })),
    handleChangeItemUnitPrice: (index: number, value: string) =>
      setDraft((current) => ({
        ...current,
        items: current.items.map((entry, itemIndex) =>
          itemIndex === index
            ? {
              ...entry,
              unitPrice: Math.max(0, parseDecimalInput(value, entry.unitPrice)),
            }
            : entry,
        ),
      })),
    handleChangeItemDiscount: (index: number, value: string) =>
      setDraft((current) => ({
        ...current,
        items: current.items.map((entry, itemIndex) =>
          itemIndex === index
            ? {
              ...entry,
              discountItem: Math.max(0, parseDecimalInput(value, entry.discountItem ?? 0)),
            }
            : entry,
        ),
      })),
    handleRemoveItem: (index: number) =>
      setDraft((current) => {
        setSelectedRowIndex((selectedIndex) => {
          const nextLength = current.items.length - 1
          if (nextLength <= 0) return -1
          if (selectedIndex > index) return selectedIndex - 1
          if (selectedIndex === index) return Math.max(0, index - 1)
          return Math.min(selectedIndex, nextLength - 1)
        })

        return {
          ...current,
          items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }
      }),
    pendingProductEntry,
    handleSelectProductVariant,
    handleCloseVariantSelector,
  }
}
