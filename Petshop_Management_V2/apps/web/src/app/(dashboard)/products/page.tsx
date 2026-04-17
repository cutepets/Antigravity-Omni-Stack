import { Metadata } from 'next'
import { ProductList } from './_components/product-list'
import { PageContainer } from '@/components/layout/PageLayout'

export const metadata: Metadata = {
  title: 'Sản phẩm | Petshop',
  description: 'Quản lý sản phẩm',
}

export default function InventoryPage() {
  return (
    <PageContainer maxWidth="full" className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4">
      <ProductList />
    </PageContainer>
  )
}
