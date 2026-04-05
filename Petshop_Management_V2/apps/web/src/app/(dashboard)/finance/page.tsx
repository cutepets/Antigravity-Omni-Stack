import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { FinanceWorkspace } from './_components/finance-workspace'

export const metadata: Metadata = {
  title: 'So quy | Petshop',
  description: 'Theo doi thu chi va dong tien tai quầy',
}

export default function FinancePage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <FinanceWorkspace />
    </PageContainer>
  )
}
