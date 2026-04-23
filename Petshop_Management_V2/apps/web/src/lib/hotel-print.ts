'use client'

import dayjs from 'dayjs'
import type { HotelStay } from '@/lib/api/hotel.api'
import type { PrintTemplate } from '@/lib/api/settings.api'

type PaperSize = 'k80' | 'a4' | 'a5'

interface HotelChargeLine {
  id?: string
  label?: string
  quantityDays?: number
  unitPrice?: number
  subtotal?: number
}

interface HotelBreakdownSnapshot {
  chargeLines?: HotelChargeLine[]
  totalDays?: number
}

export interface HotelPrintData {
  stay: HotelStay
  shopName?: string
  shopAddress?: string
  shopPhone?: string
  branchName?: string
}

function toSafeNumber(value: unknown, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function vnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '-'
  return `${Number(amount).toLocaleString('vi-VN')} đ`
}

function dt(iso: string | null | undefined): string {
  if (!iso) return '-'
  return dayjs(iso).format('DD/MM/YYYY HH:mm')
}

function getChargeLines(stay: HotelStay): HotelChargeLine[] {
  if (Array.isArray(stay.chargeLines) && stay.chargeLines.length > 0) {
    return stay.chargeLines
  }

  const snapshot = stay.breakdownSnapshot as HotelBreakdownSnapshot | null | undefined
  return Array.isArray(snapshot?.chargeLines) ? snapshot.chargeLines : []
}

function getTotalDays(stay: HotelStay, chargeLines: HotelChargeLine[]) {
  const snapshot = stay.breakdownSnapshot as HotelBreakdownSnapshot | null | undefined
  if (typeof snapshot?.totalDays === 'number') return snapshot.totalDays

  const chargedDays = chargeLines.reduce((sum, line) => sum + toSafeNumber(line.quantityDays), 0)
  if (chargedDays > 0) return chargedDays

  const checkIn = dayjs(stay.checkIn)
  const checkOut = dayjs(stay.checkOutActual ?? stay.checkOut ?? stay.estimatedCheckOut)
  if (checkIn.isValid() && checkOut.isValid()) {
    return Math.max(1, Math.ceil(checkOut.diff(checkIn, 'hour') / 24))
  }

  return 0
}

function getLineSubtotal(line: HotelChargeLine) {
  return toSafeNumber(line.subtotal, toSafeNumber(line.unitPrice) * toSafeNumber(line.quantityDays))
}

function buildRoomsHtml(stay: HotelStay, chargeLines: HotelChargeLine[]) {
  const rows =
    chargeLines.length > 0
      ? chargeLines
      : [
          {
            label: stay.cage?.name ?? stay.weightBand?.label ?? 'Hotel',
            quantityDays: getTotalDays(stay, chargeLines) || 1,
            unitPrice: stay.dailyRate,
            subtotal: stay.price ?? stay.totalPrice ?? stay.dailyRate,
          },
        ]

  return rows
    .map((line) => {
      const quantityDays = toSafeNumber(line.quantityDays)
      const unitPrice = toSafeNumber(line.unitPrice)
      return `
    <tr>
      <td style="padding:4px 0;vertical-align:top">
        <div>${escapeHtml(line.label || 'Hotel')}</div>
        <div style="font-size:11px;color:#555">${quantityDays.toLocaleString('vi-VN')} ngay x ${escapeHtml(vnd(unitPrice))}</div>
      </td>
      <td style="padding:4px 0;text-align:right;vertical-align:top">${escapeHtml(vnd(getLineSubtotal(line)))}</td>
    </tr>`
    })
    .join('')
}

