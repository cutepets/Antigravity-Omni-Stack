'use client'

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  Loader2,
  Package,
  PencilLine,
  ReceiptText,
  Save,
  Scissors,
  Search,
  ShoppingBag,
  Trash2,
  User,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { CartItem } from '@petshop/shared'
import { PageContainer, PageContent, PageHeader } from '@/components/layout/PageLayout'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { orderApi, type CreateOrderPayload, type UpdateOrderPayload } from '@/lib/api/order.api'
import { settingsApi } from '@/lib/api/settings.api'
import { filterVisiblePaymentMethods } from '@/lib/payment-methods'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useBranches, useCustomerDetail, useCustomerSearch, usePosProducts, usePosServices } from '@/app/(dashboard)/pos/_hooks/use-pos-queries'
import { ServiceBookingModal } from '@/app/(dashboard)/pos/components/ServiceBookingModal'
import { OrderPaymentModal } from './order-payment-modal'
import { ApproveOrderModal } from './approve-order-modal'
import { ExportStockModal } from './export-stock-modal'
import { SettleOrderModal } from './settle-order-modal'
import { OrderPetPickerModal } from './order-pet-picker-modal'

type OrderWorkspaceMode = 'create' | 'detail'

type OrderDraft = {
  branchId?: string
  customerId?: string
  customerName: string
  discount: number
  shippingFee: number
  notes: string
  items: CartItem[]
}

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  UNPAID: 'badge badge-warning',
  PARTIAL: 'badge badge-accent',
  PAID: 'badge badge-success',
  COMPLETED: 'badge badge-info',
  REFUNDED: 'badge badge-ghost',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chua thanh toan',
  PARTIAL: 'Thanh toan 1 phan',
  PAID: 'Da thanh toan',
  COMPLETED: 'Hoan thanh',
  REFUNDED: 'Da hoan tien',
}

const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge badge-warning',
  CONFIRMED: 'badge badge-info',
  PROCESSING: 'badge badge-accent',
  COMPLETED: 'badge badge-success',
  CANCELLED: 'badge badge-ghost',
  REFUNDED: 'badge badge-error',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Cho duyet',
  CONFIRMED: 'Da duyet',
  PROCESSING: 'Dang xu ly',
  COMPLETED: 'Hoan thanh',
  CANCELLED: 'Da huy',
  REFUNDED: 'Da hoan tien',
}

const ORDER_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Tao don hang',
  APPROVED: 'Duyet don',
  PAYMENT_ADDED: 'Them thanh toan',
  PAID: 'Thanh toan',
  STOCK_EXPORTED: 'Xuat kho',
  COMPLETED: 'Hoan thanh',
  CANCELLED: 'Huy don',
  REFUNDED: 'Hoan tien',
  NOTE_UPDATED: 'Cap nhat ghi chu',
  ITEM_ADDED: 'Them san pham',
  ITEM_REMOVED: 'Xoa san pham',
  DISCOUNT_APPLIED: 'Ap dung chiet khau',
  SETTLED: 'Quyet toan',
}

function normalizeServiceText(value?: string) {
  return value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? ''
}

function isHotelService(service: any) {
  const text = normalizeServiceText(`${service?.name ?? ''} ${service?.sku ?? ''}`)
  const serviceType = String(service?.serviceType ?? service?.type ?? '').toUpperCase()
  return service?.pricingKind === 'HOTEL' || serviceType === 'HOTEL' || service?.suggestionKind === 'HOTEL' || text.includes('hotel') || text.includes('luu chuong')
}

function isGroomingService(service: any) {
  const serviceType = String(service?.serviceType ?? service?.type ?? '').toUpperCase()
  return service?.pricingKind === 'GROOMING' || serviceType === 'GROOMING' || service?.suggestionKind === 'SPA' || service?.packageCode !== undefined
}

function getOrderServiceId(service: any) {
  if (service?.serviceId) return service.serviceId
  return service?.entryType?.startsWith('pricing-') ? undefined : service?.id
}

function inferSpaPackageCodeFromService(service: any) {
  const text = normalizeServiceText(`${service?.name ?? ''} ${service?.sku ?? ''}`)
  const hasBath = text.includes('tam')
  const hasClip = text.includes('cao') || text.includes('cat')
  const hasHygiene = text.includes('ve sinh')
  if (text.includes('spa')) return 'SPA'
  if (hasBath && hasClip && hasHygiene) return 'BATH_CLIP_HYGIENE'
  if (hasBath && hasHygiene) return 'BATH_HYGIENE'
  if (hasClip) return 'CLIP'
  if (hasBath) return 'BATH'
  if (hasHygiene) return 'HYGIENE'
  return undefined
}

