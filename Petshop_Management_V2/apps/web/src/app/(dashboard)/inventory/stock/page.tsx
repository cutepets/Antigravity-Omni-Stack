import { Metadata } from 'next'
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
