import { BadRequestException } from '@nestjs/common'
import { calculateOrderPaymentStatus } from './order-workflow.application'

type CompletionPaymentEntry = {
  method: string
  amount: number
}

export function buildOrderCompletionSettlement(params: {
  orderTotal: number
  orderPaidAmount: number
  extraPayments: CompletionPaymentEntry[]
  overpaymentAction?: 'NONE' | 'REFUND' | 'KEEP_CREDIT'
  hasCustomer: boolean
}) {
  const extraPaidAmount = params.extraPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const grossPaidAmount = params.orderPaidAmount + extraPaidAmount
  const overpaidAmount = Math.max(0, grossPaidAmount - params.orderTotal)
  const outstandingAmount = Math.max(0, params.orderTotal - grossPaidAmount)

  if (outstandingAmount > 0) {
    throw new BadRequestException(
      `Đơn hàng còn thiếu ${outstandingAmount.toLocaleString('vi-VN')} đ. Vui lòng thu đủ trước khi hoàn tất.`,
    )
  }

  let finalPaidAmount = grossPaidAmount
  let adjustment: { type: 'REFUND' | 'KEEP_CREDIT'; amount: number } | null = null

  if (overpaidAmount > 0) {
    if (params.overpaymentAction === 'REFUND') {
      finalPaidAmount = params.orderTotal
      adjustment = { type: 'REFUND', amount: overpaidAmount }
    } else if (params.overpaymentAction === 'KEEP_CREDIT') {
      if (!params.hasCustomer) {
        throw new BadRequestException('Không thể giữ tiền dư vào công nợ khi đơn không có khách hàng')
      }

      adjustment = { type: 'KEEP_CREDIT', amount: overpaidAmount }
    } else {
      throw new BadRequestException(
        `Đơn hàng đang dư ${overpaidAmount.toLocaleString('vi-VN')} đ. Hãy chọn hoàn tiền hoặc giữ lại công nợ âm.`,
      )
    }
  }

  return {
    extraPaidAmount,
    grossPaidAmount,
    overpaidAmount,
    outstandingAmount,
    finalPaidAmount,
    paymentStatus: calculateOrderPaymentStatus(params.orderTotal, Math.min(finalPaidAmount, params.orderTotal)),
    adjustment,
  }
}