function buildCartLineId(type: 'product' | 'service' | 'hotel' | 'grooming', ...parts: Array<string | number | null | undefined>) {
  return [type, ...parts.filter((part) => part !== undefined && part !== null && String(part).trim() !== '')]
    .map((part) => String(part).replace(/\s+/g, '-'))
    .join(':')
}

function createEmptyDraft(branchId?: string): OrderDraft {
  return { branchId, customerName: 'Khach le', discount: 0, shippingFee: 0, notes: '', items: [] }
}

function buildProductCartItem(product: any): CartItem {
  return {
    id: buildCartLineId('product', product.productId ?? product.id, product.productVariantId ?? 'base'),
    productId: product.productId ?? product.id,
    productVariantId: product.productVariantId,
    description: product.productName ?? product.name,
    sku: product.sku,
    quantity: 1,
    unitPrice: Number(product.sellingPrice ?? product.price ?? 0),
    discountItem: 0,
    vatRate: 0,
    type: 'product',
    unit: product.unit ?? 'cai',
    image: product.image,
    variantName: product.variantLabel ?? undefined,
    variants: product.variants ?? [],
  }
}

function buildDirectServiceCartItem(service: any, petId?: string, petName?: string): CartItem {
  const itemType = isHotelService(service) ? 'hotel' : 'service'
  const unitPrice = Number(service?.sellingPrice ?? service?.price ?? 0)
  return {
    id: buildCartLineId(itemType, service.id, petId),
    serviceId: getOrderServiceId(service),
    description: isHotelService(service) ? `Luu tru${service.weightBandLabel ? ` - ${service.weightBandLabel}` : ''}` : service.name,
    sku: service.sku,
    weightBandLabel: service.weightBandLabel,
    unitPrice,
    type: itemType,
    image: service.image,
    unit: itemType === 'hotel' ? 'ngay' : 'lan',
    discountItem: 0,
    vatRate: 0,
    quantity: 1,
    petId,
    petName,
  }
}

function buildGroomingCartItem(service: any, petId?: string, petName?: string): CartItem {
  const unitPrice = Number(service?.sellingPrice ?? service?.price ?? 0)
  const packageCode = service?.packageCode ?? inferSpaPackageCodeFromService(service)
  const petWeight = Number(service?.petSnapshot?.weight ?? Number.NaN)
  const pricingSnapshot = service?.pricingSnapshot ?? (service?.pricingRuleId || service?.weightBandId ? {
    pricingRuleId: service?.pricingRuleId,
    packageCode,
    weightBandId: service?.weightBandId ?? null,
    weightBandLabel: service?.weightBandLabel ?? null,
    price: unitPrice,
  } : undefined)
  return {
    id: buildCartLineId('grooming', service.id, petId),
    serviceId: getOrderServiceId(service),
    description: service.name,
    sku: service.sku,
    weightBandLabel: service.weightBandLabel,
    unitPrice,
    type: 'grooming',
    image: service.image,
    unit: 'lan',
    discountItem: 0,
    vatRate: 0,
    quantity: 1,
    petId,
    petName,
    groomingDetails: petId ? {
      petId,
      packageCode,
      serviceItems: service?.name,
      weightAtBooking: Number.isFinite(petWeight) ? petWeight : undefined,
      weightBandId: service?.weightBandId,
      weightBandLabel: service?.weightBandLabel,
      pricingPrice: unitPrice,
      pricingSnapshot,
    } : undefined,
  }
}

function parseDecimalInput(value: string, fallback = 0) {
  const normalized = value.replace(/[^\d.,-]/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getCartQuantityStep(item: { type?: string }) {
  return item.type === 'hotel' ? 0.5 : 1
}

function PaymentStatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="badge badge-ghost">--</span>
  return <span className={PAYMENT_STATUS_BADGE[status] ?? 'badge badge-gray'}>{PAYMENT_STATUS_LABEL[status] ?? status}</span>
}

function OrderStatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="badge badge-ghost">--</span>
  return <span className={ORDER_STATUS_BADGE[status] ?? 'badge badge-gray'}>{ORDER_STATUS_LABEL[status] ?? status}</span>
}

