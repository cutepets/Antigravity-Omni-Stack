export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  UNPAID: 'badge badge-warning',
  PARTIAL: 'badge badge-accent',
  PAID: 'badge badge-success',
  COMPLETED: 'badge badge-info',
  REFUNDED: 'badge badge-ghost',
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chua thanh toan',
  PARTIAL: 'Thanh toan 1 phan',
  PAID: 'Da thanh toan',
  COMPLETED: 'Hoan thanh',
  REFUNDED: 'Da hoan tien',
}

export const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge badge-warning',
  CONFIRMED: 'badge badge-info',
  PROCESSING: 'badge badge-accent',
  COMPLETED: 'badge badge-success',
  CANCELLED: 'badge badge-ghost',
  REFUNDED: 'badge badge-error',
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Cho duyet',
  CONFIRMED: 'Da duyet',
  PROCESSING: 'Dang xu ly',
  COMPLETED: 'Hoan thanh',
  CANCELLED: 'Da huy',
  REFUNDED: 'Da hoan tien',
}

export const ORDER_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Tao don hang',
  APPROVED: 'Duyet don',
  PAYMENT_ADDED: 'Them thanh toan',
  PAID: 'Thanh toan',
  STOCK_EXPORTED: 'Xuat kho',
  COMPLETED: 'Hoan thanh',
  CANCELLED: 'Huy don',
  REFUNDED: 'Hoan tien',
  NOTE_UPDATED: 'Cap nhat ghi chu',
  ITEM_ADDED: 'Them san pham',
  ITEM_REMOVED: 'Xoa san pham',
  DISCOUNT_APPLIED: 'Ap dung chiet khau',
  SETTLED: 'Quyet toan',
}
