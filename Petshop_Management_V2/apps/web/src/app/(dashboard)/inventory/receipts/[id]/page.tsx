import { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { ReceiptDetail } from './_components/receipt-detail'

export const metadata: Metadata = {
  title: 'Chi tiết phiếu nhập | Petshop',
}

export default function ReceiptDetailPage({ params }: { params: { id: string } }) {
  return (
    <PageContainer maxWidth="xl">
      <ReceiptDetail id={params.id} />
    </PageContainer>
  )
}
