import { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { Building2 } from 'lucide-react'
import { SupplierList } from './_components/supplier-list'

export const metadata: Metadata = {
  title: '🏭 Nhà cung cấp',
  description: 'Quản lý đối tác và nhà cung cấp hàng hóa',
}

function SuppliersFallback() {
  return <div className="flex items-center justify-center p-8"><div className="text-foreground-muted">Đang tải...</div></div>
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<SuppliersFallback />}>
      <SupplierList />
    </Suspense>
  )
}
