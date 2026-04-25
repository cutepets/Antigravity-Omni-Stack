import type { Metadata } from 'next'
import { OrderWorkspace } from '../_components/order-workspace'

export const metadata: Metadata = {
  title: '✍️ Tạo đơn hàng',
  description: 'Tạo đơn hàng nhiều bước trong workspace Orders',
}

export default function NewOrderPage() {
  return <OrderWorkspace mode="create" />
}
