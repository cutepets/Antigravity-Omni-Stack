import { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { Building2 } from 'lucide-react'
import { SupplierList } from './_components/supplier-list'

export const metadata: Metadata = {
  title: 'Nhà cung cấp | Petshop',
  description: 'Quản lý đối tác và nhà cung cấp hàng hóa',
}

export default function SuppliersPage() {
  return (
    <>

      <SupplierList />
    </>
  )
}
