import type { Metadata } from 'next'
import { OrderWorkspace } from '../_components/order-workspace'

export const metadata: Metadata = {
  title: 'Chi Tiet Don Hang',
  description: 'Xem va cap nhat don hang trong workspace Orders',
}

export default async function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <OrderWorkspace mode="detail" orderId={params.id} />
}
