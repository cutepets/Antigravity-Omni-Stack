import { Metadata } from 'next'
import { CustomerList } from './_components/customer-list'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Khách hàng | Petshop',
  description: 'Quản lý khách hàng hội viên',
}

export default function CustomersPage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <CustomerList />
    </PageContainer>
  )
}
