import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageContainer } from '@/components/layout/PageLayout'
import { FinanceWorkspace } from '../_components/finance-workspace'

export const metadata: Metadata = {
  title: '💵 Chi tiết phiếu',
  description: 'Mở trực tiếp phiếu thu chi theo mã chứng từ',
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
