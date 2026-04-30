'use client'

import { toast } from 'sonner'
import dayjs from 'dayjs'
import type { GroomingSession } from '@/lib/api/grooming.api'
import type { PrintTemplate } from '@/lib/api/settings.api'

const STATUS_LABELS: Record<string, string> = {
  BOOKED: 'Da dat lich',
  PENDING: 'Cho xu ly',
  IN_PROGRESS: 'Dang thuc hien',
  COMPLETED: 'Hoan thanh',
  CANCELLED: 'Da huy',
}

const STATUS_COLORS: Record<string, string> = {
  BOOKED: '#7c3aed',
  PENDING: '#d97706',
  IN_PROGRESS: '#2563eb',
  COMPLETED: '#059669',
  CANCELLED: '#dc2626',
}

type PaperSize = 'k80' | 'a4' | 'a5'

export interface GroomingPrintData {
  session: GroomingSession
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

function formatWeight(value: unknown): string {
  const weight = Number(value)
  return Number.isFinite(weight) && weight > 0 ? `${weight.toLocaleString('vi-VN')} kg` : '-'
}

function getStaffNames(session: GroomingSession) {
  return (
    (session.assignedStaff?.length ? session.assignedStaff : session.staff ? [session.staff] : [])
      .map((staff) => staff.fullName)
      .filter(Boolean)
      .join(', ') || '-'
  )
}

function getExtraServices(session: GroomingSession, snapshot: Record<string, any>) {
  return Array.isArray(session.extraServices)
    ? session.extraServices
    : Array.isArray(snapshot.extraServices)
      ? snapshot.extraServices
      : []
}

function buildServicesHtml(session: GroomingSession, snapshot: Record<string, any>) {
  const mainPrice = toSafeNumber(snapshot.mainService?.price, toSafeNumber(snapshot.mainPrice, session.price ?? 0))
  const mainQuantity = Math.max(1, toSafeNumber(snapshot.mainService?.quantity, 1))
  const mainDiscount = toSafeNumber(snapshot.mainService?.discountItem)
  const mainTotal = toSafeNumber(snapshot.mainService?.total, mainPrice * mainQuantity - mainDiscount)
  const mainName =
    snapshot.mainService?.name ??
    snapshot.mainService?.packageCode ??
    snapshot.packageCode ??
    session.packageCode ??
    'Dich vu Grooming'

  const mainRow = `
    <tr>
      <td style="padding:4px 0;vertical-align:top">
        <div>${escapeHtml(mainName)}</div>
        ${mainQuantity > 1 ? `<div style="font-size:11px;color:#555">x ${mainQuantity}</div>` : ''}
      </td>
      <td style="padding:4px 0;text-align:right;vertical-align:top">${escapeHtml(vnd(mainTotal))}</td>
    </tr>`

  const extraRows = getExtraServices(session, snapshot)
    .map((service: any) => {
      const quantity = Math.max(1, toSafeNumber(service.quantity, 1))
      const unitPrice = toSafeNumber(service.price)
      const lineTotal = toSafeNumber(service.total, unitPrice * quantity - toSafeNumber(service.discountItem))
      return `
    <tr>
      <td style="padding:4px 0;vertical-align:top">
        <div>${escapeHtml(service.name || 'Dich vu phu')}</div>
        <div style="font-size:11px;color:#555">x ${quantity}</div>
      </td>
      <td style="padding:4px 0;text-align:right;vertical-align:top">${escapeHtml(vnd(lineTotal))}</td>
    </tr>`
    })
    .join('')

  return `${mainRow}${extraRows}`
}

function buildExtraItemsHtml(session: GroomingSession, snapshot: Record<string, any>) {
  return getExtraServices(session, snapshot)
    .map((service: any) => {
      const quantity = Math.max(1, toSafeNumber(service.quantity, 1))
      const unitPrice = toSafeNumber(service.price)
      const lineTotal = toSafeNumber(service.total, unitPrice * quantity - toSafeNumber(service.discountItem))
      return `<tr><td>${escapeHtml(service.name || 'Dich vu phu')}</td><td style="text-align:center">${quantity}</td><td style="text-align:right">${escapeHtml(vnd(unitPrice))}</td><td style="text-align:right">${escapeHtml(vnd(lineTotal))}</td></tr>`
    })
    .join('')
}

function applyTemplateVars(template: string, data: GroomingPrintData): string {
  const session = data.session
  const snapshot = (session.pricingSnapshot ?? {}) as Record<string, any>
  const mainPrice = toSafeNumber(snapshot.mainService?.price, toSafeNumber(snapshot.mainPrice, session.price ?? 0))
  const extraServices = getExtraServices(session, snapshot)
  const extraTotal = toSafeNumber(
    snapshot.extraTotal,
    extraServices.reduce(
      (sum: number, service: any) =>
        sum +
        toSafeNumber(service.total, toSafeNumber(service.price) * Math.max(1, toSafeNumber(service.quantity, 1))),
      0,
    ),
  )
  const surcharge = toSafeNumber(session.surcharge)
  const discount = toSafeNumber(snapshot.discountAmount)
  const totalAmount = toSafeNumber(snapshot.grossAmount, mainPrice + extraTotal)
  const finalAmount = toSafeNumber(
    snapshot.finalAmount,
    toSafeNumber(snapshot.totalPrice, toSafeNumber(snapshot.totalAmount, totalAmount + surcharge - discount)),
  )
  const receiptCode = session.sessionCode ?? session.id.slice(0, 8).toUpperCase()
  const petWeight = session.weightAtBooking ?? (session.pet as any)?.weight

  const textReplacements: Record<string, string> = {
    '{{shopName}}': data.shopName ?? '',
    '{{shopAddress}}': data.shopAddress ?? '',
    '{{shopPhone}}': data.shopPhone ?? '',
    '{{branchName}}': data.branchName ?? session.branch?.name ?? '',
    '{{sessionCode}}': receiptCode,
    '{{receiptCode}}': receiptCode,
    '{{createdAt}}': dt(session.createdAt),
    '{{serviceDate}}': dt(session.startTime ?? session.createdAt),
    '{{startTime}}': dt(session.startTime),
    '{{endTime}}': dt(session.endTime),
    '{{status}}': STATUS_LABELS[session.status] ?? session.status,
    '{{statusColor}}': STATUS_COLORS[session.status] ?? '#555',
    '{{petName}}': session.petName ?? '-',
    '{{petCode}}': session.pet?.petCode ?? '-',
    '{{petSpecies}}': session.pet?.species ?? '-',
    '{{petBreed}}': session.pet?.breed ?? session.pet?.species ?? '-',
    '{{petWeight}}': formatWeight(petWeight),
    '{{customerName}}': session.pet?.customer?.fullName ?? 'Khach le',
    '{{customerPhone}}': session.pet?.customer?.phone ?? '-',
    '{{staffNames}}': getStaffNames(session),
    '{{packageCode}}': session.packageCode ?? snapshot.packageCode ?? '-',
    '{{notes}}': session.notes ?? '',
    '{{mainPrice}}': vnd(mainPrice),
    '{{extraTotal}}': vnd(extraTotal),
    '{{discount}}': vnd(discount),
    '{{discountAmount}}': vnd(discount),
    '{{surcharge}}': vnd(surcharge),
    '{{surchargeAmount}}': vnd(surcharge),
    '{{totalPrice}}': vnd(finalAmount),
    '{{totalAmount}}': vnd(totalAmount),
    '{{finalAmount}}': vnd(finalAmount),
    '{{orderNumber}}': session.order?.orderNumber ?? '-',
    '{{printTime}}': dayjs().format('DD/MM/YYYY HH:mm'),
  }

  const htmlReplacements: Record<string, string> = {
    '{{services_html}}': buildServicesHtml(session, snapshot),
    '{{items_html}}': buildServicesHtml(session, snapshot),
    '{{extra_items_html}}': buildExtraItemsHtml(session, snapshot),
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
    .text-justify { text-align: justify; }
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

function buildFallbackHtml(data: GroomingPrintData, paperSize: PaperSize): string {
  const session = data.session
  const snapshot = (session.pricingSnapshot ?? {}) as Record<string, any>
  const content = `<div class="p-4 text-sm font-mono max-w-[80mm] mx-auto text-black">
  <div class="text-center font-bold text-xl mb-1">${escapeHtml(data.shopName || 'PHIEU DICH VU SPA')}</div>
  ${data.shopAddress ? `<div class="text-center mb-1">${escapeHtml(data.shopAddress)}</div>` : ''}
  ${data.shopPhone ? `<div class="text-center mb-3 border-b border-dashed border-gray-400 pb-2">DT: ${escapeHtml(data.shopPhone)}</div>` : ''}
  <div class="text-center font-bold text-lg mb-2">PHIEU DICH VU SPA</div>
  <div class="mb-1"><strong>Ma phieu:</strong> ${escapeHtml(session.sessionCode ?? session.id.slice(0, 8).toUpperCase())}</div>
  <div class="mb-1"><strong>Khach hang:</strong> ${escapeHtml(session.pet?.customer?.fullName ?? 'Khach le')}</div>
  <div class="mb-2"><strong>Thu cung:</strong> ${escapeHtml(session.petName)} (${escapeHtml(session.pet?.breed ?? session.pet?.species ?? '-')})</div>
  <table class="w-full mb-3 text-sm">
    <thead><tr class="border-b border-dashed border-gray-400"><th class="text-left py-1">Dich vu</th><th class="text-right py-1 w-20">TTien</th></tr></thead>
    <tbody>${buildServicesHtml(session, snapshot)}</tbody>
  </table>
  <div class="border-t border-dashed border-gray-400 mt-2 pt-2 mb-4 flex justify-between font-bold text-lg">
    <span>Thanh toan:</span>
    <span>${escapeHtml(vnd(toSafeNumber(snapshot.totalPrice, toSafeNumber(snapshot.totalAmount, session.price ?? 0))))}</span>
  </div>
</div>`

  return wrapPrintHtml(content, paperSize, `Phieu grooming ${session.sessionCode ?? session.id}`)
}

export function printGroomingSession(
  data: GroomingPrintData,
  template?: PrintTemplate | null,
) {
  const paperSize = (template?.paperSize ?? 'k80') as PaperSize
  const title = `Phieu grooming ${data.session.sessionCode ?? data.session.id}`
  const html = template?.content
    ? wrapPrintHtml(applyTemplateVars(template.content, data), paperSize, title)
    : buildFallbackHtml(data, paperSize)

  const printWindow = window.open('', '_blank', 'width=900,height=720')
  if (!printWindow) {
    toast.error('Tr?nh duy?t ch?n popup. Vui l?ng cho ph?p popup ?? in phi?u.')
    return
  }

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}
