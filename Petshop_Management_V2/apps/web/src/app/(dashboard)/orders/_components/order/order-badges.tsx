import { getOrderStatusMeta, getPaymentStatusMeta } from './order.utils'

export function PaymentStatusBadge({ status }: { status?: string }) {
  const meta = getPaymentStatusMeta(status)
  return <span className={meta.className}>{meta.label}</span>
}

export function OrderStatusBadge({ status }: { status?: string }) {
  const meta = getOrderStatusMeta(status)
  return <span className={meta.className}>{meta.label}</span>
}
