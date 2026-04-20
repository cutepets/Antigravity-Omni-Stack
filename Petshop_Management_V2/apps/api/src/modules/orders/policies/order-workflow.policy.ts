import { BadRequestException } from '@nestjs/common'
import { calculateOrderRemainingAmount } from '../application/order-workflow.application'

type OrderPaymentState = {
  paymentStatus?: string | null
}

type OrderPaymentIntentState = OrderPaymentState & {
  status?: string | null
}

type ServiceCompletionState = {
  forceComplete?: boolean
  groomingSessions?: Array<{ id: string; status: string; sessionCode?: string | null }>
  hotelStays?: Array<{ id: string; status: string }>
}

type SettleOrderState = {
  status?: string | null
  paymentStatus?: string | null
  stockExportedAt?: Date | null
  items?: Array<{ type?: string | null }>
}

export function assertOrderCanCreatePaymentIntent(order: OrderPaymentIntentState) {
  if (order.status === 'CANCELLED') {
    throw new BadRequestException('Khong the tao QR cho don hang da huy')
  }

  if (order.paymentStatus === 'PAID' || order.paymentStatus === 'COMPLETED') {
    throw new BadRequestException('Don hang da duoc thanh toan day du')
  }
}

export function resolveRequestedPaymentIntentAmount(
  order: { total: number; paidAmount: number },
  requestedAmount?: number,
) {
  const remainingAmount = calculateOrderRemainingAmount(order.total, order.paidAmount)

  if (remainingAmount <= 0) {
    throw new BadRequestException('Don hang khong con so tien de tao QR')
  }

  const amount = requestedAmount !== undefined ? Number(requestedAmount) : remainingAmount
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException('So tien tao QR khong hop le')
  }

  if (!Number.isInteger(amount)) {
    throw new BadRequestException('So tien QR phai la so nguyen VND')
  }

  if (amount > remainingAmount) {
    throw new BadRequestException('So tien QR khong duoc vuot qua cong no con lai')
  }

  return amount
}

export function assertOrderCanAcceptPayment(order: OrderPaymentState) {
  if (order.paymentStatus === 'PAID' || order.paymentStatus === 'COMPLETED') {
    throw new BadRequestException('Đơn hàng đã thanh toán đầy đủ')
  }
}

export function assertHasPositivePayments(
  payments: Array<{ amount: number }>,
  message = 'Số tiền thanh toán phải lớn hơn 0',
) {
  if (!payments.some((payment) => payment.amount > 0)) {
    throw new BadRequestException(message)
  }
}

export function assertServiceItemsReadyForCompletion(params: ServiceCompletionState) {
  if (params.forceComplete) return

  for (const session of params.groomingSessions ?? []) {
    if (!['COMPLETED', 'CANCELLED'].includes(session.status)) {
      throw new BadRequestException(
        `Phiên spa ${session.sessionCode ?? session.id} chưa hoàn thành. Vui lòng hoàn thành trước khi kết đơn.`,
      )
    }
  }

  for (const stay of params.hotelStays ?? []) {
    if (!['CHECKED_OUT', 'CANCELLED'].includes(stay.status)) {
      throw new BadRequestException(
        `Lượt lưu trú ${stay.id} chưa trả pet. Vui lòng checkout trước khi kết đơn.`,
      )
    }
  }
}

export function assertOrderCanCancel(order: { status?: string | null }) {
  if (order.status === 'COMPLETED') {
    throw new BadRequestException('Đơn đã hoàn thành không thể huỷ')
  }
}

export function assertOrderCanSettle(order: SettleOrderState) {
  if (order.status !== 'PROCESSING') {
    throw new BadRequestException(`Cannot settle order with status ${order.status}. Order must be in PROCESSING status.`)
  }

  const hasServiceItems = (order.items ?? []).some((item) => item.type === 'grooming' || item.type === 'hotel')
  if (!hasServiceItems) {
    throw new BadRequestException('Settle is only available for service orders (grooming/hotel).')
  }

  if (!order.stockExportedAt) {
    throw new BadRequestException('Cannot settle order until stock has been exported.')
  }

  if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'COMPLETED') {
    throw new BadRequestException('Cannot settle order until it is fully paid.')
  }
}