function buildDraftFromOrder(order: any): OrderDraft {
  return {
    branchId: order.branchId ?? undefined,
    customerId: order.customer?.id ?? undefined,
    customerName: order.customer?.name || order.customer?.fullName || order.customerName || 'Khach le',
    discount: Number(order.discount) || 0,
    shippingFee: Number(order.shippingFee) || 0,
    notes: order.notes || '',
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      orderItemId: item.id,
      productId: item.productId ?? undefined,
      productVariantId: item.productVariantId ?? undefined,
      serviceId: item.serviceId ?? undefined,
      serviceVariantId: item.serviceVariantId ?? undefined,
      petId: item.petId ?? undefined,
      petName: item.petName ?? undefined,
      description: item.name || item.description,
      sku: item.sku || '',
      unitPrice: Number(item.unitPrice) || 0,
      discountItem: Number(item.discountItem) || 0,
      vatRate: Number(item.vatRate) || 0,
      type: item.type || 'product',
      image: item.image || '',
      unit: item.unit || 'cai',
      quantity: Number(item.quantity) || 1,
      variantName: item.variantName ?? undefined,
      hotelDetails: item.hotelDetails ? {
        petId: item.hotelDetails.petId,
        checkIn: item.hotelDetails.checkInDate,
        checkOut: item.hotelDetails.checkOutDate,
        stayId: item.hotelStayId,
        lineType: item.hotelDetails.lineType ?? 'REGULAR',
        bookingGroupKey: item.hotelDetails.bookingGroupKey,
        chargeLineIndex: item.hotelDetails.chargeLineIndex,
        chargeLineLabel: item.hotelDetails.chargeLineLabel,
        chargeDayType: item.hotelDetails.chargeDayType,
        chargeQuantityDays: item.hotelDetails.chargeQuantityDays,
        chargeUnitPrice: item.hotelDetails.chargeUnitPrice,
        chargeSubtotal: item.hotelDetails.chargeSubtotal,
        chargeWeightBandId: item.hotelDetails.chargeWeightBandId ?? null,
        chargeWeightBandLabel: item.hotelDetails.chargeWeightBandLabel ?? null,
      } : undefined,
      groomingDetails: item.groomingDetails ? {
        petId: item.groomingDetails.petId,
        performerId: item.groomingDetails.performerId,
        startTime: item.groomingDetails.startTime,
        notes: item.groomingDetails.notes,
        serviceItems: item.groomingDetails.serviceItems,
        packageCode: item.groomingDetails.packageCode,
        weightAtBooking: item.groomingDetails.weightAtBooking,
        weightBandId: item.groomingDetails.weightBandId,
        weightBandLabel: item.groomingDetails.weightBandLabel,
        pricingPrice: item.groomingDetails.pricingPrice,
        pricingSnapshot: item.groomingDetails.pricingSnapshot,
      } : undefined,
    })),
  }
}

