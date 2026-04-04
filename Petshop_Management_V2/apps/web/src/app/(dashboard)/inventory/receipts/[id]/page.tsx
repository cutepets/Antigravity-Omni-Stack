import { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { ReceiptDetail } from './_components/receipt-detail'

export const metadata: Metadata = {
  title: 'Chi tiết phiếu nhập | Petshop',
}

type ReceiptDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const { id } = await params

  return (
    <PageContainer maxWidth="xl">
      <ReceiptDetail id={id} />
    </PageContainer>
  )
}
