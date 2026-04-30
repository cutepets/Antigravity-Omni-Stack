import dayjs from 'dayjs'
import { exportAoaToExcel, importExcelToAoa } from '@/lib/excel'

export async function downloadReceiptTemplate() {
  const headerRows = [
    ['PHIEU NHAP HANG - MAU NHAP LIEU'],
    ['* Luu y: Khong thay doi ten cot. Dien chinh xac Ma SP (SKU).'],
    [],
  ]
  const colHeaders = ['Ma SP (SKU)', 'So luong', 'Don gia nhap', 'Giam gia']
  const sampleRows = [
    ['SP001', 10, 50000, 0],
    ['SP002', 5, 120000, 10000],
  ]

  const wsData = [...headerRows, colHeaders, ...sampleRows]
  await exportAoaToExcel(wsData, 'MauNhap', 'mau-nhap-hang.xlsx', [20, 15, 15, 15])
}

export interface ParsedExcelRow {
  sku: string
  quantity: number
  unitCost: number
  discount: number
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .toLowerCase()
}

export async function parseReceiptExcel(file: File): Promise<ParsedExcelRow[]> {
  const aoa = await importExcelToAoa(file)
  const results: ParsedExcelRow[] = []

  let headerRowIdx = -1
  let skuColIdx = -1
  let qtyColIdx = -1
  let costColIdx = -1
  let discountColIdx = -1

  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = aoa[i]
    if (!row) continue
    const rowStrings = row.map((cell) => normalizeHeader(cell))

    skuColIdx = rowStrings.findIndex((value) => value.includes('sku') || value.includes('ma sp') || value.includes('ma san pham'))
    if (skuColIdx !== -1) {
      headerRowIdx = i
      qtyColIdx = rowStrings.findIndex((value) => value.includes('so luong') || value.includes('quantity') || value === 'sl')
      costColIdx = rowStrings.findIndex((value) => value.includes('don gia') || value.includes('gia nhap') || value.includes('cost'))
      discountColIdx = rowStrings.findIndex((value) => value.includes('giam gia') || value.includes('chiet khau') || value.includes('discount'))
      break
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Khong tim thay dong tieu de chua "Ma SP (SKU)". Vui long su dung file mau.')
  }

  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || !row[skuColIdx]) continue

    const sku = String(row[skuColIdx]).trim()
    if (!sku) continue

    const parseNum = (value: unknown) => {
      if (typeof value === 'number') return value
      if (!value) return 0
      const parsed = Number(String(value).replace(/,/g, ''))
      return Number.isNaN(parsed) ? 0 : parsed
    }

    const quantity = qtyColIdx !== -1 ? parseNum(row[qtyColIdx]) || 1 : 1
    const unitCost = costColIdx !== -1 ? parseNum(row[costColIdx]) : 0
    const discount = discountColIdx !== -1 ? parseNum(row[discountColIdx]) : 0

    results.push({ sku, quantity, unitCost, discount })
  }

  return results
}

export interface ExportReceiptParams {
  receiptCode: string
  supplierName: string
  createdAt: string | Date | undefined | null
  branchName: string
  statusLabel: string
  items: Array<{
    sku?: string | null
    name: string
    variantName?: string | null
    variantLabel?: string | null
    unit?: string | null
    unitLabel?: string | null
    baseUnit?: string | null
    quantity: number
    unitCost: number
    discount: number
  }>
  merchandiseTotal: number
  receiptDiscount: number
  discountAmount: number
  receiptTax: number
  taxAmount: number
  grandTotal: number
  currentDebt: number
  includeCosts?: boolean
}

export async function exportReceiptToExcel({
  receiptCode,
  supplierName,
  createdAt,
  branchName,
  statusLabel,
  items,
  merchandiseTotal,
  receiptDiscount,
  discountAmount,
  receiptTax,
  taxAmount,
  grandTotal,
  currentDebt,
  includeCosts = true,
}: ExportReceiptParams) {
  const formattedDate = createdAt ? dayjs(createdAt).format('DD/MM/YYYY HH:mm') : ''

  const headerRows: Array<Array<string | number | null>> = [
    ['PHIEU NHAP HANG'],
    ['Ma phieu:', receiptCode, '', 'Nha cung cap:', supplierName],
    ['Ngay tao:', formattedDate, '', 'Chi nhanh:', branchName],
    ['Trang thai:', statusLabel],
    [],
  ]

  const baseHeaders = ['#', 'Ma SP (SKU)', 'Ten san pham', 'Phien ban', 'Don vi', 'So luong']
  const colHeaders = includeCosts
    ? [...baseHeaders, 'Don gia nhap', 'Giam gia', 'Thanh tien']
    : baseHeaders

  const itemRows: Array<Array<string | number | null>> = items.map((item, idx) => {
    const baseRow: Array<string | number | null> = [
      idx + 1,
      item.sku ?? '',
      item.name,
      item.variantLabel ?? item.variantName ?? '',
      item.unitLabel ?? item.baseUnit ?? item.unit ?? '',
      item.quantity,
    ]

    if (!includeCosts) return baseRow
    return [...baseRow, item.unitCost, item.discount, item.quantity * item.unitCost]
  })

  const summaryRows: Array<Array<string | number | null>> = includeCosts
    ? [
        [],
        ['', '', '', '', '', '', '', 'Tong hang hoa', merchandiseTotal],
        ...(receiptDiscount > 0 ? [['', '', '', '', '', '', '', 'Giam gia', -discountAmount]] : []),
        ...(receiptTax > 0 ? [['', '', '', '', '', '', '', 'Thue', taxAmount]] : []),
        ['', '', '', '', '', '', '', 'Can tra NCC', grandTotal],
        ...(currentDebt > 0 ? [['', '', '', '', '', '', '', 'Con no', currentDebt]] : []),
      ]
    : []

  const wsData = [...headerRows, colHeaders, ...itemRows, ...summaryRows]
  const fileName = `phieu-nhap-${receiptCode}-${dayjs().format('YYYYMMDD')}.xlsx`

  await exportAoaToExcel(
    wsData,
    'Phieu nhap',
    fileName,
    includeCosts ? [8, 14, 36, 16, 10, 10, 16, 14, 16] : [8, 14, 36, 16, 10, 10],
  )

  return fileName
}