function applyTemplateVars(template: string, data: HotelPrintData): string {
  const stay = data.stay
  const chargeLines = getChargeLines(stay)
  const subtotal = chargeLines.reduce((sum, line) => sum + getLineSubtotal(line), 0)
  const totalAmount = subtotal || toSafeNumber(stay.price, toSafeNumber(stay.totalPrice))
  const surcharge = toSafeNumber(stay.surcharge)
  const promotion = toSafeNumber(stay.promotion)
  const deposit = toSafeNumber(stay.depositAmount)
  const finalAmount = toSafeNumber(stay.totalPrice, totalAmount + surcharge - promotion)
  const receiptCode = stay.stayCode ?? stay.id.slice(0, 8).toUpperCase()
  const checkoutDate = stay.checkOutActual ?? stay.checkOut ?? stay.estimatedCheckOut
  const totalDays = getTotalDays(stay, chargeLines)

  const textReplacements: Record<string, string> = {
    '{{shopName}}': data.shopName ?? '',
    '{{shopAddress}}': data.shopAddress ?? '',
    '{{shopPhone}}': data.shopPhone ?? '',
    '{{branchName}}': data.branchName ?? stay.branch?.name ?? '',
    '{{receiptCode}}': receiptCode,
    '{{stayCode}}': receiptCode,
    '{{customerName}}': stay.customer?.fullName ?? stay.pet?.customer?.fullName ?? 'Khach le',
    '{{customerPhone}}': stay.customer?.phone ?? stay.pet?.customer?.phone ?? '-',
    '{{petName}}': stay.petName || stay.pet?.name || '-',
    '{{petCode}}': stay.pet?.petCode ?? stay.petId ?? '-',
    '{{petBreed}}': stay.pet?.breed ?? stay.pet?.species ?? '-',
    '{{petSpecies}}': stay.pet?.species ?? '-',
    '{{cageName}}': stay.cage?.name ?? '-',
    '{{lineType}}': stay.lineType === 'HOLIDAY' ? 'Ngay le' : 'Ngay thuong',
    '{{checkInDate}}': dt(stay.checkIn),
    '{{checkOutDate}}': dt(checkoutDate),
    '{{totalDuration}}': totalDays > 0 ? `${totalDays.toLocaleString('vi-VN')} ngay` : '-',
    '{{totalDays}}': totalDays > 0 ? totalDays.toLocaleString('vi-VN') : '-',
    '{{totalAmount}}': vnd(totalAmount),
    '{{surchargeAmount}}': vnd(surcharge),
    '{{promotionAmount}}': vnd(promotion),
    '{{discountAmount}}': vnd(promotion),
    '{{depositAmount}}': vnd(deposit),
    '{{finalAmount}}': vnd(finalAmount),
    '{{paymentStatus}}': stay.paymentStatus ?? '-',
    '{{notes}}': stay.notes ?? '',
    '{{printTime}}': dayjs().format('DD/MM/YYYY HH:mm'),
  }

  const htmlReplacements: Record<string, string> = {
    '{{rooms_html}}': buildRoomsHtml(stay, chargeLines),
    '{{items_html}}': buildRoomsHtml(stay, chargeLines),
  }

  let result = template
  for (const [key, value] of Object.entries(textReplacements)) {
    result = result.replaceAll(key, escapeHtml(value))
  }
  for (const [key, value] of Object.entries(htmlReplacements)) {
    result = result.replaceAll(key, value)
  }
  return result
}

