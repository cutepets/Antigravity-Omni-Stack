import { Metadata } from 'next'
import { ReceiptDetail } from './_components/receipt-detail'

export const metadata: Metadata = {
  title: 'Cập nhật phiếu nhập | Petshop',
}

type ReceiptDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const { id } = await params

  return <ReceiptDetail id={id} />
}
