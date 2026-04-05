import { Metadata } from 'next'
import { OrderList } from './_components/order-list'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
  title: 'Quản lý Đơn hàng',
  description: 'Danh sách và trạng thái đơn hàng',
}

export default function OrdersPage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <OrderList />
    </PageContainer>
  )
}
