import { exportJsonToExcel } from './excel'
import { formatCurrency, formatDateTime } from './utils'

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  CONFIRMED: 'Đã duyệt',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'TT 1 phần',
  PAID: 'Đã thanh toán',
  COMPLETED: 'Hoàn thành',
  REFUNDED: 'Đã hoàn tiền',
}

export interface ExportOrderData {
  orderNumber: string
  createdAt: string
  customerName: string
  customerPhone?: string
  branchName?: string
  staffName?: string
  status: string
  paymentStatus: string
  subtotal: number
  discount: number
  total: number
  paidAmount: number
  remainingAmount: number
  notes?: string
  itemCount: number
  stockExportedAt?: string
  settledAt?: string
}

export async function exportOrdersToExcel(orders: ExportOrderData[], filename?: string) {
  const data = orders.map((o) => ({
    'Mã đơn': o.orderNumber,
    'Thời gian tạo': formatDateTime(o.createdAt),
    'Khách hàng': o.customerName,
    'SĐT': o.customerPhone || '--',
    'Chi nhánh': o.branchName || '--',
    'Nhân viên': o.staffName || '--',
    'Trạng thái': ORDER_STATUS_LABEL[o.status] ?? o.status,
    'TT thanh toán': PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus,
    'Tổng tiền': o.total,
    'Đã thanh toán': o.paidAmount,
    'Còn nợ': o.remainingAmount,
    'Số SP': o.itemCount,
    'Xuất kho': o.stockExportedAt ? formatDateTime(o.stockExportedAt) : 'Chưa',
    'Quyết toán': o.settledAt ? formatDateTime(o.settledAt) : 'Chưa',
    'Ghi chú': o.notes || '--',
  }))

  const defaultFilename = `don-hang-${new Date().toISOString().slice(0, 10)}.xlsx`
  return exportJsonToExcel(data, 'Đơn hàng', filename || defaultFilename)
}
