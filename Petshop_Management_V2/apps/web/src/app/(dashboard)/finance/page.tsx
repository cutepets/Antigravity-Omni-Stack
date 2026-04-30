import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { FinanceWorkspace } from './_components/finance-workspace'

export const metadata: Metadata = {
  title: 'Sổ quỹ',
  description: 'Theo dõi thu chi và dòng tiền tại quầy',
}

import { Suspense } from 'react'

export default function FinancePage() {
  return (
    <PageContainer maxWidth="full" variant="data-list">
      <Suspense fallback={<div>Loading finance workspace...</div>}>
        <FinanceWorkspace />
      </Suspense>
    </PageContainer>
  )
}
