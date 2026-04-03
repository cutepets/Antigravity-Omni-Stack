import { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { FileDown } from 'lucide-react'
import { ReceiptList } from './_components/receipt-list'

export const metadata: Metadata = {
  title: 'Phiếu Nhập | Petshop',
  description: 'Quản lý phiếu nhập kho',
}

export default function ReceiptsPage() {
  return (
    <>
      <div className="mb-4">
        <p className="text-foreground-muted text-sm flex items-center gap-2">
          <FileDown size={15} className="text-primary-500" /> 
          Lịch sử các phiếu nhập kho, mua hàng từ nhà cung cấp.
        </p>
      </div>
      <ReceiptList />
    </>
  )
}
