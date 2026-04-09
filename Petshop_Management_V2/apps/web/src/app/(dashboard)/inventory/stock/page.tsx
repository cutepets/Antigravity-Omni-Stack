import { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { AlertCircle, Package } from 'lucide-react'
import { StockList } from './_components/stock-list'

export const metadata: Metadata = {
  title: 'Tồn kho | Petshop',
  description: 'Quản lý số lượng tồn kho',
}

export default function StockPage() {
  return (
    <>

      <StockList />
    </>
  )
}
