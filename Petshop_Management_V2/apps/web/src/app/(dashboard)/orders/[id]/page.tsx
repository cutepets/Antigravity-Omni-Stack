'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ShoppingCart, User, Phone, Calendar, CreditCard,
  Package, Scissors, CheckCircle2, Clock, AlertCircle, Printer,
  Receipt, Tag, Hash, Store, ChevronRight, Percent, QrCode, Copy, RefreshCw, Landmark,
  FileText, CheckSquare, XCircle, ListOrdered
} from 'lucide-react'
import { orderApi, type CompleteOrderPayload, type ApproveOrderPayload, type ExportStockPayload, type SettleOrderPayload } from '@/lib/api/order.api'
import { settingsApi } from '@/lib/api/settings.api'
import { filterVisiblePaymentMethods } from '@/lib/payment-methods'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { PosPaymentModal } from '../../pos/components/PosPaymentModal'
import { OrderSettlementModal } from '../_components/order-settlement-modal'
import { ApproveOrderModal } from '../_components/approve-order-modal'
import { ExportStockModal } from '../_components/export-stock-modal'
import { SettleOrderModal as SettleOrderModalComponent } from '../_components/settle-order-modal'
import { useAuthorization } from '@/hooks/useAuthorization'
import { usePaymentIntentStream } from '@/hooks/use-payment-intent-stream'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ bán hàng',
  BANK: 'Chuyển khoản',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  ZALOPAY: 'ZaloPay',
  MIXED: 'Nhiều phương thức',
  POINTS: 'Điểm',
}

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  UNPAID: 'badge badge-warning',
  PARTIAL: 'badge badge-accent',
  PAID: 'badge badge-success',
  COMPLETED: 'badge badge-info',
  REFUNDED: 'badge badge-ghost',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'TT 1 phần',
  PAID: 'Đã thanh toán',
  COMPLETED: 'Hoàn thành',
  REFUNDED: 'Đã hoàn tiền',
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
  PENDING: 'Chờ duyệt',
  CONFIRMED: 'Đã duyệt',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
}

const ORDER_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Tạo đơn hàng',
  APPROVED: 'Duyệt đơn',
  PAYMENT_ADDED: 'Thêm thanh toán',
  PAID: 'Thanh toán',
  STOCK_EXPORTED: 'Xuất kho',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy đơn',
  REFUNDED: 'Hoàn tiền',
  NOTE_UPDATED: 'Cập nhật ghi chú',
  ITEM_ADDED: 'Thêm sản phẩm',
  ITEM_REMOVED: 'Xóa sản phẩm',
  DISCOUNT_APPLIED: 'Áp dụng chiết khấu',
  SETTLED: 'Quyết toán',
}

function PaymentStatusBadge({ status }: { status: string }) {
  const lbl = PAYMENT_STATUS_LABEL[status] ?? status;
  const cls = PAYMENT_STATUS_BADGE[status] ?? 'badge badge-gray';
  return <span className={cls}>{lbl}</span>
}

function OrderStatusBadge({ status }: { status: string }) {
  const lbl = ORDER_STATUS_LABEL[status] ?? status;
  const cls = ORDER_STATUS_BADGE[status] ?? 'badge badge-gray';
  return <span className={cls}>{lbl}</span>
}

/** Auth shell */
export default function OrderDetailPage() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const router = useRouter()
  const { hasAnyPermission, isLoading: isAuthLoading } = useAuthorization()
  const canReadOrders = hasAnyPermission(['order.read.all', 'order.read.assigned'])

  useEffect(() => {
    if (isAuthLoading) return
    if (!canReadOrders) router.replace('/dashboard')
  }, [canReadOrders, isAuthLoading, router])

  if (isAuthLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center animate-fade-in">
        <p className="text-sm text-foreground-muted font-medium">Đang kiểm tra quyền truy cập...</p>
      </div>
    )
  }

  if (!canReadOrders) {
    return (
      <div className="flex h-[60vh] items-center justify-center animate-fade-in">
        <p className="text-sm text-foreground-muted font-medium">Đang chuyển hướng...</p>
      </div>
    )
  }

  return <OrderDetailContent id={id} />
}

