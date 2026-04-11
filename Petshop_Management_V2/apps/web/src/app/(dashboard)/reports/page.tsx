import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'
import { ReportsWorkspace } from './_components/reports-workspace'

export const metadata: Metadata = {
  title: 'Báo cáo | Petshop',
  description: 'Theo dõi tổng quan kinh doanh, bán hàng, khách hàng và sổ quỹ.',
}

export default function ReportsPage() {
  return (
    <PageContainer maxWidth="full">
      <Suspense fallback={<div className="flex h-64 items-center justify-center text-foreground-muted">Đang tải báo cáo...</div>}>
        <ReportsWorkspace />
      </Suspense>
    </PageContainer>
  )
}
