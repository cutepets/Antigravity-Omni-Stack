import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { FinanceWorkspace } from './_components/finance-workspace'

export const metadata: Metadata = {
  title: 'Sổ quỹ | Petshop',
  description: 'Theo dõi thu chi và dòng tiền tại quầy',
}

import { Suspense } from 'react'

export default function FinancePage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <Suspense fallback={<div>Loading finance workspace...</div>}>
        <FinanceWorkspace />
      </Suspense>
    </PageContainer>
  )
}
