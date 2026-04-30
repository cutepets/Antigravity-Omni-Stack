import { toast } from 'sonner'
import { formatCurrency, formatDateTime } from './utils'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ bán hàng',
  BANK: 'Chuyển khoản',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  ZALOPAY: 'ZaloPay',
  MIXED: 'Nhiều phương thức',
  POINTS: 'Điểm',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  CONFIRMED: 'Đã duyệt',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
}

export interface PrintOrderData {
  orderNumber: string
  createdAt: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
  branchName?: string
  staffName?: string
  status: string
  paymentStatus: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    subtotal: number
    sku?: string
    type?: string
  }>
  subtotal: number
  discount: number
  shippingFee?: number
  total: number
  paidAmount: number
  remainingAmount: number
  notes?: string
  payments?: Array<{
    method: string
    amount: number
    createdAt: string
  }>
}

export function printOrderA4(order: PrintOrderData) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    toast.error('Vui lòng cho phép mở cửa sổ mới để in hóa đơn.')
    return
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Hóa đơn ${order.orderNumber}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #667eea; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #667eea; margin-bottom: 8px; }
    .header p { font-size: 12px; color: #666; }
    .info-section { margin-bottom: 20px; }
    .info-section h3 { font-size: 13px; color: #667eea; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .info-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .info-row span:first-child { color: #666; }
    .info-row span:last-child { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f8f9fa; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .total-section { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .total-row.grand-total { font-size: 16px; font-weight: bold; color: #667eea; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 8px; }
    .payments-section { margin-top: 20px; }
    .payment-item { padding: 6px 0; border-bottom: 1px dashed #eee; display: flex; justify-content: space-between; }
    .notes-section { margin-top: 20px; padding: 12px; background: #fffde7; border-radius: 8px; border: 1px solid #fff59d; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-info { background: #d1ecf1; color: #0c5460; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HÓA ĐƠN BÁN HÀNG</h1>
      <p>Mã: <strong>${order.orderNumber}</strong> | Ngày: ${formatDateTime(order.createdAt)}</p>
      <p>Trạng thái: <span class="badge ${order.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}">${ORDER_STATUS_LABEL[order.status] ?? order.status}</span></p>
    </div>

    <div class="info-section">
      <h3>Thông tin khách hàng</h3>
      <div class="info-row"><span>Khách hàng:</span><span>${order.customerName}</span></div>
      ${order.customerPhone ? `<div class="info-row"><span>Số điện thoại:</span><span>${order.customerPhone}</span></div>` : ''}
      ${order.customerAddress ? `<div class="info-row"><span>Địa chỉ:</span><span>${order.customerAddress}</span></div>` : ''}
    </div>

    ${order.branchName || order.staffName ? `
    <div class="info-section">
      <h3>Thông tin cửa hàng</h3>
      ${order.branchName ? `<div class="info-row"><span>Chi nhánh:</span><span>${order.branchName}</span></div>` : ''}
      ${order.staffName ? `<div class="info-row"><span>Nhân viên:</span><span>${order.staffName}</span></div>` : ''}
    </div>` : ''}

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">STT</th>
          <th>Mô tả</th>
          <th class="text-center" style="width: 60px;">SL</th>
          <th class="text-right" style="width: 100px;">Đơn giá</th>
          <th class="text-right" style="width: 110px;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map((item, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${item.description}${item.sku ? `<br><span style="color:#999;font-size:10px;">SKU: ${item.sku}</span>` : ''}</td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          <td class="text-right">${formatCurrency(item.subtotal)}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row"><span>Tạm tính</span><span>${formatCurrency(order.subtotal)}</span></div>
      ${order.discount > 0 ? `<div class="total-row" style="color:#e74c3c;"><span>Giảm giá</span><span>-${formatCurrency(order.discount)}</span></div>` : ''}
      ${order.shippingFee && order.shippingFee > 0 ? `<div class="total-row"><span>Phí ship</span><span>${formatCurrency(order.shippingFee)}</span></div>` : ''}
      <div class="total-row grand-total"><span>Tổng thanh toán</span><span>${formatCurrency(order.total)}</span></div>
      <div class="total-row"><span>Đã thanh toán</span><span style="color:#27ae60;">${formatCurrency(order.paidAmount)}</span></div>
      ${order.remainingAmount > 0 ? `<div class="total-row" style="color:#e67e22;"><span>Còn nợ</span><span>${formatCurrency(order.remainingAmount)}</span></div>` : ''}
    </div>

    ${order.payments && order.payments.length > 0 ? `
    <div class="payments-section">
      <h3 style="font-size:13px;color:#667eea;margin-bottom:8px;text-transform:uppercase;">Lịch sử thanh toán</h3>
      ${order.payments.map((p) => `
        <div class="payment-item">
          <span>${PAYMENT_METHOD_LABELS[p.method] || p.method} - ${formatDateTime(p.createdAt)}</span>
          <span style="font-weight:600;color:#27ae60;">${formatCurrency(p.amount)}</span>
        </div>`).join('')}
    </div>` : ''}

    ${order.notes ? `<div class="notes-section"><strong>Ghi chú:</strong><br>${order.notes}</div>` : ''}

    <div class="footer">
      <p>Cảm ơn quý khách! Hẹn gặp lại.</p>
      <p>In lúc: ${new Date().toLocaleString('vi-VN')}</p>
    </div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()
}
