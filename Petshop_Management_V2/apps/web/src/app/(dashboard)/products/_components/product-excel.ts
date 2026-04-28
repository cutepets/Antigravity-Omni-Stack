'use client'

import ExcelJS from 'exceljs'
import { importExcelToAoa } from '@/lib/excel'
import type { ProductExcelRow } from '@/lib/api/inventory.api'

type BaseProductExcelColumnKey = Exclude<keyof ProductExcelRow, 'price' | 'priceBookValues'>

type ProductExcelColumn = {
  key: BaseProductExcelColumnKey
  header: string
  width: number
}

export type ParsedProductExcelFile = {
  rows: ProductExcelRow[]
  includedColumns: string[]
  priceBookHeaders: string[]
}

const BASE_PRODUCT_EXCEL_COLUMNS: ProductExcelColumn[] = [
  { key: 'groupCode', header: 'Mã nhóm SP*', width: 18 },
  { key: 'rowType', header: 'Loại dòng*', width: 16 },
  { key: 'sku', header: 'SKU*', width: 20 },
  { key: 'sourceSku', header: 'SKU nguồn quy đổi', width: 20 },
  { key: 'productName', header: 'Tên sản phẩm', width: 28 },
  { key: 'attributeName1', header: 'Tên phân loại 1', width: 18 },
  { key: 'attributeValue1', header: 'Giá trị phân loại 1', width: 18 },
  { key: 'attributeName2', header: 'Tên phân loại 2', width: 18 },
  { key: 'attributeValue2', header: 'Giá trị phân loại 2', width: 18 },
  { key: 'attributeName3', header: 'Tên phân loại 3', width: 18 },
  { key: 'attributeValue3', header: 'Giá trị phân loại 3', width: 18 },
  { key: 'rowUnit', header: 'Đơn vị dòng', width: 14 },
  { key: 'conversionRate', header: 'Tỷ lệ quy đổi', width: 14 },
  { key: 'barcode', header: 'Mã vạch', width: 18 },
  { key: 'category', header: 'Danh mục', width: 18 },
  { key: 'brand', header: 'Thương hiệu', width: 18 },
  { key: 'importName', header: 'Tên nhập', width: 20 },
  { key: 'isActive', header: 'Đang bán', width: 12 },
  { key: 'imageUrl', header: 'Ảnh link', width: 28 },
  { key: 'costPrice', header: 'Giá vốn', width: 14 },
]

const REQUIRED_COLUMN_KEYS = new Set<BaseProductExcelColumnKey>(['groupCode', 'rowType', 'sku'])

function normalizeHeader(value: unknown) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .replace(/\*/g, '')
    .trim()
    .toLowerCase()
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const parsed = Number(`${value}`.replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseBoolean(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0

  const normalized = `${value}`.trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'x', 'dang ban', 'active', 'co'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'ngung ban', 'inactive', 'khong'].includes(normalized)) return false
  return undefined
}

function parseText(value: unknown) {
  const text = `${value ?? ''}`.trim()
  return text.length > 0 ? text : undefined
}

function normalizeRow(row: ProductExcelRow): ProductExcelRow {
  return {
    ...row,
    groupCode: parseText(row.groupCode),
    rowType: (parseText(row.rowType)?.toUpperCase() as ProductExcelRow['rowType']) ?? undefined,
    sku: parseText(row.sku),
    sourceSku: parseText(row.sourceSku),
    productName: parseText(row.productName),
    attributeName1: parseText(row.attributeName1),
    attributeValue1: parseText(row.attributeValue1),
    attributeName2: parseText(row.attributeName2),
    attributeValue2: parseText(row.attributeValue2),
    attributeName3: parseText(row.attributeName3),
    attributeValue3: parseText(row.attributeValue3),
    rowUnit: parseText(row.rowUnit),
    conversionRate: parseNumber(row.conversionRate),
    barcode: parseText(row.barcode),
    category: parseText(row.category),
    brand: parseText(row.brand),
    importName: parseText(row.importName),
    isActive: parseBoolean(row.isActive),
    imageUrl: parseText(row.imageUrl),
    costPrice: parseNumber(row.costPrice),
    priceBookValues: Object.fromEntries(
      Object.entries(row.priceBookValues ?? {}).map(([header, value]) => [header, parseNumber(value)]),
    ),
  }
}

function getExportPriceHeaders(rows: ProductExcelRow[], explicitHeaders?: string[]) {
  const fromRows = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row.priceBookValues ?? {})).filter(Boolean)),
  )
  return explicitHeaders && explicitHeaders.length > 0 ? explicitHeaders : fromRows
}

