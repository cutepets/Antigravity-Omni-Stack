import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'
import { FinanceWorkspace } from '../_components/finance-workspace'

export const metadata: Metadata = {
  title: 'Chi tiet phieu thu chi | Petshop',
  description: 'Mo truc tiep phieu thu chi theo ma chung tu',
}

export default function FinanceVoucherPage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <Suspense fallback={<div>Loading finance workspace...</div>}>
        <FinanceWorkspace />
      </Suspense>
    </PageContainer>
  )
}
