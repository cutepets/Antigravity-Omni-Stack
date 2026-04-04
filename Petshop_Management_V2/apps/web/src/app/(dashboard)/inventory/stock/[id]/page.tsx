import { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { StockTransactionHistory } from '../_components/stock-transaction-history'

export const metadata: Metadata = {
  title: 'Lịch sử kho hàng | Petshop',
}

export default function StockTransactionPage({ params }: { params: { id: string } }) {
  return (
    <PageContainer maxWidth="xl">
      <StockTransactionHistory productId={params.id} />
    </PageContainer>
  )
}
