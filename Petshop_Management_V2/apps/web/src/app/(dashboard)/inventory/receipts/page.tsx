import { Metadata } from 'next'
import { Suspense } from 'react'
import { ReceiptList } from './_components/receipt-list'

export const metadata: Metadata = {
  title: '📥 Phiếu nhập',
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
