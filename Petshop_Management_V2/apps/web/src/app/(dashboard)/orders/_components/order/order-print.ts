'use client'

import dayjs from 'dayjs'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { getOrderStatusMeta, getPaymentStatusMeta } from './order.utils'
import type { OrderPrintPayload } from './order.types'

function buildRowsHtml(payload: OrderPrintPayload) {
  return payload.items
    .map(
      (item, index) => `
        <tr>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;">${index + 1}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;">${item.description}${item.variantName ? ` (${item.variantName})` : ''}${item.sku ? `<br><small style="color:#999">${item.sku}</small>` : ''}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.unit ?? '—'}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.quantity}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${Number(item.unitPrice ?? 0).toLocaleString('vi-VN')}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${(Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0) - Number(item.discountItem ?? 0)).toLocaleString('vi-VN')}</td>
        </tr>`,
    )
    .join('')
}

function buildOrderPrintHtml(payload: OrderPrintPayload, type: 'a4' | 'k80' | 'pdf') {
  const isK80 = type === 'k80'
  const pageWidth = isK80 ? '80mm' : '210mm'
  const orderCode = payload.order?.orderNumber ?? payload.order?.id ?? '—'
  const createdAt = payload.order?.createdAt ? dayjs(payload.order.createdAt).format('DD/MM/YYYY HH:mm') : '—'
  const orderStatus = getOrderStatusMeta(payload.orderStatus)
  const paymentStatus = getPaymentStatusMeta(payload.paymentStatus)
  const rowsHtml = buildRowsHtml(payload)

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>Hoa don ${orderCode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: ${isK80 ? '10px' : '12px'}; color: #111; width: ${pageWidth}; margin: 0 auto; padding: ${isK80 ? '8px' : '20px'}; }
    h1 { font-size: ${isK80 ? '13px' : '18px'}; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: ${isK80 ? '9px' : '11px'}; color: #666; margin-bottom: ${isK80 ? '8px' : '16px'}; }
    .meta span { margin-right: 12px; }
    .status { display: flex; gap: 8px; margin-bottom: ${isK80 ? '8px' : '12px'}; }
    .status span { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #f5f5f5; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: ${isK80 ? '8px' : '16px'}; font-size: ${isK80 ? '9px' : '11px'}; }
    .info-block label { display: block; color: #888; margin-bottom: 2px; }
    .info-block span { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: ${isK80 ? '8px' : '16px'}; }
    thead th { background: #f5f5f5; padding: 5px 6px; text-align: left; font-size: ${isK80 ? '9px' : '11px'}; border-bottom: 2px solid #ddd; }
    thead th:nth-child(n+3) { text-align: right; }
    .totals { margin-left: auto; width: ${isK80 ? '100%' : '260px'}; font-size: ${isK80 ? '10px' : '12px'}; }
    .totals tr td { padding: 3px 6px; }
    .totals tr td:last-child { text-align: right; }
    .totals .grand td { font-size: ${isK80 ? '12px' : '15px'}; font-weight: 700; padding-top: 8px; border-top: 2px solid #111; }
    .footer { margin-top: ${isK80 ? '10px' : '24px'}; font-size: ${isK80 ? '9px' : '11px'}; color: #999; border-top: 1px dashed #ddd; padding-top: 8px; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>HOA DON DON HANG</h1>
  <div class="meta">
    <span>Mã: <strong>${orderCode}</strong></span>
    <span>Ngày: ${createdAt}</span>
    <span>Chi nhánh: ${payload.branchName}</span>
  </div>
  <div class="status">
    <span>Đơn: ${orderStatus.label}</span>
    <span>Thanh toán: ${paymentStatus.label}</span>
  </div>
  <div class="info-grid">
    <div class="info-block">
      <label>Khách hàng</label>
      <span>${payload.customerName || 'Khach le'}</span>
    </div>
    <div class="info-block">
      <label>Điện thoại</label>
      <span>${payload.customerPhone || '—'}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Sản phẩm / dịch vụ</th>
        <th>ĐVT</th>
        <th>SL</th>
        <th>Đơn giá</th>
        <th>Thành tiền</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <table class="totals">
    <tr><td>Tạm tính</td><td>${payload.subtotal.toLocaleString('vi-VN')} đ</td></tr>
    ${payload.discount > 0 ? `<tr><td>Chiết khấu</td><td>-${payload.discount.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    ${payload.shippingFee > 0 ? `<tr><td>Phí ship</td><td>+${payload.shippingFee.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    <tr class="grand"><td>Tổng thanh toán</td><td>${payload.total.toLocaleString('vi-VN')} đ</td></tr>
    <tr><td>Đã thu</td><td>${payload.amountPaid.toLocaleString('vi-VN')} đ</td></tr>
    <tr><td>Còn lại</td><td>${payload.remainingAmount.toLocaleString('vi-VN')} đ</td></tr>
  </table>
  ${payload.notes ? `<div style="margin-top:8px;font-size:${isK80 ? '9px' : '11px'};color:#555;">Ghi chú: ${payload.notes}</div>` : ''}
  <div class="footer">In lúc ${dayjs().format('DD/MM/YYYY HH:mm')} • Phần mềm Petshop</div>
</body>
</html>`
}

function openPrintWindow(payload: OrderPrintPayload, type: 'a4' | 'k80' | 'pdf') {
  const printWindow = window.open('', '_blank', 'width=900,height=720')

  if (!printWindow) {
    toast.error('Trinh duyet chan popup. Vui long cho phep popup de in hoa don.')
    return
  }

  printWindow.document.write(buildOrderPrintHtml(payload, type))
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

export function printOrderA4(payload: OrderPrintPayload) {
  openPrintWindow(payload, 'a4')
}

export function printOrderK80(payload: OrderPrintPayload) {
  openPrintWindow(payload, 'k80')
}

export function printOrderPdf(payload: OrderPrintPayload) {
  openPrintWindow(payload, 'pdf')
}