function wrapPrintHtml(content: string, paperSize: PaperSize, title: string) {
  const trimmed = content.trim()
  if (/^<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return content
  }

  const pageSize = paperSize === 'k80' ? '80mm auto' : paperSize.toUpperCase()
  const pageWidth = paperSize === 'k80' ? '80mm' : paperSize === 'a5' ? '148mm' : '210mm'
  const margin = paperSize === 'k80' ? '2mm 3mm' : '15mm 18mm'

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: ${pageSize}; margin: ${margin}; }
    * { box-sizing: border-box; }
    body { margin: 0 auto; width: ${pageWidth}; color: #000; font-family: Arial, "Helvetica Neue", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { width: 100%; border-collapse: collapse; }
    .p-4 { padding: 16px; }
    .text-sm { font-size: 14px; }
    .text-xs { font-size: 12px; }
    .text-lg { font-size: 18px; }
    .text-xl { font-size: 20px; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
    .font-bold { font-weight: 700; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .text-black { color: #000; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .mb-1 { margin-bottom: 4px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-3 { margin-bottom: 12px; }
    .mb-4 { margin-bottom: 16px; }
    .mt-2 { margin-top: 8px; }
    .pt-2 { padding-top: 8px; }
    .pb-2 { padding-bottom: 8px; }
    .py-1 { padding-top: 4px; padding-bottom: 4px; }
    .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .w-full { width: 100%; }
    .w-20 { width: 80px; }
    .max-w-\\[80mm\\] { max-width: 80mm; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .border-t { border-top: 1px solid #9ca3af; }
    .border-b { border-bottom: 1px solid #9ca3af; }
    .border-dashed { border-style: dashed; }
    .border-gray-400 { border-color: #9ca3af; }
  </style>
</head>
<body>${content}</body>
</html>`
}

function buildFallbackHtml(data: HotelPrintData, paperSize: PaperSize) {
  const stay = data.stay
  const chargeLines = getChargeLines(stay)
  const subtotal = chargeLines.reduce((sum, line) => sum + getLineSubtotal(line), 0)
  const totalAmount = subtotal || toSafeNumber(stay.price, toSafeNumber(stay.totalPrice))
  const finalAmount = toSafeNumber(stay.totalPrice, totalAmount + toSafeNumber(stay.surcharge) - toSafeNumber(stay.promotion))
  const content = `<div class="p-4 text-sm font-mono max-w-[80mm] mx-auto text-black">
  <div class="text-center font-bold text-xl mb-1">${escapeHtml(data.shopName || 'PHIEU HOTEL')}</div>
  ${data.shopAddress ? `<div class="text-center mb-1">${escapeHtml(data.shopAddress)}</div>` : ''}
  ${data.shopPhone ? `<div class="text-center mb-3 border-b border-dashed border-gray-400 pb-2">DT: ${escapeHtml(data.shopPhone)}</div>` : ''}
  <div class="text-center font-bold text-lg mb-2">PHIEU LUU CHUONG (HOTEL)</div>
  <div class="mb-1"><strong>Ma phieu:</strong> ${escapeHtml(stay.stayCode ?? stay.id.slice(0, 8).toUpperCase())}</div>
  <div class="mb-1"><strong>Khach hang:</strong> ${escapeHtml(stay.customer?.fullName ?? stay.pet?.customer?.fullName ?? 'Khach le')}</div>
  <div class="mb-2"><strong>Thu cung:</strong> ${escapeHtml(stay.petName || stay.pet?.name || '-')} (${escapeHtml(stay.pet?.breed ?? stay.pet?.species ?? '-')})</div>
  <div class="border-t border-b border-dashed border-gray-400 py-2 mb-3">
    <div class="flex justify-between mb-1"><span>Check-in:</span><span>${escapeHtml(dt(stay.checkIn))}</span></div>
    <div class="flex justify-between mb-1"><span>Check-out:</span><span>${escapeHtml(dt(stay.checkOutActual ?? stay.checkOut ?? stay.estimatedCheckOut))}</span></div>
    <div class="flex justify-between font-bold"><span>So ngay/dem:</span><span>${escapeHtml(String(getTotalDays(stay, chargeLines) || '-'))}</span></div>
  </div>
  <table class="w-full mb-3 text-sm">
    <thead><tr class="border-b border-dashed border-gray-400"><th class="text-left py-1">Hang phong</th><th class="text-right py-1 w-20">TTien</th></tr></thead>
    <tbody>${buildRoomsHtml(stay, chargeLines)}</tbody>
  </table>
  <div class="border-t border-dashed border-gray-400 mt-2 pt-2 mb-4 flex justify-between font-bold text-lg">
    <span>Tong phai thu:</span>
    <span>${escapeHtml(vnd(finalAmount))}</span>
  </div>
</div>`

  return wrapPrintHtml(content, paperSize, `Phieu hotel ${stay.stayCode ?? stay.id}`)
}

export function printHotelStay(data: HotelPrintData, template?: PrintTemplate | null) {
  const paperSize = (template?.paperSize ?? 'k80') as PaperSize
  const title = `Phieu hotel ${data.stay.stayCode ?? data.stay.id}`
  const html = template?.content
    ? wrapPrintHtml(applyTemplateVars(template.content, data), paperSize, title)
    : buildFallbackHtml(data, paperSize)

  const printWindow = window.open('', '_blank', 'width=900,height=720')
  if (!printWindow) {
    alert('Trinh duyet chan popup. Vui long cho phep popup de in phieu.')
    return
  }

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}
