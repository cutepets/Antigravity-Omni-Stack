export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  UNPAID: 'badge badge-warning',
  PARTIAL: 'badge badge-accent',
  PAID: 'badge badge-success',
  COMPLETED: 'badge badge-info',
  REFUNDED: 'badge badge-ghost',
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'Thanh toán 1 phần',
  PAID: 'Đã thanh toán',
  COMPLETED: 'Hoàn thành',
  REFUNDED: 'Đã hoàn tiền',
}

export const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge badge-warning',
  CONFIRMED: 'badge badge-info',
  PROCESSING: 'badge badge-accent',
  COMPLETED: 'badge badge-success',
  CANCELLED: 'badge bg-destructive/10 text-destructive border-transparent font-medium',
  PARTIALLY_REFUNDED: 'badge bg-destructive/10 text-destructive border-transparent font-medium',
  FULLY_REFUNDED: 'badge bg-destructive/10 text-destructive border-transparent font-medium',
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  CONFIRMED: 'Đặt hàng',
  PROCESSING: 'Đang giao dịch',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  PARTIALLY_REFUNDED: 'Hoàn 1 phần',
  FULLY_REFUNDED: 'Đã hoàn đủ',
}

export const ORDER_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Tạo đơn hàng',
  APPROVED: 'Duyệt đơn',
  PAYMENT_ADDED: 'Thêm thanh toán',
  PAID: 'Thanh toán',
  STOCK_EXPORTED: 'Xuất kho',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Hủy đơn',
  REFUNDED: 'Hoàn tiền',
  NOTE_UPDATED: 'Cập nhật ghi chú',
  ITEM_ADDED: 'Thêm sản phẩm',
  ITEM_REMOVED: 'Xóa sản phẩm',
  DISCOUNT_APPLIED: 'Áp dụng chiết khấu',
  SETTLED: 'Quyết toán',
}
