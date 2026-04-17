import { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { FileDown } from 'lucide-react'
import { ReceiptList } from './_components/receipt-list'

export const metadata: Metadata = {
  title: 'Phiếu Nhập | Petshop',
  description: 'Quản lý phiếu nhập kho',
}

function ReceiptListLoading() {
  return <div className="p-4">Đang tải...</div>
}

export default function ReceiptsPage() {
  return (
    <>
      <Suspense fallback={<ReceiptListLoading />}>
        <ReceiptList />
      </Suspense>
    </>
  )
}
