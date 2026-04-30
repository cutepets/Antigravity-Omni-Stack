import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'

const ReportsWorkspace = dynamic(() =>
  import('./_components/reports-workspace').then((mod) => mod.ReportsWorkspace),
)

export const metadata: Metadata = {
  title: 'Báo cáo',
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
