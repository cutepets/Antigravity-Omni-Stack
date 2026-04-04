import { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { StockTransactionHistory } from '../_components/stock-transaction-history'

export const metadata: Metadata = {
  title: 'Lịch sử kho hàng | Petshop',
}

type StockTransactionPageProps = {
  params: Promise<{ id: string }>
}

export default async function StockTransactionPage({ params }: StockTransactionPageProps) {
  const { id } = await params

  return (
    <PageContainer maxWidth="xl">
      <StockTransactionHistory productId={id} />
    </PageContainer>
  )
}
