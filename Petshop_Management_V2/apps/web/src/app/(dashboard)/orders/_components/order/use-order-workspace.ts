'use client'

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { formatDateTime } from '@/lib/utils'
import {
  orderApi,
  type CompleteOrderPayload,
  type CreateOrderPayload,
  type UpdateOrderPayload,
} from '@/lib/api/order.api'
import { buildFinanceVoucherHref } from '@/lib/finance-routes'
import { settingsApi } from '@/lib/api/settings.api'
import { filterVisiblePaymentMethods } from '@/lib/payment-methods'
import { useAuthorization } from '@/hooks/useAuthorization'
import {
  buildDirectServiceCartItem,
  buildDraftFromOrder,
  buildGroomingCartItem,
  buildOrderPayload,
  buildProductCartItem,
  buildCartLineId,
  canApproveCurrentOrder,
  canExportCurrentOrder,
  canPayCurrentOrder,
  canSettleCurrentOrder,
  createEmptyDraft,
  isGroomingService,
  isHotelService,
  isOrderReadonly,
  parseDecimalInput,
} from './order.utils'
import type { OrderDraft, OrderPrintPayload, OrderWorkspaceMode } from './order.types'
import { useBranches } from '@/app/(dashboard)/pos/_hooks/use-pos-queries'
import {
  useCustomerDetail,
  useCustomerSearch,
  usePosProducts as useOrderProducts,
  usePosServices as useOrderServices,
} from '@/components/search/use-commerce-search'

function findTimelineActionTime(timeline: any[], actions: string[]) {
  return timeline.find((entry) => actions.includes(String(entry?.action ?? '').toUpperCase()))?.createdAt
}

function buildSearchHref(basePath: string, params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return
    query.set(key, value)
  })
  const search = query.toString()
  return search ? `${basePath}?${search}` : basePath
}

