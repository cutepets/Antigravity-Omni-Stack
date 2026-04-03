import { Metadata } from 'next'
import { ProductList } from './_components/product-list'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { Package } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Kho & Sản phẩm | Petshop',
  description: 'Quản lý sản phẩm và tồn kho',
}

export default function InventoryPage() {
  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="Sản phẩm & Kho"
        description="Quản lý danh sách sản phẩm, giá bán, giá vốn và thiết lập tồn kho"
        icon={Package}
      />
      <ProductList />
    </PageContainer>
  )
}
