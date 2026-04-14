import { Metadata } from 'next'
import { Suspense } from 'react'
import { CustomerList } from './_components/customer-list'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Khách hàng | Petshop',
  description: 'Quản lý khách hàng hội viên',
}

function CustomerListFallback() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <div className="flex items-center justify-center p-8">
        <div className="text-foreground-muted">Đang tải...</div>
      </div>
    </PageContainer>
  )
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<CustomerListFallback />}>
      <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
        <CustomerList />
      </PageContainer>
    </Suspense>
  )
}
