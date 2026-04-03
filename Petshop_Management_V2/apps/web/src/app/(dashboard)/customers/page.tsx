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
    <PageContainer maxWidth="2xl">
      <PageHeader
        title="Khách hàng"
        description="Quản lý danh sách, phân hạng và điểm tích luỹ khách hàng"
        icon={Users}
      />
      <CustomerList />
    </PageContainer>
  )
}
