import { Metadata } from 'next'
import { Suspense } from 'react'
import { OrderList } from './_components/order-list'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
  title: 'Quản lý Đơn hàng',
  description: 'Danh sách và trạng thái đơn hàng',
}

function OrderListLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}

export default function OrdersPage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <Suspense fallback={<OrderListLoading />}>
        <OrderList />
      </Suspense>
    </PageContainer>
  )
}
