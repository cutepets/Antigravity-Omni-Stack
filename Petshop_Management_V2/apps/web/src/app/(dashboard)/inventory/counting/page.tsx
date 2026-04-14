import { Metadata } from 'next'
import { Suspense } from 'react'
import { CountingDashboard } from './_components/counting-dashboard'

export const metadata: Metadata = {
  title: 'Kiểm kho | Petshop',
  description: 'Quản lý kiểm kho theo ca hàng tuần',
}

function CountingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-foreground-muted">Đang tải...</div>
    </div>
  )
}

export default function CountingPage() {
  return (
    <Suspense fallback={<CountingFallback />}>
      <CountingDashboard />
    </Suspense>
  )
}