export function useOrderWorkspace({ mode, orderId }: { mode: OrderWorkspaceMode; orderId?: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, activeBranchId, isLoading: isAuthLoading, hasAnyPermission, hasPermission } = useAuthorization()

  const canAccessOrders =
    mode === 'create' ? hasPermission('order.create') : hasAnyPermission(['order.read.all', 'order.read.assigned'])
  const canUpdateOrder = hasPermission('order.update')
  const canPayOrder = hasPermission('order.pay')
  const canApproveOrder = hasPermission('order.approve')
  const canExportStock = hasPermission('order.export_stock')
  const canSettleOrder = hasPermission('order.settle')

  const [draft, setDraft] = useState<OrderDraft>(() => createEmptyDraft(activeBranchId ?? undefined))
  const [isEditing, setIsEditing] = useState(mode === 'create')
  const [itemSearch, setItemSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showExportStockModal, setShowExportStockModal] = useState(false)
  const [showSettleModal, setShowSettleModal] = useState(false)
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

  const visibleProgressSteps = useMemo(() => {
    const currentStatus = order?.status ?? (mode === 'create' ? 'DRAFT' : undefined)
    const currentStage =
      currentStatus === 'COMPLETED'
        ? 3
        : currentStatus === 'PROCESSING'
          ? 2
          : currentStatus === 'CONFIRMED'
            ? 1
            : 0
    const approvedAt = order?.approvedAt ?? findTimelineActionTime(timeline, ['APPROVED'])
    const exportedAt = order?.stockExportedAt ?? findTimelineActionTime(timeline, ['STOCK_EXPORTED'])
    const settledAt =
      order?.settledAt ??
      order?.completedAt ??
      findTimelineActionTime(timeline, ['SETTLED', 'COMPLETED'])
    const steps = [
      { key: 'DRAFT', label: 'Tạo đơn', state: 'pending' as const },
      { key: 'CONFIRMED', label: 'Xác nhận', state: 'pending' as const },
      { key: 'PROCESSING', label: 'Xuất kho', state: 'pending' as const },
      { key: 'COMPLETED', label: 'Hoàn thành', state: 'pending' as const },
    ]
    return steps.map((step) => {
      const stepIdx =
        step.key === 'COMPLETED'
          ? 3
          : step.key === 'PROCESSING'
            ? 2
            : step.key === 'CONFIRMED'
              ? 1
              : 0
      const stepMeta =
        step.key === 'COMPLETED'
          ? settledAt
          : step.key === 'PROCESSING'
            ? exportedAt
            : step.key === 'CONFIRMED'
              ? approvedAt
              : order?.createdAt
      if (currentStatus === 'CANCELLED') {
        return { ...step, meta: stepMeta ? formatDateTime(stepMeta) : '—', state: 'alert' as const }
      }
      if (stepIdx < currentStage) {
        return { ...step, meta: stepMeta ? formatDateTime(stepMeta) : '—', state: 'done' as const }
      }
      if (stepIdx === currentStage) {
        return { ...step, meta: stepMeta ? formatDateTime(stepMeta) : '—', state: 'active' as const }
      }
      return { ...step, meta: stepMeta ? formatDateTime(stepMeta) : '—' }
    })
  }, [
    mode,
    order?.approvedAt,
    order?.completedAt,
    order?.createdAt,
    order?.settledAt,
    order?.status,
    order?.stockExportedAt,
    timeline,
  ])
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
    () => (deferredItemSearch.trim() ? (productResults as any[]).slice(0, 6) : []),
    [deferredItemSearch, productResults],
  )
  const serviceMatches = useMemo(
    () => (deferredItemSearch.trim() ? (serviceResults as any[]).slice(0, 6) : []),
    [deferredItemSearch, serviceResults],
  )
  const selectedPets = (customerDetail?.pets as any[]) ?? []
  const selectedCustomerName = customerDetail?.fullName || customerDetail?.name || draft.customerName
  const selectedCustomerPhone = customerDetail?.phone || order?.customer?.phone || ''
  const selectedCustomerAddress = customerDetail?.address || order?.customer?.address || ''
  const relatedDocuments = useMemo(() => {
    if (!order) return []

    const documents = new Map<string, { id: string; label: string; href: string; tone: string }>()

    for (const transaction of order.transactions ?? []) {
      if (!transaction?.voucherNumber) continue
      const prefix = transaction.type === 'EXPENSE' ? 'PC' : 'PT'
      const key = `finance:${transaction.voucherNumber}`
      documents.set(key, {
        id: key,
        label: `${prefix}: ${transaction.voucherNumber}`,
        href: buildFinanceVoucherHref(transaction.voucherNumber),
        tone: transaction.type === 'EXPENSE' ? 'expense' : 'income',
      })
    }

    for (const item of order.items ?? []) {
      const groomingId = item?.groomingSessionId
      if (groomingId) {
        const sessionCode = item?.groomingSession?.sessionCode || null
        const searchValue = sessionCode || groomingId
        const key = `grooming:${groomingId}`
        documents.set(key, {
          id: key,
          label: `SPA: ${sessionCode || groomingId.slice(-6).toUpperCase()}`,
          href: buildSearchHref('/grooming', {
            view: 'list',
            search: searchValue,
            sessionId: groomingId,
          }),
          tone: 'grooming',
        })
      }

      const hotelStay = item?.hotelStay
      const hotelStayId = hotelStay?.id || item?.hotelStayId
      if (hotelStayId) {
        const stayCode = hotelStay?.stayCode || null
        const searchValue = stayCode || hotelStayId
        const key = `hotel:${hotelStayId}`
        documents.set(key, {
          id: key,
          label: `HOTEL: ${stayCode || hotelStayId.slice(-6).toUpperCase()}`,
          href: buildSearchHref('/hotel', {
            view: 'list',
            search: searchValue,
            stayId: hotelStayId,
          }),
          tone: 'hotel',
        })
      }
    }

    return Array.from(documents.values())
  }, [order])

  const canEditCurrentOrder =
    mode === 'detail' && canUpdateOrder && !isOrderReadonly(order?.status)
  const actionFlags = {
    canAccessOrders,
    canUpdateOrder,
    canPayOrder,
    canApproveOrder,
    canExportStock,
    canSettleOrder,
    canEditCurrentOrder,
    canApproveCurrentOrder: mode === 'detail' && canApproveCurrentOrder(order, canApproveOrder),
    canExportCurrentOrder: mode === 'detail' && canExportCurrentOrder(order, canExportStock),
    canSettleCurrentOrder:
      mode === 'detail' && canSettleCurrentOrder(order, canSettleOrder, hasServiceItems),
    canPayCurrentOrder: mode === 'detail' && canPayCurrentOrder(order, canPayOrder),
    isOrderReadonly: isOrderReadonly(order?.status),
  }

  const invalidateOrderQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
    if (orderId) {
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      void queryClient.invalidateQueries({ queryKey: ['order-timeline', orderId] })
      void queryClient.invalidateQueries({ queryKey: ['order-payment-intents', orderId] })
    }
  }

  const createOrderMutation = useMutation({
    mutationFn: () => orderApi.create(buildOrderPayload(draft) as CreateOrderPayload),
    onSuccess: (createdOrder) => {
      toast.success('Đã tạo đơn hàng thành công')
      invalidateOrderQueries()
      startTransition(() => router.replace(`/orders/${createdOrder.id}`))
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể tạo đơn hàng'),
  })

  const updateOrderMutation = useMutation({
    mutationFn: () => orderApi.update(orderId!, buildOrderPayload(draft) as UpdateOrderPayload),
    onSuccess: (updatedOrder) => {
      toast.success('Đã cập nhật đơn hàng')
      invalidateOrderQueries()
      setDraft(buildDraftFromOrder(updatedOrder))
      setIsEditing(false)
      initializedOrderVersionRef.current = `${updatedOrder.id}:${updatedOrder.updatedAt ?? updatedOrder.createdAt ?? ''}`
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể cập nhật đơn hàng'),
  })

  const payOrderMutation = useMutation({
    mutationFn: (payload: { payments: Array<{ method: string; amount: number; paymentAccountId?: string; paymentAccountLabel?: string }> }) =>
      orderApi.pay(orderId!, payload),
    onSuccess: () => {
      toast.success('Đã ghi nhận thanh toán')
      setShowPayModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể thanh toán đơn'),
  })

  const approveOrderMutation = useMutation({
    mutationFn: (payload: { note?: string }) => orderApi.approve(orderId!, payload),
    onSuccess: () => {
      toast.success('Đã duyệt đơn hàng')
      setShowApproveModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể duyệt đơn'),
  })

  const exportStockMutation = useMutation({
    mutationFn: (payload: { note?: string }) => orderApi.exportStock(orderId!, payload),
    onSuccess: () => {
      toast.success('Đã xuất kho đơn hàng')
      setShowExportStockModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể xuất kho'),
  })

  const settleOrderMutation = useMutation({
    mutationFn: (payload: CompleteOrderPayload) => orderApi.complete(orderId!, payload),
    onSuccess: () => {
      toast.success('Đã quyết toán đơn hàng')
      setShowSettleModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể quyết toán'),
  })

  const cancelOrderMutation = useMutation({
    mutationFn: () => orderApi.cancel(orderId!, { reason: 'Hủy từ Order Workspace' }),
    onSuccess: () => {
      toast.success('Đã hủy đơn hàng')
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thể hủy đơn'),
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

  const addCatalogItem = (entry: any) => {
    if (!isEditing) return

    if (entry.entryType?.startsWith('product') || entry.productId) {
      const rawVariants = Array.isArray(entry.variants) ? entry.variants : []
      const productVariants = rawVariants.filter((v: any) => !v.conversions || !Array.isArray(v.conversions) || v.conversions.length === 0)
      const hasVariants = productVariants.length > 0

      if (hasVariants) {
        setPendingProductEntry(entry)
        return
      }

      mergeItemIntoDraft(buildProductCartItem(entry))
      setItemSearch('')
      return
    }

    if (isHotelService(entry)) {
      if (!draft.customerId) {
        toast.error('Cần chọn khách hàng trước khi thêm dịch vụ hotel')
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

    const variantEntry = {
      ...pendingProductEntry,
      id: `product:${pendingProductEntry.productId}:${variant.id}`,
      entryId: `product:${pendingProductEntry.productId}:${variant.id}`,
      entryType: 'product-variant',
      productVariantId: variant.id,
      variantLabel: variant.name,
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

  const pendingAction =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    payOrderMutation.isPending ||
    approveOrderMutation.isPending ||
    exportStockMutation.isPending ||
    settleOrderMutation.isPending ||
    cancelOrderMutation.isPending

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
    showApproveModal,
    setShowApproveModal,
    showExportStockModal,
    setShowExportStockModal,
    showSettleModal,
    setShowSettleModal,
    hotelServiceDraft,
    setHotelServiceDraft,
    groomingServiceDraft,
    setGroomingServiceDraft,
    branches,
    timeline,
    customerResults,
    customerDetail,
    productMatches,
    serviceMatches,
    selectedPets,
    selectedCustomerName,
    selectedCustomerPhone,
    selectedCustomerAddress,
    relatedDocuments,
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
    approveOrderMutation,
    exportStockMutation,
    settleOrderMutation,
    cancelOrderMutation,
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
