import { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/layout/PageLayout'
import { FileDown } from 'lucide-react'
import { ReceiptList } from './_components/receipt-list'

export const metadata: Metadata = {
  title: 'Phiếu Nhập | Petshop',
  description: 'Quản lý phiếu nhập kho',
}

export default function ReceiptsPage() {
  return (
    <>

      <ReceiptList />
    </>
  )
}
