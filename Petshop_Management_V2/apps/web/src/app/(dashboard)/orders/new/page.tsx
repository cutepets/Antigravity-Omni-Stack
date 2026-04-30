import type { Metadata } from 'next'
import { OrderWorkspace } from '../_components/order-workspace'

export const metadata: Metadata = {
  title: 'Tạo đơn hàng',
  description: 'Tạo đơn hàng nhiều bước trong workspace Orders',
}

export default async function NewOrderPage(props: { searchParams?: Promise<{ copyFrom?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : undefined
  return <OrderWorkspace mode="create" copyFromOrderId={searchParams?.copyFrom} />
}
