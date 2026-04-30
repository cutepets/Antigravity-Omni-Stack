import { toast } from 'sonner'
import { formatCurrency } from './utils'

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

export interface PrintOrderK80Data {
  shopName?: string
  shopAddress?: string
  shopPhone?: string
  orderNumber: string
  createdAt: string
  customerName: string
  customerPhone?: string
  branchName?: string
  staffName?: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    subtotal: number
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
  }>
}

export function printOrderK80(order: PrintOrderK80Data) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    toast.error('Vui lòng cho phép mở cửa sổ mới để in hóa đơn.')
    return
  }

  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td colspan="2" class="item-name">${item.description}</td>
    </tr>
    <tr>
      <td class="item-detail">${item.quantity} x ${formatCurrency(item.unitPrice)}</td>
      <td class="item-price">${formatCurrency(item.subtotal)}</td>
    </tr>`
    )
    .join('')

  const paymentsHtml =
    order.payments
      ?.map(
        (p) => `
    <tr>
      <td class="payment-detail">${PAYMENT_METHOD_LABELS[p.method] || p.method}</td>
      <td class="payment-amount">${formatCurrency(p.amount)}</td>
    </tr>`
      )
      .join('') || ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Hóa đơn ${order.orderNumber}</title>
  <style>
    @page { size: 80mm; margin: 2mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #000;
      width: 72mm;
      margin: 0 auto;
      padding: 2mm;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .header h1 { font-size: 14px; margin-bottom: 2px; }
    .header p { font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    .item-name { font-size: 11px; padding: 2px 0; }
    .item-detail { font-size: 10px; color: #333; }
    .item-price { font-size: 11px; font-weight: bold; text-align: right; }
    .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
    .grand-total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
    .payment-detail { font-size: 10px; }
    .payment-amount { font-size: 11px; font-weight: bold; text-align: right; }
    .notes { background: #f9f9f9; padding: 4px; border-radius: 2px; margin-top: 4px; font-size: 10px; }
    .footer { font-size: 9px; color: #666; margin-top: 8px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header center">
    <h1 class="bold">${order.shopName || 'HÓA ĐƠN BÁN HÀNG'}</h1>
    ${order.shopAddress ? `<p>${order.shopAddress}</p>` : ''}
    ${order.shopPhone ? `<p>ĐT: ${order.shopPhone}</p>` : ''}
  </div>

  <div class="divider"></div>

  <div>
    <p><span class="bold">Mã:</span> ${order.orderNumber}</p>
    <p><span class="bold">Ngày:</span> ${order.createdAt}</p>
    ${order.branchName ? `<p><span class="bold">CN:</span> ${order.branchName}</p>` : ''}
    ${order.staffName ? `<p><span class="bold">NV:</span> ${order.staffName}</p>` : ''}
  </div>

  <div class="divider"></div>

  <p class="bold">Khách: ${order.customerName}</p>
  ${order.customerPhone ? `<p>ĐT: ${order.customerPhone}</p>` : ''}

  <div class="divider"></div>

  <table>
    ${itemsHtml}
  </table>

  <div class="divider"></div>

  <div>
    <div class="total-row"><span>Tạm tính:</span><span>${formatCurrency(order.subtotal)}</span></div>
    ${order.discount > 0 ? `<div class="total-row" style="color:#e74c3c;"><span>Giảm giá:</span><span>-${formatCurrency(order.discount)}</span></div>` : ''}
    ${order.shippingFee && order.shippingFee > 0 ? `<div class="total-row"><span>Phí ship:</span><span>${formatCurrency(order.shippingFee)}</span></div>` : ''}
    <div class="total-row grand-total"><span>TỔNG:</span><span>${formatCurrency(order.total)}</span></div>
    <div class="total-row"><span>Đã trả:</span><span style="color:#27ae60;">${formatCurrency(order.paidAmount)}</span></div>
    ${order.remainingAmount > 0 ? `<div class="total-row"><span>Còn nợ:</span><span style="color:#e67e22;">${formatCurrency(order.remainingAmount)}</span></div>` : ''}
  </div>

  ${paymentsHtml ? `
  <div class="divider"></div>
  <p class="bold">Thanh toán:</p>
  <table>
    ${paymentsHtml}
  </table>` : ''}

  ${order.notes ? `
  <div class="divider"></div>
  <div class="notes">
    <p class="bold">Ghi chú:</p>
    <p>${order.notes}</p>
  </div>` : ''}

  <div class="divider"></div>
  <div class="footer center">
    <p>Cảm ơn quý khách!</p>
    <p>Hẹn gặp lại</p>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()
}
