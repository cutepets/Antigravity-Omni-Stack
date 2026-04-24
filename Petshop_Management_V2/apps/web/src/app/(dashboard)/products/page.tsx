import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { PageContainer } from '@/components/layout/PageLayout'

const ProductList = dynamic(() =>
  import('./_components/product-list').then((mod) => mod.ProductList),
)

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
