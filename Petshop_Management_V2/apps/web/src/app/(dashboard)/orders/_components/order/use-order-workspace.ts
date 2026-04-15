'use client'

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import {
  orderApi,
  type CompleteOrderPayload,
  type CreateOrderPayload,
  type UpdateOrderPayload,
} from '@/lib/api/order.api'
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
import {
  useBranches,
  useCustomerDetail,
  useCustomerSearch,
  useOrderProducts,
  useOrderServices,
} from './use-order-queries'

export function useOrderWorkspace({ mode, orderId }: { mode: OrderWorkspaceMode; orderId?: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { activeBranchId, isLoading: isAuthLoading, hasAnyPermission, hasPermission } = useAuthorization()

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

  useEffect(() => {
    if (mode !== 'create' || draft.branchId || !activeBranchId) return
    setDraft((current) => ({ ...current, branchId: activeBranchId }))
  }, [activeBranchId, draft.branchId, mode])

  const branchName = useMemo(
    () =>
      branches.find((branch: any) => branch.id === (order?.branchId ?? draft.branchId))?.name ??
      'Chua chon chi nhanh',
    [branches, draft.branchId, order?.branchId],
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
    () => (deferredItemSearch.trim() ? (productResults as any[]).slice(0, 6) : []),
    [deferredItemSearch, productResults],
  )
  const serviceMatches = useMemo(
    () => (deferredItemSearch.trim() ? (serviceResults as any[]).slice(0, 6) : []),
    [deferredItemSearch, serviceResults],
  )
  const selectedPets = (customerDetail?.pets as any[]) ?? []
  const selectedCustomerName = customerDetail?.fullName || customerDetail?.name || draft.customerName

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
      toast.success('Da tao don hang')
      invalidateOrderQueries()
      startTransition(() => router.replace(`/orders/${createdOrder.id}`))
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the tao don hang'),
  })

  const updateOrderMutation = useMutation({
    mutationFn: () => orderApi.update(orderId!, buildOrderPayload(draft) as UpdateOrderPayload),
    onSuccess: (updatedOrder) => {
      toast.success('Da cap nhat don hang')
      invalidateOrderQueries()
      setDraft(buildDraftFromOrder(updatedOrder))
      setIsEditing(false)
      initializedOrderVersionRef.current = `${updatedOrder.id}:${updatedOrder.updatedAt ?? updatedOrder.createdAt ?? ''}`
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the cap nhat don hang'),
  })

  const payOrderMutation = useMutation({
    mutationFn: (payload: { payments: Array<{ method: string; amount: number; paymentAccountId?: string; paymentAccountLabel?: string }> }) =>
      orderApi.pay(orderId!, payload),
    onSuccess: () => {
      toast.success('Da ghi nhan thanh toan')
      setShowPayModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the thanh toan don'),
  })

  const approveOrderMutation = useMutation({
    mutationFn: (payload: { note?: string }) => orderApi.approve(orderId!, payload),
    onSuccess: () => {
      toast.success('Da duyet don hang')
      setShowApproveModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the duyet don'),
  })

  const exportStockMutation = useMutation({
    mutationFn: (payload: { note?: string }) => orderApi.exportStock(orderId!, payload),
    onSuccess: () => {
      toast.success('Da xuat kho don hang')
      setShowExportStockModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the xuat kho'),
  })

  const settleOrderMutation = useMutation({
    mutationFn: (payload: CompleteOrderPayload) => orderApi.complete(orderId!, payload),
    onSuccess: () => {
      toast.success('Da quyet toan don hang')
      setShowSettleModal(false)
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the quyet toan'),
  })

  const cancelOrderMutation = useMutation({
    mutationFn: () => orderApi.cancel(orderId!, { reason: 'Huy tu Order Workspace' }),
    onSuccess: () => {
      toast.success('Da huy don hang')
      invalidateOrderQueries()
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the huy don'),
  })

  const mergeItemIntoDraft = (item: any) => {
    setDraft((current) => {
      const mergeableTypes = new Set(['product', 'service'])
      const existingIndex = mergeableTypes.has(item.type)
        ? current.items.findIndex((entry) => entry.id === item.id && entry.type === item.type)
        : -1

      if (existingIndex >= 0) {
        const nextItems = [...current.items]
        nextItems[existingIndex] = {
          ...nextItems[existingIndex],
          quantity: Number(nextItems[existingIndex].quantity || 0) + Number(item.quantity || 1),
        }
        return { ...current, items: nextItems }
      }

      return { ...current, items: [...current.items, item] }
    })
  }

  const addCatalogItem = (entry: any) => {
    if (!isEditing) return

    if (entry.entryType?.startsWith('product') || entry.productId) {
      mergeItemIntoDraft(buildProductCartItem(entry))
      setItemSearch('')
      return
    }

    if (isHotelService(entry)) {
      if (!draft.customerId) {
        toast.error('Can chon khach hang truoc khi them dich vu hotel')
        return
      }
      setHotelServiceDraft(entry)
      return
    }

    if (isGroomingService(entry)) {
      if (!draft.customerId) {
        toast.error('Can chon khach hang truoc khi them dich vu grooming')
        return
      }
      setGroomingServiceDraft(entry)
      return
    }

    mergeItemIntoDraft(buildDirectServiceCartItem(entry))
    setItemSearch('')
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
      toast.error('Don hang phai co it nhat mot san pham hoac dich vu')
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
      customerName: selectedCustomerName || 'Khach le',
      customerPhone: customerDetail?.phone,
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
    customerDetail?.phone,
    draft.discount,
    draft.items,
    draft.notes,
    draft.shippingFee,
    mode,
    order,
    remainingAmount,
    selectedCustomerName,
    subtotal,
    total,
  ])

  return {
    mode,
    orderId,
    order,
    draft,
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
    branchName,
    subtotal,
    total,
    amountPaid,
    remainingAmount,
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
        customerName: customer.fullName || customer.name || 'Khach le',
      }))
      setCustomerSearch('')
    },
    handleClearCustomer: () => {
      setDraft((current) => ({ ...current, customerId: undefined, customerName: 'Khach le' }))
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
    handleRemoveItem: (index: number) =>
      setDraft((current) => ({
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index),
      })),
  }
}
