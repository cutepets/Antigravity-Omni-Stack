import { Metadata } from 'next'
import { CreateReceiptForm } from '../_components/create-receipt-form'

export const metadata: Metadata = {
  title: 'Tạo Phiếu Nhập | Petshop',
  description: 'Tạo phiếu nhập kho mới',
}

export default function CreateReceiptPage() {
  return <CreateReceiptForm />
}
