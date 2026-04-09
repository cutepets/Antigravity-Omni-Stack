'use client'

import { CreateReceiptForm } from '../../_components/create-receipt-form'

type ReceiptDetailProps = {
  id: string
}

export function ReceiptDetail({ id }: ReceiptDetailProps) {
  return <CreateReceiptForm mode="edit" receiptId={id} />
}
