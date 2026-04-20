import { assertHasPositivePayments } from '../policies/order-workflow.policy'
import {
  calculateOrderPaymentStatus,
  calculateOrderRemainingAmount,
} from './order-workflow.application'

type OrderPaymentEntry = {
  method: string
  amount: number
  note?: string | null | undefined
  paymentAccountId?: string | null
  paymentAccountLabel?: string | null
}

export function buildOrderPaymentUpdate(params: {
  order: {
    id: string
    total: number
    paidAmount: number
  }
  payments: OrderPaymentEntry[]
}) {
  const acceptedPayments = params.payments.filter((payment) => payment.amount > 0)
  assertHasPositivePayments(acceptedPayments, 'So tien thanh toan phai lon hon 0')

  const newPaidThisTime = acceptedPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const totalPaid = params.order.paidAmount + newPaidThisTime
  const remainingAmount = calculateOrderRemainingAmount(params.order.total, totalPaid)
  const paymentStatus = calculateOrderPaymentStatus(params.order.total, totalPaid)

  return {
    acceptedPayments,
    newPaidThisTime,
    totalPaid,
    remainingAmount,
    paymentStatus,
  }
}
