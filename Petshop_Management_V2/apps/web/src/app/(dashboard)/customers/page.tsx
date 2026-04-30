import { Metadata } from 'next'
import { Suspense } from 'react'
import { CustomerList } from './_components/customer-list'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
  title: 'Khách hàng',
  description: 'Quản lý khách hàng hội viên',
}

function CustomerListFallback() {
  return (
    <PageContainer maxWidth="full" variant="data-list">
      <div className="flex items-center justify-center p-8">
        <div className="text-foreground-muted">Đang tải...</div>
      </div>
    </PageContainer>
  )
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<CustomerListFallback />}>
      <PageContainer maxWidth="full" variant="data-list">
        <CustomerList />
      </PageContainer>
    </Suspense>
  )
}
