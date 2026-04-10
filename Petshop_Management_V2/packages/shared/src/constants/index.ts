export const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Tiền mặt' },
  { key: 'BANK', label: 'Chuyển khoản' },
  { key: 'EWALLET', label: 'Vi dien tu' },
  { key: 'MOMO', label: 'MoMo' },
  { key: 'VNPAY', label: 'VNPay' },
  { key: 'CARD', label: 'Thẻ' },
  { key: 'POINTS', label: 'Điểm' },
] as const

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
  COMPLETED: 'Hoàn tất',
  REFUNDED: 'Đã hoàn tiền',
}

export const CUSTOMER_TIER_LABELS: Record<string, string> = {
  BRONZE: 'Đồng',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  PLATINUM: 'Bạch kim',
  DIAMOND: 'Kim cương',
}

export const STAFF_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên',
  VIEWER: 'Xem',
}

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  GROOMING: 'Grooming',
  HOTEL: 'Khách sạn',
  MEDICAL: 'Y tế',
  TRAINING: 'Đào tạo',
  DAYCARE: 'Giữ ban ngày',
  OTHER: 'Khác',
}

export const LOW_STOCK_THRESHOLD_DEFAULT = 5

export const LOYALTY_POINTS_RATE = 0.01 // 1% of order total = points
