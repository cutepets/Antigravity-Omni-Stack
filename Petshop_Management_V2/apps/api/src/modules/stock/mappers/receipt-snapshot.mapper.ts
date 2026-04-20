import type { PaymentStatus } from '@petshop/database'

export type ReceiptSnapshot = {
  orderedAmount: number
  receivedAmount: number
  returnedAmount: number
  payableAmount: number
  paidAmount: number
  outstandingAmount: number
  overpaidAmount: number
  itemCount: number
  orderedQty: number
  receivedQty: number
  returnedQty: number
  closedQty: number
  receiptStatus: string
  paymentStatus: PaymentStatus
  legacyStatus: string
  paymentDate: Date | null
  receivedAt: Date | null
  completedAt: Date | null
}

function toNumber(value: unknown) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function toInt(value: unknown) {
  return Math.max(0, Math.round(toNumber(value)))
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function buildLegacyReceiptStatus(receiptStatus: string) {
  if (receiptStatus === 'CANCELLED') return 'CANCELLED'
  if (receiptStatus === 'FULL_RECEIVED' || receiptStatus === 'SHORT_CLOSED') return 'RECEIVED'
  return 'DRAFT'
}

export function buildPaymentStatus(payableAmount: number, paidAmount: number): PaymentStatus {
  if (payableAmount <= 0) {
    return paidAmount > 0 ? 'PAID' : 'UNPAID'
  }

  if (paidAmount <= 0) return 'UNPAID'
  if (paidAmount < payableAmount) return 'PARTIAL'
  return 'PAID'
}

export function buildReceiptSnapshot(receipt: any): ReceiptSnapshot {
  const orderedAmount = roundCurrency(
    (receipt.items ?? []).reduce((sum: number, item: any) => sum + toNumber(item.totalPrice || item.quantity * item.unitPrice), 0),
  )
  const receivedAmount = roundCurrency(
    (receipt.items ?? []).reduce(
      (sum: number, item: any) =>
        sum +
        ((item.receiveItems?.length ?? 0) > 0
          ? item.receiveItems.reduce((itemSum: number, receiveItem: any) => itemSum + toNumber(receiveItem.totalPrice), 0)
          : toInt(item.receivedQuantity) * toNumber(item.unitPrice)),
      0,
    ),
  )
  const returnedAmount = roundCurrency(
    (receipt.items ?? []).reduce(
      (sum: number, item: any) =>
        sum +
        ((item.returnItems?.length ?? 0) > 0
          ? item.returnItems.reduce((itemSum: number, returnItem: any) => itemSum + toNumber(returnItem.totalPrice), 0)
          : toInt(item.returnedQuantity) * toNumber(item.unitPrice)),
      0,
    ),
  )
  const paidFromAllocations = roundCurrency(
    (receipt.paymentAllocations ?? []).reduce((sum: number, allocation: any) => sum + toNumber(allocation.amount), 0),
  )
  const paidAmount = roundCurrency(Math.max(toNumber(receipt.paidAmount), paidFromAllocations))
  const payableAmount = roundCurrency(Math.max(0, receivedAmount - returnedAmount))
  const outstandingAmount = roundCurrency(Math.max(0, payableAmount - paidAmount))
  const overpaidAmount = roundCurrency(Math.max(0, paidAmount - payableAmount))
  const orderedQty = (receipt.items ?? []).reduce((sum: number, item: any) => sum + toInt(item.quantity), 0)
  const receivedQty = (receipt.items ?? []).reduce((sum: number, item: any) => sum + toInt(item.receivedQuantity), 0)
  const returnedQty = (receipt.items ?? []).reduce((sum: number, item: any) => sum + toInt(item.returnedQuantity), 0)
  const closedQty = (receipt.items ?? []).reduce((sum: number, item: any) => sum + toInt(item.closedQuantity), 0)
  const latestPayment = [...(receipt.paymentAllocations ?? [])]
    .sort((left: any, right: any) => new Date(right.payment?.paidAt ?? 0).getTime() - new Date(left.payment?.paidAt ?? 0).getTime())[0]
  const latestReceive = [...(receipt.receiveEvents ?? [])]
    .sort((left: any, right: any) => new Date(right.receivedAt ?? 0).getTime() - new Date(left.receivedAt ?? 0).getTime())[0]

  let receiptStatus = 'DRAFT'
  const allFulfilled = (receipt.items ?? []).every(
    (item: any) => toInt(item.receivedQuantity) + toInt(item.closedQuantity) >= toInt(item.quantity),
  )
  const hasAnyReceive = receivedQty > 0
  const hasAnyClose = closedQty > 0

  if (receipt.cancelledAt || receipt.status === 'CANCELLED' || receipt.receiptStatus === 'CANCELLED') {
    receiptStatus = 'CANCELLED'
  } else if ((receipt.items?.length ?? 0) > 0 && allFulfilled && hasAnyClose) {
    receiptStatus = 'SHORT_CLOSED'
  } else if ((receipt.items?.length ?? 0) > 0 && allFulfilled && hasAnyReceive) {
    receiptStatus = 'FULL_RECEIVED'
  } else if (hasAnyReceive) {
    receiptStatus = 'PARTIAL_RECEIVED'
  }

  return {
    orderedAmount,
    receivedAmount,
    returnedAmount,
    payableAmount,
    paidAmount,
    outstandingAmount,
    overpaidAmount,
    itemCount: orderedQty,
    orderedQty,
    receivedQty,
    returnedQty,
    closedQty,
    receiptStatus,
    paymentStatus: buildPaymentStatus(payableAmount, paidAmount),
    legacyStatus: buildLegacyReceiptStatus(receiptStatus),
    paymentDate: latestPayment?.payment?.paidAt ? new Date(latestPayment.payment.paidAt) : null,
    receivedAt: latestReceive?.receivedAt ? new Date(latestReceive.receivedAt) : null,
    completedAt:
      receiptStatus === 'FULL_RECEIVED' || receiptStatus === 'SHORT_CLOSED'
        ? new Date(receipt.shortClosedAt ?? latestReceive?.receivedAt ?? new Date())
        : null,
  }
}
