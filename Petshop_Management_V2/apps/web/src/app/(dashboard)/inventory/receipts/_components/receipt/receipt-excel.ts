import dayjs from 'dayjs'
import { exportAoaToExcel, importExcelToAoa } from '@/lib/excel'

export async function downloadReceiptTemplate() {
  const headerRows = [
    ['PHIẾU NHẬP HÀNG - MẪU NHẬP LIỆU'],
    ['* Lưu ý: Không thay đổi tên cột. Điền chính xác Mã SP (SKU).'],
    []
  ]
  const colHeaders = [
    'Mã SP (SKU)',
    'Số lượng',
    'Đơn giá nhập',
    'Giảm giá',
  ]
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

export async function parseReceiptExcel(file: File): Promise<ParsedExcelRow[]> {
  const aoa = await importExcelToAoa(file)
  const results: ParsedExcelRow[] = []
  
  // Find the header row index (where 'Mã SP (SKU)' is located)
  let headerRowIdx = -1
  let skuColIdx = -1
  let qtyColIdx = -1
  let costColIdx = -1
  let discountColIdx = -1

  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = aoa[i]
    if (!row) continue
    const rowStrings = row.map(cell => String(cell ?? '').trim().toLowerCase())
    
    skuColIdx = rowStrings.findIndex(s => s.includes('sku') || s.includes('mã sp') || s.includes('mã sản phẩm'))
    if (skuColIdx !== -1) {
      headerRowIdx = i
      qtyColIdx = rowStrings.findIndex(s => s.includes('số lượng') || s.includes('quantity') || s === 'sl')
      costColIdx = rowStrings.findIndex(s => s.includes('đơn giá') || s.includes('giá nhập') || s.includes('cost'))
      discountColIdx = rowStrings.findIndex(s => s.includes('giảm giá') || s.includes('chiết khấu') || s.includes('discount'))
      break
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Không tìm thấy dòng tiêu đề chứa "Mã SP (SKU)". Vui lòng sử dụng file mẫu.')
  }

  // Parse data rows
  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || !row[skuColIdx]) continue // Skip empty rows or empty SKUs

    const sku = String(row[skuColIdx]).trim()
    if (!sku) continue

    const parseNum = (val: any) => {
      if (typeof val === 'number') return val
      if (!val) return 0
      const parsed = Number(String(val).replace(/,/g, ''))
      return isNaN(parsed) ? 0 : parsed
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
}: ExportReceiptParams) {
  const formattedDate = createdAt ? dayjs(createdAt).format('DD/MM/YYYY HH:mm') : ''

  const headerRows: Array<Array<string | number | null>> = [
    ['PHIẾU NHẬP HÀNG'],
    ['Mã phiếu:', receiptCode, '', 'Nhà cung cấp:', supplierName],
    ['Ngày tạo:', formattedDate, '', 'Chi nhánh:', branchName],
    ['Trạng thái:', statusLabel],
    [],
  ]

  const colHeaders = [
    '#',
    'Mã SP (SKU)',
    'Tên sản phẩm',
    'Phiên bản',
    'Đơn vị',
    'Số lượng',
    'Đơn giá nhập',
    'Giảm giá',
    'Thành tiền',
  ]

  const itemRows: Array<Array<string | number | null>> = items.map((item, idx) => [
    idx + 1,
    item.sku ?? '',
    item.name,
    item.variantLabel ?? item.variantName ?? '',
    item.unitLabel ?? item.baseUnit ?? item.unit ?? '',
    item.quantity,
    item.unitCost,
    item.discount,
    item.quantity * item.unitCost,
  ])

  const summaryRows: Array<Array<string | number | null>> = [
    [],
    ['', '', '', '', '', '', '', 'Tổng hàng hóa', merchandiseTotal],
    ...(receiptDiscount > 0 ? [['', '', '', '', '', '', '', 'Giảm giá', -discountAmount]] : []),
    ...(receiptTax > 0 ? [['', '', '', '', '', '', '', 'Thuế', taxAmount]] : []),
    ['', '', '', '', '', '', '', 'Cần trả NCC', grandTotal],
    ...(currentDebt > 0 ? [['', '', '', '', '', '', '', 'Còn nợ', currentDebt]] : []),
  ]

  const wsData = [...headerRows, colHeaders, ...itemRows, ...summaryRows]
  const fileName = `phieu-nhap-${receiptCode}-${dayjs().format('YYYYMMDD')}.xlsx`
  
  await exportAoaToExcel(wsData, 'Phiếu nhập', fileName, [8, 14, 36, 16, 10, 10, 16, 14, 16])
  
  return fileName
}
