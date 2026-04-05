'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ShoppingCart, User, Phone, Calendar, CreditCard,
  Package, Scissors, CheckCircle2, Clock, AlertCircle, Printer,
  Receipt, Tag, Hash, Store, ChevronRight, Percent
} from 'lucide-react'
import { orderApi } from '@/lib/api/order.api'
import { formatDateTime, formatCurrency, cn } from '@/lib/utils'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { PosPaymentModal } from '../../pos/components/PosPaymentModal'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ bán hàng',
  TRANSFER: 'Chuyển khoản',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  ZALOPAY: 'ZaloPay',
  MIXED: 'Nhiều phương thức',
  POINTS: 'Điểm',
}

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge badge-warning',
  PARTIAL: 'badge badge-accent',
  PAID:    'badge badge-success',
  COMPLETED: 'badge badge-info',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Đang xử lý',
  PARTIAL: 'TT 1 phần',
  PAID:    'Đã thanh toán',
  COMPLETED: 'Hoàn thành',
}

function StatusBadge({ status }: { status: string }) {
  const lbl = PAYMENT_STATUS_LABEL[status] ?? status;
  const cls = PAYMENT_STATUS_BADGE[status] ?? 'badge badge-gray';
  return <span className={cls}>{lbl}</span>
}

export default function OrderDetailPage() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [showPayModal, setShowPayModal] = useState(false)

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id as string),
    enabled: !!id,
  })

  const { mutate: payOrder, isPending: paying } = useMutation({
    mutationFn: (data: any) => orderApi.pay(id as string, data),
    onSuccess: () => {
      toast.success('Thanh toán thành công')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setShowPayModal(false)
    },
    onError: () => toast.error('Lỗi khi thao tác thanh toán'),
  })

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
        <button onClick={() => router.push('/orders')} className="mt-2 py-2 px-4 bg-background-secondary rounded-lg font-medium text-sm hover:bg-background-tertiary transition-colors border border-border">
            ← Quay lại danh sách
        </button>
      </div>
    )
  }

  const items: any[] = order.items || []
  const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'COMPLETED'
  const discount = order.discount || 0
  const subtotal = order.subtotal ?? items.reduce((s: number, i: any) => s + (i.unitPrice ?? i.price ?? 0) * (i.quantity ?? 1), 0)
  const amountPaid = order.amountPaid ?? 0
  const total = order.total ?? 0
  const remainingDebt = Math.max(0, total - amountPaid)

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-16">
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
            <StatusBadge status={order.paymentStatus} />
          </div>
          <p className="text-sm text-foreground-muted mt-1 font-medium flex items-center gap-1.5 p-0">
            <Calendar size={13} /> {formatDateTime(order.createdAt)}
            {order.branch?.name && <> <span className="text-border mx-1">|</span> <Store size={13} /> {order.branch.name}</>}
          </p>
        </div>
        <button onClick={() => {
             toast.success('Tính năng in đang được hoàn thiện.');
          }} title="In đơn"
          className="flex items-center gap-2 px-4 py-2 bg-background-secondary border border-border rounded-xl text-sm font-semibold text-foreground-secondary hover:bg-background-tertiary transition-colors">
          <Printer size={16} /> In biên lai
        </button>
      </div>

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
                const isService = item.type?.toLowerCase().includes('service') || item.type === 'hotel' || item.type === 'grooming' || item.serviceId || item.serviceVariantId
                const img = item.image || item.serviceImage || item.productImage
                const name = item.name || item.productName || item.serviceName || item.description || '—'
                const variantNote = item.variantName || item.petName
                const qty = item.quantity ?? 1
                const price = item.unitPrice ?? item.price ?? 0
                const lineTotal = price * qty

                return (
                  <div key={item.id || idx} className="flex items-start gap-4 p-3.5 bg-background-secondary/50 rounded-xl border border-border/50 transition-colors hover:bg-background-secondary">
                    {/* Icon / image */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-background flex items-center justify-center shrink-0 border border-border/80 shadow-sm">
                      {img
                        ? <img src={img} alt={name} className="w-full h-full object-cover" />
                        : isService
                          ? <Scissors size={18} className="text-accent-500" />
                          : <Package size={18} className="text-primary-500" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-foreground leading-tight">{name}</p>
                      {variantNote && (
                        <p className="text-xs text-foreground-muted mt-1 font-medium bg-background border border-border inline-block px-1.5 rounded">{variantNote}</p>
                      )}
                      {item.sku && (
                        <p className="text-[11px] font-mono text-foreground-muted/70 mt-1">SKU: {item.sku}</p>
                      )}
                      {item.petName && !variantNote && (
                        <p className="text-xs text-primary-500 mt-1 font-semibold flex items-center gap-1"><User size={10} /> Thú cưng: {item.petName}</p>
                      )}
                    </div>

                    {/* Qty & price */}
                    <div className="text-right shrink-0 mt-0.5">
                      <p className="text-[15px] font-bold text-foreground">{formatCurrency(lineTotal)}</p>
                      <p className="text-xs text-foreground-muted mt-1 font-medium">
                        {qty > 1 ? `${qty} × ${formatCurrency(price)}` : formatCurrency(price)}
                      </p>
                    </div>
                  </div>
                )
              })}
              {items.length === 0 && (
                 <p className="text-sm text-foreground-muted italic py-4 text-center">Không có sản phẩm nào ghi nhận.</p>
              )}
            </div>

            {/* Totals Section */}
            <div className="mt-5 p-4 rounded-xl bg-background-secondary border border-border space-y-3">
              <div className="flex justify-between text-sm text-foreground-secondary font-medium">
                <span>Tạm tính</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-error font-medium">
                  <span className="flex items-center gap-1.5"><Percent size={14} /> Giảm giá</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              {order.shippingFee > 0 && (
                <div className="flex justify-between text-sm text-foreground-secondary font-medium">
                  <span>Phí ship</span>
                  <span>{formatCurrency(order.shippingFee)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-sm text-foreground-secondary font-medium">
                  <span>Thuế</span>
                  <span>{formatCurrency(order.tax)}</span>
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
              <h2 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                 Thêm thông tin ghi chú
              </h2>
              <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl">
                 <p className="text-sm text-foreground-secondary leading-relaxed font-medium">{order.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Info Sidebar ── */}
        <div className="space-y-6">
          {/* Payment Action Panel */}
          <div className="bg-background border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden">
             {/* Decorative background element */}
             <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl pointer-events-none" />
             
            <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-primary-500" /> Tổng quan thanh toán
            </h2>
            
            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between bg-background-secondary p-3 rounded-xl border border-border/50">
                <span className="text-sm text-foreground-muted font-medium">Trạng thái</span>
                <StatusBadge status={order.paymentStatus} />
              </div>
              
              {(order.paymentMethod || isPaid) && (
                 <div className="flex items-center justify-between p-1">
                   <span className="text-sm text-foreground-muted font-medium">Phương thức</span>
                   <span className="text-sm font-bold text-foreground">
                     {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod || (isPaid ? 'Đã thu' : '—')}
                   </span>
                 </div>
              )}
              
              <div className="flex items-center justify-between p-1">
                <span className="text-sm text-foreground-muted font-medium">Đã thanh toán</span>
                <span className="text-[15px] font-bold text-success">{formatCurrency(amountPaid)}</span>
              </div>

              {remainingDebt > 0 && (
                <div className="flex items-center justify-between p-1 border-t border-dashed border-border pt-3 mt-1">
                  <span className="text-sm font-semibold text-warning flex items-center gap-1.5"><AlertCircle size={14}/> Còn nợ</span>
                  <span className="text-lg font-bold text-warning">{formatCurrency(remainingDebt)}</span>
                </div>
              )}
            </div>

            {/* Pay button if not completely paid */}
            {remainingDebt > 0 && !isPaid && (
              <button
                onClick={() => setShowPayModal(true)}
                className="mt-5 w-full py-3 bg-primary-500 hover:bg-primary-600 text-white text-[15px] font-bold rounded-xl transition-all shadow-[0_4px_14px_0_rgba(var(--primary-500),0.39)] flex items-center justify-center gap-2 hover:translate-y-[-1px]"
              >
                <CheckCircle2 size={18} /> Thu tiền ngay
              </button>
            )}
          </div>

          {/* Customer */}
          <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
              <User size={18} className="text-primary-500" /> Khách hàng
            </h2>
            {order.customer ? (
              <button
                onClick={() => router.push(`/customers/${order.customer.customerCode || order.customer.id}`)}
                className="w-full flex items-center gap-3 text-left bg-background-secondary hover:bg-background-tertiary p-3 rounded-xl border border-border transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 border border-primary-500/20">
                  <User size={18} className="text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-foreground group-hover:text-primary-500 transition-colors">
                    {order.customer.name || order.customer.fullName}
                  </p>
                  {order.customer.phone && (
                    <p className="text-xs text-foreground-muted flex items-center gap-1.5 mt-1 font-medium">
                      <Phone size={11} /> {order.customer.phone}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-foreground-muted" />
              </button>
            ) : (
              <div className="bg-background-secondary p-3 rounded-xl border border-border text-center">
                 <p className="text-sm font-medium text-foreground-muted">Khách lẻ (không lưu TT)</p>
              </div>
            )}
          </div>

          {/* Trace Info */}
          <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
              <Receipt size={18} className="text-primary-500" /> Thông tin bổ sung
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-background-secondary p-2.5 rounded-lg border border-border/50">
                <Hash size={14} className="text-foreground-muted shrink-0" />
                <span className="text-sm font-medium text-foreground-secondary">Mã truy vết</span>
                <span className="ml-auto font-mono text-[13px] font-bold text-foreground truncate pl-2">{order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              
              {order.createdBy && (
                <div className="flex items-center gap-3 bg-background-secondary p-2.5 rounded-lg border border-border/50">
                  <User size={14} className="text-foreground-muted shrink-0" />
                  <span className="text-sm font-medium text-foreground-secondary">Tạo bởi</span>
                  <span className="ml-auto text-sm font-bold text-foreground pr-1">{order.createdBy.name || order.createdBy.email || 'Nhân viên'}</span>
                </div>
              )}
              
              {order.promotionCode && (
                <div className="flex items-center gap-3 bg-success/5 p-2.5 rounded-lg border border-success/20">
                  <Tag size={14} className="text-success shrink-0" />
                  <span className="text-sm font-medium text-success">Mã Voucher</span>
                  <span className="ml-auto text-[13px] font-mono font-bold text-success">{order.promotionCode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Payments */}
          {order.payments && order.payments.length > 0 && (
            <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
                <Clock size={18} className="text-primary-500" /> Lịch sử thanh toán
              </h2>
              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {order.payments.map((p: any, i: number) => (
                  <div key={i} className="relative flex items-start gap-4 pb-4 last:pb-0">
                    <div className="absolute left-0 w-6 h-6 rounded-full bg-background border-[3px] border-primary-500 z-10 flex items-center justify-center shadow-sm"></div>
                    <div className="pl-9 pt-0.5 w-full">
                       <div className="bg-background-secondary border border-border/60 rounded-xl p-3">
                          <p className="font-bold text-[15px] text-foreground">{formatCurrency(p.amount)}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs font-semibold px-2 py-0.5 bg-background rounded border border-border text-foreground-secondary">
                                {PAYMENT_METHOD_LABELS[p.method] || p.method}
                             </span>
                             <span className="text-[11px] text-foreground-muted font-medium">
                                {formatDateTime(p.createdAt || new Date())}
                             </span>
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Payment Wrapper ── */}
      <PosPaymentModal 
         isOpen={showPayModal} 
         onClose={() => setShowPayModal(false)}
         cartTotal={remainingDebt > 0 ? remainingDebt : total}
         onConfirm={(method, amount) => {
            payOrder({ payments: [{ method, amount }] });
         }}
      />
    </div>
  )
}