export function OrderWorkspace({ mode, orderId }: { mode: OrderWorkspaceMode; orderId?: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { activeBranchId, isLoading: isAuthLoading, hasAnyPermission, hasPermission } = useAuthorization()
  const canAccessOrders = mode === 'create' ? hasPermission('order.create') : hasAnyPermission(['order.read.all', 'order.read.assigned'])
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
  const [activeTab, setActiveTab] = useState<'info' | 'items'>('info')
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
  const { data: productResults = [] } = usePosProducts(deferredItemSearch)
  const { data: serviceResults = [] } = usePosServices(deferredItemSearch)

  useEffect(() => {
    if (isAuthLoading) return
    if (canAccessOrders) return
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
    () => branches.find((branch: any) => branch.id === (order?.branchId ?? draft.branchId))?.name ?? 'Chua chon chi nhanh',
    [branches, draft.branchId, order?.branchId],
  )
  const subtotal = useMemo(
    () => draft.items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0) - Number(item.discountItem || 0), 0),
    [draft.items],
  )
  const total = Math.max(0, subtotal + draft.shippingFee - draft.discount)
  const amountPaid = Number(order?.paidAmount ?? order?.amountPaid ?? 0)
  const remainingAmount = Math.max(0, total - amountPaid)
  const hasServiceItems = draft.items.some((item) => item.type === 'grooming' || item.type === 'hotel')
  const visiblePaymentMethods = useMemo(
    () => filterVisiblePaymentMethods(paymentMethods, { branchId: order?.branchId ?? draft.branchId, amount: remainingAmount > 0 ? remainingAmount : total }),
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
  const canEditCurrentOrder = mode === 'detail' && canUpdateOrder && !['COMPLETED', 'CANCELLED'].includes(order?.status ?? '')
  const canApproveCurrentOrder = mode === 'detail' && canApproveOrder && order?.status === 'PENDING'
  const canExportCurrentOrder = mode === 'detail' && canExportStock && ['CONFIRMED', 'PROCESSING'].includes(order?.status ?? '') && !order?.stockExportedAt
  const canSettleCurrentOrder =
    mode === 'detail' &&
    canSettleOrder &&
    order?.status === 'PROCESSING' &&
    Boolean(order?.stockExportedAt) &&
    ['PAID', 'COMPLETED'].includes(order?.paymentStatus ?? '') &&
    hasServiceItems

  const buildPayload = (): CreateOrderPayload | UpdateOrderPayload => ({
    customerId: draft.customerId || undefined,
    customerName: draft.customerName.trim() || 'Khach le',
    branchId: draft.branchId || undefined,
    items: draft.items.map((item) => ({
      id: (item as any).orderItemId,
      productId: item.productId,
      productVariantId: item.productVariantId,
      serviceId: item.serviceId,
      serviceVariantId: item.serviceVariantId,
      petId: item.petId,
      description: item.description,
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      discountItem: Number(item.discountItem) || 0,
      vatRate: Number(item.vatRate) || 0,
      type: item.type,
      groomingDetails: item.groomingDetails ? {
        petId: item.groomingDetails.petId,
        performerId: item.groomingDetails.performerId,
        startTime: item.groomingDetails.startTime,
        notes: item.groomingDetails.notes,
        serviceItems: item.groomingDetails.serviceItems,
        packageCode: item.groomingDetails.packageCode,
        weightAtBooking: item.groomingDetails.weightAtBooking,
        weightBandId: item.groomingDetails.weightBandId,
        weightBandLabel: item.groomingDetails.weightBandLabel,
        pricingPrice: item.groomingDetails.pricingPrice,
        pricingSnapshot: item.groomingDetails.pricingSnapshot,
      } : undefined,
      hotelDetails: item.hotelDetails ? {
        petId: item.hotelDetails.petId,
        checkInDate: item.hotelDetails.checkIn,
        checkOutDate: item.hotelDetails.checkOut,
        branchId: draft.branchId,
        lineType: item.hotelDetails.lineType,
        bookingGroupKey: item.hotelDetails.bookingGroupKey,
        chargeLineIndex: item.hotelDetails.chargeLineIndex,
        chargeLineLabel: item.hotelDetails.chargeLineLabel,
        chargeDayType: item.hotelDetails.chargeDayType,
        chargeQuantityDays: item.hotelDetails.chargeQuantityDays,
        chargeUnitPrice: item.hotelDetails.chargeUnitPrice,
        chargeSubtotal: item.hotelDetails.chargeSubtotal,
        chargeWeightBandId: item.hotelDetails.chargeWeightBandId ?? undefined,
        chargeWeightBandLabel: item.hotelDetails.chargeWeightBandLabel ?? undefined,
      } : undefined,
    })),
    discount: Number(draft.discount) || 0,
    shippingFee: Number(draft.shippingFee) || 0,
    notes: draft.notes.trim() || undefined,
  })

  const invalidateOrderQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
    if (orderId) {
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      void queryClient.invalidateQueries({ queryKey: ['order-timeline', orderId] })
      void queryClient.invalidateQueries({ queryKey: ['order-payment-intents', orderId] })
    }
  }

  const createOrderMutation = useMutation({
    mutationFn: () => orderApi.create(buildPayload() as CreateOrderPayload),
    onSuccess: (createdOrder) => {
      toast.success('Da tao don hang')
      invalidateOrderQueries()
      startTransition(() => router.replace(`/orders/${createdOrder.id}`))
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Khong the tao don hang'),
  })

  const updateOrderMutation = useMutation({
    mutationFn: () => orderApi.update(orderId!, buildPayload() as UpdateOrderPayload),
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
    mutationFn: (payload: { note?: string }) => orderApi.settle(orderId!, payload),
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

  const mergeItemIntoDraft = (item: CartItem) => {
    setDraft((current) => {
      const mergeableTypes = new Set(['product', 'service'])
      const existingIndex = mergeableTypes.has(item.type) ? current.items.findIndex((entry) => entry.id === item.id && entry.type === item.type) : -1
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

  const selectedCustomerName = customerDetail?.fullName || customerDetail?.name || draft.customerName

  if (isAuthLoading || (mode === 'detail' && isOrderLoading)) {
    return (
      <PageContainer maxWidth="full" className="justify-center">
        <div className="flex h-[55vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground-muted">
            <Loader2 size={18} className="animate-spin" />
            Dang tai du lieu don hang...
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!canAccessOrders) {
    return (
      <PageContainer maxWidth="full" className="justify-center">
        <div className="flex h-[55vh] items-center justify-center text-sm font-medium text-foreground-muted">
          Dang chuyen huong...
        </div>
      </PageContainer>
    )
  }

  if (mode === 'detail' && (isOrderError || !order)) {
    return (
      <PageContainer maxWidth="full" className="justify-center">
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <AlertCircle size={48} className="text-error/70" />
          <div>
            <p className="text-lg font-semibold text-foreground">Khong tim thay don hang</p>
            <p className="mt-1 text-sm text-foreground-muted">Don hang nay co the da bi xoa hoac ban khong con quyen truy cap.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/orders')}
            className="rounded-2xl border border-border bg-background-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background-tertiary"
          >
            Quay lai danh sach
          </button>
        </div>
      </PageContainer>
    )
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

  const pendingAction =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    payOrderMutation.isPending ||
    approveOrderMutation.isPending ||
    exportStockMutation.isPending ||
    settleOrderMutation.isPending ||
    cancelOrderMutation.isPending

  return (
    <PageContainer maxWidth="full" className="!gap-5 !py-4">
      <PageHeader
        title={mode === 'create' ? 'Tao don hang Orders' : order?.orderNumber || 'Chi tiet don hang'}
        description={
          mode === 'create'
            ? 'Luong Orders moi: tao don nhieu buoc, luu va tiep tuc cap nhat tren cung workspace.'
            : 'Xem, cap nhat va xu ly don hang Orders tren mot man hinh thong nhat.'
        }
        icon={ReceiptText}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/orders')}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
            >
              <ArrowLeft size={16} />
              Danh sach don
            </button>
            {mode === 'detail' && canEditCurrentOrder && !isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
              >
                <PencilLine size={16} />
                Chinh sua
              </button>
            ) : null}
            {isEditing ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={pendingAction}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pendingAction ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {mode === 'create' ? 'Luu don' : 'Luu cap nhat'}
              </button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
        <div className="space-y-5">
          <div className="flex rounded-3xl bg-background-secondary p-1">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[20px] py-2.5 text-sm font-semibold transition-all ${
                activeTab === 'info' ? 'bg-background text-primary-600 shadow-sm' : 'text-foreground-muted hover:bg-background/50 hover:text-foreground'
              }`}
            >
              <ReceiptText size={18} />
              Thong tin chung
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[20px] py-2.5 text-sm font-semibold transition-all ${
                activeTab === 'items' ? 'bg-background text-primary-600 shadow-sm' : 'text-foreground-muted hover:bg-background/50 hover:text-foreground'
              }`}
            >
              <Package size={18} />
              San pham va dich vu {draft.items.length > 0 && `(${draft.items.length})`}
            </button>
          </div>

          {activeTab === 'info' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <PageContent className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Chi nhanh</span>
                    <select
                      value={draft.branchId ?? ''}
                      disabled={!isEditing}
                      onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value || undefined }))}
                      className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                    >
                      <option value="">Chon chi nhanh</option>
                      {branches.map((branch: any) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Khach hang</span>
                    {draft.customerId ? (
                      <div className="rounded-2xl border border-border bg-background-secondary/70 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">{selectedCustomerName}</div>
                            <div className="mt-1 text-xs text-foreground-muted">
                              {[customerDetail?.phone, customerDetail?.pets?.length ? `${customerDetail.pets.length} pet` : null].filter(Boolean).join(' • ') || 'Khong co thong tin bo sung'}
                            </div>
                          </div>
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => setDraft((current) => ({ ...current, customerId: undefined, customerName: 'Khach le' }))}
                              className="text-xs font-semibold text-foreground-muted transition-colors hover:text-error"
                            >
                              Bo chon
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                          <input
                            type="text"
                            value={customerSearch}
                            disabled={!isEditing}
                            onChange={(event) => setCustomerSearch(event.target.value)}
                            placeholder="Tim khach theo ten hoac so dien thoai"
                            className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                          />
                          {isEditing && deferredCustomerSearch.trim().length >= 2 && customerResults.length > 0 ? (
                            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-border bg-background shadow-xl">
                              {(customerResults as any[]).slice(0, 6).map((customer: any) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => {
                                    setDraft((current) => ({ ...current, customerId: customer.id, customerName: customer.fullName || customer.name || 'Khach le' }))
                                    setCustomerSearch('')
                                  }}
                                  className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-background-secondary"
                                >
                                  <div>
                                    <div className="text-sm font-semibold text-foreground">{customer.fullName || customer.name}</div>
                                    <div className="mt-1 text-xs text-foreground-muted">{customer.phone || 'Khong co SDT'}</div>
                                  </div>
                                  <User size={16} className="text-foreground-muted" />
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <input
                          type="text"
                          value={draft.customerName}
                          disabled={!isEditing}
                          onChange={(event) => setDraft((current) => ({ ...current, customerName: event.target.value }))}
                          placeholder="Ten hien thi neu la khach le"
                          className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Chiet khau</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!isEditing}
                      value={draft.discount}
                      onChange={(event) => setDraft((current) => ({ ...current, discount: Math.max(0, parseDecimalInput(event.target.value, current.discount)) }))}
                      className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Phi ship</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!isEditing}
                      value={draft.shippingFee}
                      onChange={(event) => setDraft((current) => ({ ...current, shippingFee: Math.max(0, parseDecimalInput(event.target.value, current.shippingFee)) }))}
                      className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Ghi chu don hang</span>
                  <textarea
                    rows={4}
                    disabled={!isEditing}
                    value={draft.notes}
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Ghi chu xu ly, huong dan giao hang, thong tin nghiep vu..."
                    className="w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                  />
                </label>
              </PageContent>

              <PageContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-foreground">Tong quan don hang</div>
                    <div className="mt-1 text-sm text-foreground-muted">
                      {mode === 'detail' ? `${branchName} • tao luc ${formatDateTime(order?.createdAt)}` : `${branchName} • luu tu workspace Orders`}
                    </div>
                  </div>
                  {mode === 'detail' ? <OrderStatusBadge status={order?.status} /> : <span className="badge badge-info">Draft</span>}
                </div>
                <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-muted">Tam tinh</span>
                    <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-foreground-muted">Chiet khau</span>
                    <span className="font-semibold text-foreground">{formatCurrency(draft.discount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-foreground-muted">Phi ship</span>
                    <span className="font-semibold text-foreground">{formatCurrency(draft.shippingFee)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm font-semibold text-foreground">Tong thanh toan</span>
                    <span className="text-xl font-bold text-primary-500">{formatCurrency(total)}</span>
                  </div>
                </div>
              </PageContent>

              {mode === 'detail' ? (
                <PageContent className="space-y-4">
                  <div className="text-base font-semibold text-foreground">Thong tin khach hang</div>
                  <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                        <User size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{selectedCustomerName || 'Khach le'}</div>
                        <div className="mt-1 text-xs text-foreground-muted">
                          {[customerDetail?.phone, customerDetail?.address].filter(Boolean).join(' • ') || 'Khong co thong tin lien he'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
                    <div className="grid gap-2 text-sm text-foreground-secondary">
                      <div className="flex items-center justify-between gap-3">
                        <span>Ma don</span>
                        <span className="font-mono font-semibold text-foreground">{order?.orderNumber || '--'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Nguoi tao</span>
                        <span className="font-semibold text-foreground">{order?.staff?.fullName || order?.staff?.name || '--'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Chi nhanh</span>
                        <span className="font-semibold text-foreground">{branchName}</span>
                      </div>
                    </div>
                  </div>
                </PageContent>
              ) : null}
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <PageContent className="space-y-4">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                  <input
                    type="text"
                    value={itemSearch}
                    disabled={!isEditing}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Tim san pham, dich vu, grooming, hotel..."
                    className="h-12 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                  />
                  {isEditing && deferredItemSearch.trim() && (productMatches.length > 0 || serviceMatches.length > 0) ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-3xl border border-border bg-background shadow-xl">
                      <div className="max-h-[380px] overflow-y-auto p-2">
                        {productMatches.length > 0 ? (
                          <div className="mb-2">
                            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">San pham</div>
                            {productMatches.map((entry: any) => (
                              <button
                                key={entry.entryId ?? entry.id}
                                type="button"
                                onClick={() => addCatalogItem(entry)}
                                className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-background-secondary"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-foreground">{entry.productName ?? entry.name}</div>
                                  <div className="mt-1 text-xs text-foreground-muted">{[entry.variantLabel, entry.sku].filter(Boolean).join(' • ') || 'Khong co ma SKU'}</div>
                                </div>
                                <div className="text-sm font-semibold text-primary-500">{formatCurrency(Number(entry.sellingPrice ?? entry.price ?? 0))}</div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {serviceMatches.length > 0 ? (
                          <div>
                            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">Dich vu</div>
                            {serviceMatches.map((entry: any) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => addCatalogItem(entry)}
                                className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-background-secondary"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-foreground">{entry.name}</div>
                                  <div className="mt-1 text-xs text-foreground-muted">{[isHotelService(entry) ? 'Hotel' : isGroomingService(entry) ? 'Grooming' : 'Dich vu', entry.sku].filter(Boolean).join(' • ')}</div>
                                </div>
                                <div className="text-sm font-semibold text-primary-500">{formatCurrency(Number(entry.sellingPrice ?? entry.price ?? 0))}</div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex border-b border-border pb-2 px-2 text-[11px] font-semibold uppercase text-foreground-muted tracking-[0.14em] hidden md:flex">
                    <div className="flex-1">Ten san pham / Dich vu</div>
                    <div className="w-[90px] text-center">So luong</div>
                    <div className="w-[120px] text-right">Don gia</div>
                    <div className="w-[120px] text-right">Thanh tien</div>
                    {isEditing && <div className="w-8 shrink-0"></div>}
                  </div>
                  {draft.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex flex-col md:flex-row md:items-center gap-3 rounded-2xl border md:border-transparent border-border bg-background-secondary/60 md:bg-transparent p-3 md:p-1 md:py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-foreground" title={item.description}>{item.description}</div>
                          <span className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-700">{item.type}</span>
                        </div>
                        <div className="truncate mt-1 text-xs text-foreground-muted">
                          {[item.variantName, item.petName].filter(Boolean).join(' • ') || '---'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 md:gap-3 shrink-0">
                        <div className="w-[90px] shrink-0">
                          <input
                            type="number"
                            step={getCartQuantityStep(item)}
                            min={getCartQuantityStep(item)}
                            disabled={!isEditing}
                            value={item.quantity}
                            onChange={(event) => setDraft((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: Math.max(getCartQuantityStep(entry), parseDecimalInput(event.target.value, entry.quantity)) } : entry) }))}
                            className="h-9 w-full rounded-xl border border-border bg-background px-2 text-center text-sm font-medium text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                          />
                        </div>

                        <div className="w-[120px] shrink-0">
                          <input
                            type="number"
                            min={0}
                            disabled={!isEditing}
                            value={item.unitPrice}
                            onChange={(event) => setDraft((current) => ({ ...current, items: current.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, unitPrice: Math.max(0, parseDecimalInput(event.target.value, entry.unitPrice)) } : entry) }))}
                            className="h-9 w-full rounded-xl border border-border bg-background px-2 text-right text-sm font-medium text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                          />
                        </div>

                        <div className="w-[120px] shrink-0 text-right text-sm font-semibold text-foreground">
                          {formatCurrency(Math.max(0, Number(item.quantity || 0) * Number(item.unitPrice || 0) - Number(item.discountItem || 0)))}
                        </div>

                        {isEditing && (
                          <div className="w-8 shrink-0 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}
                              className="text-foreground-muted transition-colors hover:text-error"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {draft.items.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border px-5 py-12 text-center">
                      <ShoppingBag size={24} className="mx-auto text-foreground-muted" />
                      <div className="mt-3 text-sm font-semibold text-foreground">Chua co san pham nao</div>
                      <div className="mt-1 text-sm text-foreground-muted">Tim va them item ngay tren workspace Orders nay.</div>
                    </div>
                  ) : null}
                </div>
              </PageContent>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <PageContent className="space-y-4">
            <div className="text-base font-semibold text-foreground">Xu ly</div>
            <div className="grid gap-3">
              {isEditing ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={pendingAction}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pendingAction ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {mode === 'create' ? 'Tao don hang' : 'Luu cap nhat'}
                </button>
              ) : null}
              {mode === 'detail' && isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!order) return
                    setDraft(buildDraftFromOrder(order))
                    setIsEditing(false)
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
                >
                  <XCircle size={16} />
                  Huy sua
                </button>
              ) : null}
              {mode === 'detail' && canPayOrder && !['PAID', 'COMPLETED'].includes(order?.paymentStatus ?? '') ? (
                <button
                  type="button"
                  onClick={() => setShowPayModal(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
                >
                  <CreditCard size={16} />
                  Thu tien
                </button>
              ) : null}
              {canApproveCurrentOrder ? (
                <button
                  type="button"
                  onClick={() => setShowApproveModal(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
                >
                  <CheckSquare size={16} />
                  Duyet don
                </button>
              ) : null}
              {canExportCurrentOrder ? (
                <button
                  type="button"
                  onClick={() => setShowExportStockModal(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
                >
                  <Package size={16} />
                  Xuat kho
                </button>
              ) : null}
              {canSettleCurrentOrder ? (
                <button
                  type="button"
                  onClick={() => setShowSettleModal(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
                >
                  <CheckCircle2 size={16} />
                  Quyet toan
                </button>
              ) : null}
              {mode === 'detail' && order?.status !== 'CANCELLED' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Ban chac chan muon huy don hang nay?')) return
                    cancelOrderMutation.mutate()
                  }}
                  disabled={cancelOrderMutation.isPending}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-error/30 bg-error/10 px-4 text-sm font-medium text-error transition-colors hover:bg-error/20 disabled:opacity-60"
                >
                  {cancelOrderMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                  Huy don
                </button>
              ) : null}
              {mode === 'create' ? (
                <button
                  type="button"
                  onClick={() => router.push('/pos')}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
                >
                  <Scissors size={16} />
                  Mo POS ban nhanh
                </button>
              ) : null}
            </div>
          </PageContent>

          {mode === 'detail' ? (
            <PageContent className="space-y-4">
              <div className="text-base font-semibold text-foreground">Trang thai thanh toan</div>
              <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">Trang thai</span>
                  <PaymentStatusBadge status={order?.paymentStatus} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">Da thu</span>
                  <span className="font-semibold text-success">{formatCurrency(amountPaid)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">Con lai</span>
                  <span className="font-semibold text-warning">{formatCurrency(remainingAmount)}</span>
                </div>
              </div>
            </PageContent>
          ) : null}

          {mode === 'detail' && timeline.length > 0 ? (
            <PageContent className="space-y-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Calendar size={18} className="text-primary-500" />
                Lich su phien ban
              </div>
              <div className="space-y-3">
                {(timeline as any[]).map((entry: any) => (
                  <div key={entry.id} className="rounded-2xl border border-border bg-background-secondary/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{ORDER_ACTION_LABELS[entry.action] ?? entry.action}</div>
                        <div className="mt-1 text-xs text-foreground-muted">{formatDateTime(entry.createdAt)} • {entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? '--'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.fromStatus ? <OrderStatusBadge status={entry.fromStatus} /> : null}
                        {entry.toStatus ? <OrderStatusBadge status={entry.toStatus} /> : null}
                      </div>
                    </div>
                    {entry.note ? <div className="mt-2 text-sm text-foreground-secondary">{entry.note}</div> : null}
                  </div>
                ))}
              </div>
            </PageContent>
          ) : null}
        </div>
      </div>

      {mode === 'detail' ? (
        <>
          <OrderPaymentModal
            isOpen={showPayModal}
            onClose={() => setShowPayModal(false)}
            cartTotal={remainingAmount > 0 ? remainingAmount : total}
            paymentMethods={visiblePaymentMethods}
            initialPayments={[]}
            minimumMethods={1}
            title="Thu tien don hang"
            description="Chon phuong thuc thanh toan cho don Orders."
            onConfirm={(payload) => payOrderMutation.mutate({ payments: payload.payments })}
          />
          <ApproveOrderModal
            isOpen={showApproveModal}
            onClose={() => setShowApproveModal(false)}
            onConfirm={(payload) => approveOrderMutation.mutate(payload)}
            orderNumber={order?.orderNumber || '--'}
            isPending={approveOrderMutation.isPending}
          />
          <ExportStockModal
            isOpen={showExportStockModal}
            onClose={() => setShowExportStockModal(false)}
            onConfirm={(payload) => exportStockMutation.mutate(payload)}
            orderNumber={order?.orderNumber || '--'}
            isPending={exportStockMutation.isPending}
          />
          <SettleOrderModal
            isOpen={showSettleModal}
            onClose={() => setShowSettleModal(false)}
            onConfirm={(payload) => settleOrderMutation.mutate(payload)}
            orderNumber={order?.orderNumber || '--'}
            isPending={settleOrderMutation.isPending}
          />
        </>
      ) : null}

      <ServiceBookingModal
        isOpen={Boolean(hotelServiceDraft)}
        onClose={() => setHotelServiceDraft(null)}
        onConfirm={handleHotelBookingConfirm}
        service={hotelServiceDraft}
        customerId={draft.customerId}
      />
      <OrderPetPickerModal
        isOpen={Boolean(groomingServiceDraft)}
        onClose={() => setGroomingServiceDraft(null)}
        onConfirm={handleGroomingConfirm}
        pets={selectedPets}
        title={groomingServiceDraft ? `Chon pet cho ${groomingServiceDraft.name}` : 'Chon thu cung'}
      />
    </PageContainer>
  )
}
