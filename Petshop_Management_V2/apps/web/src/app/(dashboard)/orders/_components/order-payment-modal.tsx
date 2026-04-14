'use client'

import type { ComponentProps } from 'react'
import { PosPaymentModal } from '../../pos/components/PosPaymentModal'

export type OrderPaymentModalProps = ComponentProps<typeof PosPaymentModal>

export function OrderPaymentModal(props: OrderPaymentModalProps) {
  return <PosPaymentModal {...props} />
}
