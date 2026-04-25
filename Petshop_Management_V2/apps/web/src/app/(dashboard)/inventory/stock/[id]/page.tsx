import { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageLayout'
import { StockTransactionHistory } from '../_components/stock-transaction-history'

export const metadata: Metadata = {
  title: '🗂️ Lịch sử kho hàng',
}

type StockTransactionPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ variantId?: string; branchId?: string; variantScope?: 'base' }>
}

export default async function StockTransactionPage({ params, searchParams }: StockTransactionPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const variantId = typeof query?.variantId === 'string' ? query.variantId : undefined
  const branchId = typeof query?.branchId === 'string' ? query.branchId : undefined
  const variantScope = query?.variantScope === 'base' ? 'base' : undefined

  return (
    <PageContainer maxWidth="xl">
      <StockTransactionHistory productId={id} productVariantId={variantId} branchId={branchId} variantScope={variantScope} />
    </PageContainer>
  )
}
