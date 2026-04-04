import { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageLayout'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CreateReceiptForm } from '../_components/create-receipt-form'

export const metadata: Metadata = {
  title: 'Tạo Phiếu Nhập | Petshop',
  description: 'Tạo phiếu nhập kho mới',
}

export default function CreateReceiptPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/inventory/receipts" className="text-foreground-muted hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-xl font-bold">Tạo phiếu nhập</h2>
        </div>
      </div>
      <CreateReceiptForm />
    </>
  )
}
