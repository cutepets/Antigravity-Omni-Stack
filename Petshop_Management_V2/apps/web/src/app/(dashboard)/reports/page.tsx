import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'
import { ReportsWorkspace } from './_components/reports-workspace'

export const metadata: Metadata = {
  title: 'Bao cao | Petshop',
  description: 'Theo doi tong quan kinh doanh, ban hang, khach hang va so quy.',
}

export default function ReportsPage() {
  return (
    <PageContainer maxWidth="full">
      <Suspense fallback={<div className="flex h-64 items-center justify-center text-foreground-muted">Dang tai bao cao...</div>}>
        <ReportsWorkspace />
      </Suspense>
    </PageContainer>
  )
}
