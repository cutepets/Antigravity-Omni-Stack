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
      <div className="mb-4">
        <p className="text-foreground-muted text-sm flex items-center gap-2">
          <Building2 size={15} className="text-primary-500" /> 
          Quản lý danh sách nhà cung cấp, thông tin liên hệ và công nợ.
        </p>
      </div>
      <SupplierList />
    </>
  )
}