export async function exportProductWorkbook(params: {
  rows: ProductExcelRow[]
  guideRows?: Array<Array<string | number | null>>
  priceBookHeaders?: string[]
  fileName?: string
}) {
  const workbook = new ExcelJS.Workbook()
  const productSheet = workbook.addWorksheet('Products')
  const guideSheet = workbook.addWorksheet('HuongDan')
  const priceBookHeaders = getExportPriceHeaders(params.rows, params.priceBookHeaders)

  const headers = [...BASE_PRODUCT_EXCEL_COLUMNS.map((column) => column.header), ...priceBookHeaders]
  productSheet.addRow(headers)
  productSheet.getRow(1).font = { bold: true }
  productSheet.views = [{ state: 'frozen', ySplit: 1 }]
  productSheet.columns = [
    ...BASE_PRODUCT_EXCEL_COLUMNS.map((column) => ({ width: column.width })),
    ...priceBookHeaders.map(() => ({ width: 14 })),
  ]

  for (const row of params.rows) {
    productSheet.addRow([
      ...BASE_PRODUCT_EXCEL_COLUMNS.map((column) => row[column.key] ?? ''),
      ...priceBookHeaders.map((header) => row.priceBookValues?.[header] ?? ''),
    ])
  }

  const guideRows = params.guideRows ?? []
  if (guideRows.length > 0) {
    for (const row of guideRows) guideSheet.addRow(row)
    guideSheet.getRow(1).font = { bold: true }
  } else {
    guideSheet.addRow(['HuongDan'])
    guideSheet.getRow(1).font = { bold: true }
  }
  guideSheet.columns = Array.from({ length: Math.max(headers.length, 12) }, () => ({ width: 18 }))

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = params.fileName ?? 'san-pham.xlsx'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function parseProductExcel(file: File): Promise<ParsedProductExcelFile> {
  const aoa = await importExcelToAoa(file)
  if (aoa.length === 0) {
    return { rows: [], includedColumns: [], priceBookHeaders: [] }
  }

  const staticHeaderLookup = new Map(
    BASE_PRODUCT_EXCEL_COLUMNS.map((column) => [normalizeHeader(column.header), column]),
  )
  let headerRowIndex = -1
  let staticHeaderIndexes = new Map<BaseProductExcelColumnKey, number>()
  let priceBookHeaders: Array<{ header: string; index: number }> = []

  for (let rowIndex = 0; rowIndex < Math.min(aoa.length, 10); rowIndex += 1) {
    const sourceRow = aoa[rowIndex] ?? []
    const normalizedRow = sourceRow.map((cell: unknown) => normalizeHeader(cell))
    const nextStaticIndexes = new Map<BaseProductExcelColumnKey, number>()
    const nextPriceBookHeaders: Array<{ header: string; index: number }> = []

    normalizedRow.forEach((header, index) => {
      if (!header) return
      const staticColumn = staticHeaderLookup.get(header)
      if (staticColumn) {
        nextStaticIndexes.set(staticColumn.key, index)
        return
      }

      const rawHeader = parseText(sourceRow[index])
      if (rawHeader) nextPriceBookHeaders.push({ header: rawHeader, index })
    })

    const hasRequiredHeaders = Array.from(REQUIRED_COLUMN_KEYS).every((key) => nextStaticIndexes.has(key))
    if (hasRequiredHeaders) {
      headerRowIndex = rowIndex
      staticHeaderIndexes = nextStaticIndexes
      priceBookHeaders = nextPriceBookHeaders
      break
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Khong tim thay dong tieu de hop le. Hay dung file export/template cua he thong.')
  }

  const rows: ProductExcelRow[] = []
  for (let rowIndex = headerRowIndex + 1; rowIndex < aoa.length; rowIndex += 1) {
    const sourceRow = aoa[rowIndex] ?? []
    const mappedStatic = BASE_PRODUCT_EXCEL_COLUMNS.reduce((acc, column) => {
      const cellIndex = staticHeaderIndexes.get(column.key)
      acc[column.key] = cellIndex === undefined ? undefined : sourceRow[cellIndex]
      return acc
    }, {} as Record<BaseProductExcelColumnKey, unknown>)
    const mappedDynamic = Object.fromEntries(
      priceBookHeaders.map(({ header, index }) => [header, sourceRow[index]]),
    )

    const normalized = normalizeRow({
      ...(mappedStatic as ProductExcelRow),
      priceBookValues: mappedDynamic,
    })

    const hasDynamicValues = Object.values(normalized.priceBookValues ?? {}).some((value) => value !== undefined)
    if (!normalized.groupCode && !normalized.sku && !normalized.productName && !normalized.imageUrl && !hasDynamicValues) continue
    rows.push(normalized)
  }

  return {
    rows,
    includedColumns: BASE_PRODUCT_EXCEL_COLUMNS
      .filter((column) => staticHeaderIndexes.has(column.key))
      .map((column) => column.key),
    priceBookHeaders: priceBookHeaders.map((item) => item.header),
  }
}
