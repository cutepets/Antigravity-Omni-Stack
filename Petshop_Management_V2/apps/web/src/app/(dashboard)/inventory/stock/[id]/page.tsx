import { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { StockTransactionHistory } from '../_components/stock-transaction-history'

export const metadata: Metadata = {
  title: 'Lịch sử kho hàng | Petshop',
}

type StockTransactionPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ variantId?: string }>
}

export default async function StockTransactionPage({ params, searchParams }: StockTransactionPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const variantId = typeof query?.variantId === 'string' ? query.variantId : undefined

  return (
    <PageContainer maxWidth="xl">
      <StockTransactionHistory productId={id} productVariantId={variantId} />
    </PageContainer>
  )
}
