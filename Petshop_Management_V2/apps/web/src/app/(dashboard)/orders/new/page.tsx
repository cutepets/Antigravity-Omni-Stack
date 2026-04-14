import type { Metadata } from 'next'
import { OrderWorkspace } from '../_components/order-workspace'

export const metadata: Metadata = {
  title: 'Tao Don Hang',
  description: 'Tao don hang nhieu buoc trong workspace Orders',
}

export default function NewOrderPage() {
  return <OrderWorkspace mode="create" />
}
