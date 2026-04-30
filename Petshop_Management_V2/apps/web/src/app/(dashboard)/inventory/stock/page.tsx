import { Metadata } from 'next'
import { Suspense } from 'react'
import { StockList } from './_components/stock-list'

export const metadata: Metadata = {
  title: 'Tồn kho',
  description: 'Quản lý số lượng tồn kho',
}

function StockFallback() {
  return <div className="flex items-center justify-center p-8"><div className="text-foreground-muted">Đang tải...</div></div>
}

export default function StockPage() {
  return (
    <Suspense fallback={<StockFallback />}>
      <StockList />
    </Suspense>
  )
}
