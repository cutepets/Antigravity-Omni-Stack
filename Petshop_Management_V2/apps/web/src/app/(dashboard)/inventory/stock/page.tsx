import { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { AlertCircle, Package } from 'lucide-react'
import { StockList } from './_components/stock-list'

export const metadata: Metadata = {
  title: 'Tồn kho | Petshop',
  description: 'Quản lý số lượng tồn kho',
}

export default function StockPage() {
  return (
    <>
      <div className="mb-4">
        <p className="text-foreground-muted text-sm flex items-center gap-2">
          <AlertCircle size={15} className="text-primary-500" /> 
          Theo dõi số lượng hàng hóa trong kho, thiết lập định mức tối thiểu.
        </p>
      </div>
      <StockList />
    </>
  )
}