/** Inner component */
function OrderDetailContent({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasAnyPermission, hasPermission } = useAuthorization()

  const canPayOrder = hasPermission('order.pay')
  const canApproveOrder = hasPermission('order.approve')
  const canExportStock = hasPermission('order.export_stock')
  const canSettleOrder = hasPermission('order.settle')
  const canFinalizeOrder = hasAnyPermission(['order.approve', 'order.ship'])
  const canReadCustomers = hasAnyPermission(['customer.read.all', 'customer.read.assigned'])

  const [showPayModal, setShowPayModal] = useState(false)
  const [showSettlementModal, setShowSettlementModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showExportStockModal, setShowExportStockModal] = useState(false)
  const [showSettleWorkflowModal, setShowSettleWorkflowModal] = useState(false)
  const [selectedQrMethodId, setSelectedQrMethodId] = useState('')
  const handledPaidIntentCodeRef = useRef<string | null>(null)

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id),
    enabled: !!id,
  })
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['settings', 'payment-methods'],
    queryFn: () => settingsApi.getPaymentMethods(),
    staleTime: 30_000,
    enabled: !!id,
  })
  const { data: paymentIntents = [] } = useQuery({
    queryKey: ['order-payment-intents', id],
    queryFn: () => orderApi.listPaymentIntents(id),
    staleTime: 10_000,
    enabled: !!id,
  })
  const { data: timeline = [] } = useQuery({
    queryKey: ['order-timeline', id],
    queryFn: () => orderApi.getTimeline(id),
    enabled: !!id,
  })

  const _activeQrIntentCode = paymentIntents.find((i: any) => i.status === 'PENDING')?.code ?? null
  const qrIntentStream = usePaymentIntentStream(_activeQrIntentCode, Boolean(_activeQrIntentCode))

  const { mutate: payOrder, isPending: paying } = useMutation({
    mutationFn: (data: any) => orderApi.pay(id, data),
    onSuccess: () => {
      toast.success('Thanh toán thành công')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order-payment-intents', id] })
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] })
      setShowPayModal(false)
    },
    onError: () => toast.error('Lỗi khi thao tác thanh toán'),
  })

  const { mutate: completeOrder, isPending: completing } = useMutation({
    mutationFn: (data: CompleteOrderPayload) => orderApi.complete(id, data),
    onSuccess: () => {
      toast.success('Quyết toán đơn hàng thành công')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order-payment-intents', id] })
      setShowSettlementModal(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể quyết toán đơn hàng')
    },
  })

  const { mutate: createPaymentIntent, isPending: creatingPaymentIntent } = useMutation({
    mutationFn: (paymentMethodId: string) =>
      orderApi.createPaymentIntent(id, { paymentMethodId }),
    onSuccess: (intent) => {
      toast.success('Đã tạo QR chuyển khoản')
      setSelectedQrMethodId(intent.paymentMethodId)
      queryClient.invalidateQueries({ queryKey: ['order-payment-intents', id] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể tạo QR chuyển khoản')
    },
  })

  const { mutate: approveOrder, isPending: approving } = useMutation({
    mutationFn: (data: ApproveOrderPayload) => orderApi.approve(id, data),
    onSuccess: () => {
      toast.success('Đã duyệt đơn hàng')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] })
      setShowApproveModal(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể duyệt đơn hàng')
    },
  })

  const { mutate: exportStock, isPending: exportingStock } = useMutation({
    mutationFn: (data: ExportStockPayload) => orderApi.exportStock(id, data),
    onSuccess: () => {
      toast.success('Đã xuất kho đơn hàng')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] })
      setShowExportStockModal(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể xuất kho')
    },
  })

  const { mutate: settleOrderWorkflow, isPending: settlingWorkflow } = useMutation({
    mutationFn: (data: SettleOrderPayload) => orderApi.settle(id, data),
    onSuccess: () => {
      toast.success('Đã quyết toán đơn hàng')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] })
      setShowSettleWorkflowModal(false)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể quyết toán')
    },
  })

  // Derived values
  const items: any[] = order?.items ?? []
  const isPaid = order?.paymentStatus === 'PAID' || order?.paymentStatus === 'COMPLETED'
  const discount = order?.discount ?? 0
  const subtotal = order?.subtotal ?? items.reduce((s: number, i: any) => s + (i.unitPrice ?? i.price ?? 0) * (i.quantity ?? 1), 0)
  const amountPaid = order?.paidAmount ?? order?.amountPaid ?? 0
  const total = order?.total ?? 0
  const remainingDebt = Math.max(0, total - amountPaid)
  const overpaidAmount = Math.max(0, amountPaid - total)
  const transactions: any[] = order?.transactions ?? []
  const canFinalize = order?.status !== 'COMPLETED' && order?.status !== 'CANCELLED'
  const canKeepCredit = Boolean(order?.customer?.id || order?.customerId)
  const payableAmount = remainingDebt > 0 ? remainingDebt : total
  const visiblePaymentMethods = filterVisiblePaymentMethods(paymentMethods, {
    branchId: order?.branchId,
    amount: payableAmount,
  })
  const qrBankMethods = visiblePaymentMethods.filter((m: any) => m.type === 'BANK' && m.qrEnabled)
  const activePaymentIntents = paymentIntents.filter((i: any) => i.status === 'PENDING')
  const selectedQrMethod = qrBankMethods.find((m: any) => m.id === selectedQrMethodId) ?? qrBankMethods[0] ?? null
  const activeQrIntent = activePaymentIntents.find((i: any) => i.paymentMethodId === selectedQrMethod?.id) ?? null
  const displayedQrIntent =
    qrIntentStream.latestIntent?.code === activeQrIntent?.code ? qrIntentStream.latestIntent : activeQrIntent

  useEffect(() => {
    if (!displayedQrIntent) return
    if (qrIntentStream.lastEvent !== 'paid') return
    if (handledPaidIntentCodeRef.current === displayedQrIntent.code) return
    handledPaidIntentCodeRef.current = displayedQrIntent.code
    toast.success('Đã đối soát thanh toán chuyển khoản thành công')
    queryClient.invalidateQueries({ queryKey: ['order', id] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['order-payment-intents', id] })
  }, [displayedQrIntent, id, qrIntentStream.lastEvent, queryClient])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-foreground-muted font-medium">Đang tải hóa đơn...</p>
        </div>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-foreground-muted animate-fade-in">
        <AlertCircle size={48} className="opacity-30 text-error" />
        <p className="text-lg font-semibold text-foreground">Không tìm thấy đơn hàng</p>
        <p className="text-sm px-10 text-center">Hóa đơn này có thể đã bị xóa hoặc xảy ra lỗi kết nối mạng.</p>
        <button
          onClick={() => router.push('/orders')}
          className="mt-2 py-2 px-4 bg-background-secondary rounded-lg font-medium text-sm hover:bg-background-tertiary transition-colors border border-border"
        >
          ← Quay lại danh sách
        </button>
      </div>
    )
  }

  const hasServiceItems = items.some((item: any) => item.type === 'grooming' || item.type === 'hotel')
  const canExport = (order.status === 'CONFIRMED' || order.status === 'PROCESSING') && !order.stockExportedAt
  const canSettle = order.status === 'PROCESSING' && order.stockExportedAt && isPaid && hasServiceItems

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Navbar header */}
      <div className="flex items-center gap-4 bg-background border border-border p-4 rounded-2xl shadow-sm">
        <button onClick={() => router.push('/orders')}
          className="p-2.5 bg-background-secondary rounded-xl hover:bg-background-tertiary transition-colors border border-border">
          <ArrowLeft size={18} className="text-foreground-secondary" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">Chi tiết đơn hàng</h1>
            <span className="font-mono text-sm font-bold text-primary-500 bg-primary-500/10 px-3 py-1 rounded-lg">
              {order.orderNumber || '--'}
            </span>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
          <p className="text-sm text-foreground-muted mt-1 font-medium flex items-center gap-1.5 flex-wrap">
            <Calendar size={13} /> {formatDateTime(order.createdAt)}
            {order.branch?.name && <><span className="text-border mx-1">|</span> <Store size={13} /> {order.branch.name}</>}
            {order.approvedAt && <><span className="text-border mx-1">|</span> <CheckSquare size={13} className="text-success" /> Duyệt: {formatDateTime(order.approvedAt)}</>}
            {order.stockExportedAt && <><span className="text-border mx-1">|</span> <Package size={13} className="text-primary-500" /> Xuất kho: {formatDateTime(order.stockExportedAt)}</>}
            {order.settledAt && <><span className="text-border mx-1">|</span> <CheckCircle2 size={13} className="text-success" /> Quyết toán: {formatDateTime(order.settledAt)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.success('Tính năng in đang được hoàn thiện.')} title="In đơn"
            className="flex items-center gap-2 px-3 py-2 bg-background-secondary border border-border rounded-xl text-sm font-semibold text-foreground-secondary hover:bg-background-tertiary transition-colors">
            <Printer size={16} /> In
          </button>
        </div>
      </div>

      {/* Workflow Action Buttons */}
      {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
        <div className="flex items-center gap-3 bg-background border border-border p-4 rounded-2xl shadow-sm flex-wrap">
          <span className="text-sm font-semibold text-foreground-muted mr-2">Thao tác:</span>
          {order.status === 'PENDING' && canApproveOrder && (
            <button onClick={() => setShowApproveModal(true)} disabled={approving}
              className="flex items-center gap-2 px-4 py-2 bg-info/10 hover:bg-info/20 text-info text-sm font-bold rounded-xl transition-colors border border-info/30 disabled:opacity-50">
              <CheckSquare size={16} /> Duyệt đơn
            </button>
          )}
          {canExport && canExportStock && (
            <button onClick={() => setShowExportStockModal(true)} disabled={exportingStock}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-500 text-sm font-bold rounded-xl transition-colors border border-primary-500/30 disabled:opacity-50">
              <Package size={16} /> Xuất kho
            </button>
          )}
          {canSettle && canSettleOrder && (
            <button onClick={() => setShowSettleWorkflowModal(true)} disabled={settlingWorkflow}
              className="flex items-center gap-2 px-4 py-2 bg-success/10 hover:bg-success/20 text-success text-sm font-bold rounded-xl transition-colors border border-success/30 disabled:opacity-50">
              <CheckCircle2 size={16} /> Quyết toán
            </button>
          )}
          {canPayOrder && remainingDebt > 0 && !isPaid && (
            <button onClick={() => setShowPayModal(true)} disabled={paying}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
              <CreditCard size={16} /> Thanh toán
            </button>
          )}
          {order.status !== 'CANCELLED' && (
            <button onClick={() => {
              if (confirm('Bạn có chắc muốn hủy đơn hàng này?')) {
                orderApi.cancel(id, { reason: 'Hủy từ trang chi tiết' }).then(() => {
                  toast.success('Đã hủy đơn hàng')
                  queryClient.invalidateQueries({ queryKey: ['order', id] })
                  queryClient.invalidateQueries({ queryKey: ['orders'] })
                  queryClient.invalidateQueries({ queryKey: ['order-timeline', id] })
                }).catch(() => toast.error('Không thể hủy đơn hàng'))
              }
            }} className="flex items-center gap-2 px-4 py-2 bg-error/10 hover:bg-error/20 text-error text-sm font-bold rounded-xl transition-colors border border-error/30">
              <XCircle size={16} /> Hủy đơn
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column: Items & Totals ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Card */}
          <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2 pb-3 border-b border-border/50">
              <ShoppingCart size={18} className="text-primary-500" />
              Sản phẩm & Dịch vụ
              <span className="ml-auto text-xs font-semibold bg-background-secondary px-2.5 py-1 rounded-md text-foreground-muted">{items.length} mục</span>
            </h2>
            <div className="space-y-3">
              {items.map((item: any, idx: number) => {
                const isService = item.type === 'service' || item.type === 'hotel' || item.type === 'grooming'
                const img = item.image || item.serviceImage || item.productImage
                const name = item.name || item.productName || item.serviceName || item.description || '—'
                const variantNote = item.variantName || item.petName
                const qty = item.quantity ?? 1
                const price = item.unitPrice ?? item.price ?? 0
                const lineTotal = price * qty

                return (
                  <div key={item.id || idx} className="flex items-start gap-4 p-3.5 bg-background-secondary/50 rounded-xl border border-border/50 transition-colors hover:bg-background-secondary">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-background flex items-center justify-center shrink-0 border border-border/80 shadow-sm">
                      {img
                        ? <Image src={img} alt={name} width={48} height={48} className="h-full w-full object-cover" />
                        : isService ? <Scissors size={18} className="text-accent-500" /> : <Package size={18} className="text-primary-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-foreground leading-tight">{name}</p>
                      {variantNote && <p className="text-xs text-foreground-muted mt-1 font-medium bg-background border border-border inline-block px-1.5 rounded">{variantNote}</p>}
                      {item.sku && <p className="text-[11px] font-mono text-foreground-muted/70 mt-1">SKU: {item.sku}</p>}
                    </div>
                    <div className="text-right shrink-0 mt-0.5">
                      <p className="text-[15px] font-bold text-foreground">{formatCurrency(lineTotal)}</p>
                      <p className="text-xs text-foreground-muted mt-1 font-medium">{qty > 1 ? `${qty} × ${formatCurrency(price)}` : formatCurrency(price)}</p>
                    </div>
                  </div>
                )
              })}
              {items.length === 0 && <p className="text-sm text-foreground-muted italic py-4 text-center">Không có sản phẩm nào ghi nhận.</p>}
            </div>

            {/* Totals */}
            <div className="mt-5 p-4 rounded-xl bg-background-secondary border border-border space-y-3">
              <div className="flex justify-between text-sm text-foreground-secondary font-medium">
                <span>Tạm tính</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-error font-medium">
                  <span className="flex items-center gap-1.5"><Percent size={14} /> Giảm giá</span><span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-border/70 mt-2">
                <span className="font-bold text-base text-foreground">Tổng thanh toán</span>
                <span className="font-bold text-xl text-primary-500 bg-background px-3 py-1 rounded-lg border border-border shadow-sm">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2"><FileText size={16} /> Ghi chú</h2>
              <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl">
                <p className="text-sm text-foreground-secondary leading-relaxed font-medium">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
                <ListOrdered size={18} className="text-primary-500" /> Lịch sử thay đổi
              </h2>
              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {timeline.map((entry: any, i: number) => (
                  <div key={entry.id} className="relative flex items-start gap-4 pb-4 last:pb-0">
                    <div className="absolute left-0 w-6 h-6 rounded-full bg-background border-[3px] border-primary-500 z-10 flex items-center justify-center shadow-sm"></div>
                    <div className="pl-9 pt-0.5 w-full">
                      <div className="bg-background-secondary border border-border/60 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-bold text-[15px] text-foreground">{ORDER_ACTION_LABELS[entry.action] ?? entry.action}</p>
                          <span className="text-[11px] text-foreground-muted font-medium">{formatDateTime(entry.createdAt)}</span>
                        </div>
                        {entry.fromStatus && entry.toStatus && (
                          <div className="flex items-center gap-2 text-xs">
                            <OrderStatusBadge status={entry.fromStatus} />
                            <span className="text-foreground-muted">→</span>
                            <OrderStatusBadge status={entry.toStatus} />
                          </div>
                        )}
                        {entry.note && <p className="text-xs text-foreground-muted mt-2 italic">"{entry.note}"</p>}
                        <p className="text-[11px] text-foreground-muted mt-1">Bởi: {entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Info Sidebar ── */}
        <div className="space-y-6">
          {/* Payment Overview */}
          <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-primary-500" /> Tổng quan thanh toán
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-background-secondary p-3 rounded-xl border border-border/50">
                <span className="text-sm text-foreground-muted font-medium">Trạng thái</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
              <div className="flex items-center justify-between p-1">
                <span className="text-sm text-foreground-muted font-medium">Đã thanh toán</span>
                <span className="text-[15px] font-bold text-success">{formatCurrency(amountPaid)}</span>
              </div>
              {overpaidAmount > 0 && (
                <div className="flex items-center justify-between p-1 border-t border-dashed border-border pt-3 mt-1">
                  <span className="text-sm font-semibold text-primary-500">Đang dư</span>
                  <span className="text-lg font-bold text-primary-500">{formatCurrency(overpaidAmount)}</span>
                </div>
              )}
              {remainingDebt > 0 && (
                <div className="flex items-center justify-between p-1 border-t border-dashed border-border pt-3 mt-1">
                  <span className="text-sm font-semibold text-warning flex items-center gap-1.5"><AlertCircle size={14} /> Còn nợ</span>
                  <span className="text-lg font-bold text-warning">{formatCurrency(remainingDebt)}</span>
                </div>
              )}
            </div>

            {/* Payment History */}
            {order.payments && order.payments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground-muted mb-3">Lịch sử thanh toán</h3>
                <div className="space-y-2">
                  {order.payments.map((p: any, i: number) => (
                    <div key={i} className="bg-background-secondary border border-border/60 rounded-xl p-3">
                      <p className="font-bold text-[15px] text-foreground">{formatCurrency(p.amount)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold px-2 py-0.5 bg-background rounded border border-border text-foreground-secondary">
                          {PAYMENT_METHOD_LABELS[p.method] || p.method}
                        </span>
                        <span className="text-[11px] text-foreground-muted font-medium">{formatDateTime(p.createdAt || new Date())}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* QR Payment */}
          {remainingDebt > 0 && qrBankMethods.length > 0 && (
            <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-base text-foreground flex items-center gap-2"><QrCode size={18} className="text-primary-500" /> QR chuyển khoản</h2>
                {displayedQrIntent ? <span className="rounded-full bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-500">{formatCurrency(displayedQrIntent.amount)}</span> : null}
              </div>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-[0.16em] text-foreground-muted">Tài khoản nhận</label>
                  <select value={selectedQrMethod?.id ?? ''} onChange={(e) => setSelectedQrMethodId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background-secondary px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary-500">
                    {qrBankMethods.map((method: any) => (<option key={method.id} value={method.id}>{method.name}</option>))}
                  </select>
                </div>
                <button type="button" onClick={() => { if (selectedQrMethod) createPaymentIntent(selectedQrMethod.id) }}
                  disabled={!selectedQrMethod || creatingPaymentIntent || displayedQrIntent?.status === 'PAID'}
                  className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60">
                  <span className="inline-flex items-center gap-2"><RefreshCw size={16} className={creatingPaymentIntent ? 'animate-spin' : ''} />{displayedQrIntent ? 'Làm mới QR' : 'Tạo QR'}</span>
                </button>
                {displayedQrIntent && displayedQrIntent.qrUrl && (
                  <div className="rounded-2xl border p-4 border-sky-200 bg-sky-50/70">
                    <div className="rounded-2xl bg-white p-3 shadow-sm">
                      <img src={displayedQrIntent.qrUrl} alt="QR" className="mx-auto h-48 w-48 max-w-full" />
                    </div>
                    <div className="mt-3 rounded-xl bg-white/80 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">Nội dung chuyển khoản</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{displayedQrIntent.transferContent}</span>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(displayedQrIntent.transferContent); toast.success('Đã copy nội dung') }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-foreground-muted transition-colors hover:text-foreground"><Copy size={14} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2"><User size={18} className="text-primary-500" /> Khách hàng</h2>
            {order.customer ? (
              <button onClick={() => { if (canReadCustomers) router.push(`/customers/${order.customer.customerCode || order.customer.id}`) }}
                className="w-full flex items-center gap-3 text-left bg-background-secondary hover:bg-background-tertiary p-3 rounded-xl border border-border transition-colors group" disabled={!canReadCustomers}>
                <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 border border-primary-500/20"><User size={18} className="text-primary-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-foreground group-hover:text-primary-500 transition-colors">{order.customer.name || order.customer.fullName}</p>
                  {order.customer.phone && <p className="text-xs text-foreground-muted flex items-center gap-1.5 mt-1 font-medium"><Phone size={11} /> {order.customer.phone}</p>}
                </div>
                <ChevronRight size={16} className="text-foreground-muted" />
              </button>
            ) : (
              <div className="bg-background-secondary p-3 rounded-xl border border-border text-center"><p className="text-sm font-medium text-foreground-muted">Khách lẻ</p></div>
            )}
          </div>

          {/* Additional Info */}
          <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2"><Receipt size={18} className="text-primary-500" /> Thông tin bổ sung</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-background-secondary p-2.5 rounded-lg border border-border/50">
                <Hash size={14} className="text-foreground-muted shrink-0" />
                <span className="text-sm font-medium text-foreground-secondary">Mã truy vết</span>
                <span className="ml-auto font-mono text-[13px] font-bold text-foreground truncate pl-2">{order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              {order.staff && (
                <div className="flex items-center gap-3 bg-background-secondary p-2.5 rounded-lg border border-border/50">
                  <User size={14} className="text-foreground-muted shrink-0" />
                  <span className="text-sm font-medium text-foreground-secondary">Nhân viên</span>
                  <span className="ml-auto text-sm font-bold text-foreground pr-1">{order.staff.fullName || order.staff.name || '—'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <PosPaymentModal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        cartTotal={payableAmount}
        paymentMethods={visiblePaymentMethods}
        initialPayments={[]}
        minimumMethods={1}
        title="Thu tiền đơn hàng"
        description="Chọn phương thức thanh toán."
        onConfirm={(payload) => payOrder({ payments: payload.payments })}
      />

      <OrderSettlementModal
        isOpen={showSettlementModal}
        onClose={() => setShowSettlementModal(false)}
        onConfirm={(payload) => completeOrder(payload)}
        orderNumber={order.orderNumber}
        total={total}
        amountPaid={amountPaid}
        canKeepCredit={canKeepCredit}
        isPending={completing}
        branchId={order.branchId}
      />

      <ApproveOrderModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={(data) => approveOrder(data)}
        orderNumber={order.orderNumber}
        isPending={approving}
      />

      <ExportStockModal
        isOpen={showExportStockModal}
        onClose={() => setShowExportStockModal(false)}
        onConfirm={(data) => exportStock(data)}
        orderNumber={order.orderNumber}
        isPending={exportingStock}
      />

      <SettleOrderModalComponent
        isOpen={showSettleWorkflowModal}
        onClose={() => setShowSettleWorkflowModal(false)}
        onConfirm={(data) => settleOrderWorkflow(data)}
        orderNumber={order.orderNumber}
        isPending={settlingWorkflow}
      />
    </div>
  )
}
