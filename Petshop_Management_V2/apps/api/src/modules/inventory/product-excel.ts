import { buildProductVariantName, resolveProductVariantLabels } from '@petshop/shared'

export const PRODUCT_EXCEL_ROW_TYPES = ['VARIANT', 'CONVERSION'] as const

export type ProductExcelRowType = (typeof PRODUCT_EXCEL_ROW_TYPES)[number]
export type ProductImportMode = 'update' | 'create'
export type ProductExportScope = 'all' | 'filtered' | 'selected' | 'page'

export interface ProductExcelPriceBook {
  id: string
  name: string
  isDefault?: boolean | null
  sortOrder?: number | null
}

export interface ProductExcelRow {
  groupCode?: string | null
  rowType?: ProductExcelRowType | string | null
  sku?: string | null
  sourceSku?: string | null
  productName?: string | null
  attributeName1?: string | null
  attributeValue1?: string | null
  attributeName2?: string | null
  attributeValue2?: string | null
  attributeName3?: string | null
  attributeValue3?: string | null
  rowUnit?: string | null
  conversionRate?: number | string | null
  barcode?: string | null
  category?: string | null
  brand?: string | null
  importName?: string | null
  targetSpecies?: string | null
  costPrice?: number | string | null
  vat?: number | string | null
  weight?: number | string | null
  minStock?: number | string | null
  tags?: string | null
  isActive?: boolean | string | number | null
  lastCountShift?: string | null
  imageUrl?: string | null
  price?: number | string | null
  priceBookValues?: Record<string, number | string | null | undefined> | null
}

export interface ProductExportRequest {
  scope: ProductExportScope
  filters?: Record<string, any>
  productIds?: string[]
  columns?: string[]
  priceBookColumns?: string[]
}

export interface ProductImportRequest {
  mode: ProductImportMode
  rows: ProductExcelRow[]
  includedColumns?: string[]
  priceBookHeaders?: string[]
}

export interface ProductImportPreviewItem {
  rowNumber: number
  groupCode: string
  sku: string
  rowType: ProductExcelRowType
  action: 'create' | 'update' | 'skip'
  messages: string[]
}

export interface ProductImportPreviewSummary {
  totalRows: number
  validRows: number
  skippedRows: number
  errorCount: number
  warningCount: number
  groupCount: number
  createCount: number
  updateCount: number
  skipCount: number
}

export interface ProductImportPreviewResult {
  mode: ProductImportMode
  canCommit: boolean
  summary: ProductImportPreviewSummary
  items: ProductImportPreviewItem[]
  groups: Array<{
    groupCode: string
    rowCount: number
    valid: boolean
    action: 'create' | 'update' | 'skip'
    messages: string[]
  }>
}

export interface NormalizedProductExcelRow {
  rowNumber: number
  groupCode: string
  rowType: ProductExcelRowType
  sku: string
  sourceSku?: string
  productName?: string
  attributeName1?: string
  attributeValue1?: string
  attributeName2?: string
  attributeValue2?: string
  attributeName3?: string
  attributeValue3?: string
  rowUnit?: string
  conversionRate?: number
  barcode?: string
  category?: string
  brand?: string
  importName?: string
  targetSpecies?: string
  costPrice?: number
  vat?: number
  weight?: number
  minStock?: number
  tags?: string
  isActive?: boolean
  lastCountShift?: string
  imageUrl?: string
  price?: number
  priceBookValues: Record<string, number | undefined>
}

export interface ProductImportAnalysisGroup {
  groupCode: string
  rows: NormalizedProductExcelRow[]
  commonValues: {
    productName?: string
    category?: string
    brand?: string
    importName?: string
    targetSpecies?: string
    vat?: number
    weight?: number
    minStock?: number
    tags?: string
    isActive?: boolean
    lastCountShift?: string
  }
  attributeNames: [string?, string?, string?]
  rowMessages: Map<number, string[]>
  groupMessages: string[]
}

const PRODUCT_COMMON_FIELDS = [
  'productName',
  'category',
  'brand',
  'importName',
  'targetSpecies',
  'vat',
  'weight',
  'minStock',
  'tags',
  'isActive',
  'lastCountShift',
] as const

type ProductCommonField = (typeof PRODUCT_COMMON_FIELDS)[number]

function normalizeText(value: unknown) {
  const text = `${value ?? ''}`.trim()
  return text.length > 0 ? text : undefined
}

function normalizeUpperText(value: unknown) {
  const text = normalizeText(value)
  return text ? text.toUpperCase() : undefined
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const parsed = Number(`${value}`.replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeBoolean(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0

  const normalized = `${value}`.trim().toLowerCase()
  if (!normalized) return undefined
  if (['true', '1', 'yes', 'y', 'x', 'active', 'dang ban', 'co', 'có'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'inactive', 'ngung ban', 'khong', 'không'].includes(normalized)) return false
  return undefined
}

function normalizeHeaderToken(value: unknown) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .replace(/\*/g, '')
    .trim()
    .toLowerCase()
}

function splitVariantValues(label?: string | null) {
  if (!label) return []
  return `${label}`
    .split(' - ')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function parseJson<T>(value?: string | null, fallback?: T): T | undefined {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function parseVariantConversion(variant?: Record<string, any>) {
  return parseJson<{ rate?: number; unit?: string; sourceSku?: string } | null>(variant?.conversions, null)
}

function isConversionVariant(variant: Record<string, any>) {
  return Boolean(parseVariantConversion(variant)?.unit)
}

function buildAttributeColumns(product: Record<string, any>, variant: Record<string, any>) {
  const productAttributes = parseJson<Array<{ name?: string; values?: string[] }>>(product.attributes, []) ?? []
  const hasStructuredAttributes = productAttributes.some((attribute) => normalizeText(attribute?.name))
  if (!hasStructuredAttributes) {
    return [0, 1, 2].map(() => ({
      name: undefined,
      value: undefined,
    }))
  }

  const resolved = resolveProductVariantLabels(product.name, variant)
  const variantValues = splitVariantValues(resolved.variantLabel)

  return [0, 1, 2].map((index) => ({
    name: normalizeText(productAttributes[index]?.name),
    value: normalizeText(productAttributes[index]?.name ? variantValues[index] : undefined),
  }))
}

function getProductGroupCode(product: Record<string, any>) {
  return normalizeText(product.groupCode) ?? normalizeText(product.sku) ?? normalizeText(product.id) ?? ''
}

function getEquivalentVariantLabel(productName?: string | null, variant?: Record<string, any>) {
  return normalizeText(resolveProductVariantLabels(productName, variant).variantLabel) ?? '__base__'
}

function findSourceVariantForConversion(product: Record<string, any>, variant: Record<string, any>, variants: Record<string, any>[]) {
  const conversion = parseVariantConversion(variant)
  const trueVariants = variants.filter((item) => !isConversionVariant(item))
  if (conversion?.sourceSku) {
    return trueVariants.find((item) => normalizeText(item.sku) === normalizeText(conversion.sourceSku)) ?? null
  }

  const targetLabel = getEquivalentVariantLabel(product.name, variant)
  const exactMatch = trueVariants.find((item) => getEquivalentVariantLabel(product.name, item) === targetLabel)
  if (exactMatch) return exactMatch
  if (trueVariants.length === 1) return trueVariants[0]
  return null
}

function isRetailLikePriceBook(priceBook: ProductExcelPriceBook) {
  const normalized = normalizeHeaderToken(priceBook.name)
  return normalized.includes('gia le') || normalized === 'retail price' || normalized === 'retail'
}

function buildExportPriceBookValues(
  rawPriceBookPrices: string | null | undefined,
  fallbackPrice: unknown,
  priceBooks: ProductExcelPriceBook[],
) {
  const parsed = parseJson<Record<string, unknown>>(rawPriceBookPrices, {}) ?? {}
  const values: Record<string, number | undefined> = {}
  const fallbackNumber = normalizeNumber(fallbackPrice)

  for (const priceBook of priceBooks) {
    const explicitValue = normalizeNumber(parsed[priceBook.id])
    if (explicitValue !== undefined) {
      values[priceBook.name] = explicitValue
      continue
    }
    if (fallbackNumber !== undefined && isRetailLikePriceBook(priceBook)) {
      values[priceBook.name] = fallbackNumber
    }
  }

  return values
}

export function resolvePrimaryPriceFromValues(
  priceBookValues: Record<string, number | undefined> | undefined,
  priceBooks: ProductExcelPriceBook[],
  fallbackPrice?: number,
) {
  if (priceBookValues) {
    const retailValue = priceBooks
      .filter(isRetailLikePriceBook)
      .map((priceBook) => priceBookValues[priceBook.name])
      .find((value) => value !== undefined)
    if (retailValue !== undefined) return retailValue

    const firstDefined = priceBooks
      .map((priceBook) => priceBookValues[priceBook.name])
      .find((value) => value !== undefined)
    if (firstDefined !== undefined) return firstDefined
  }

  return fallbackPrice
}

function serializePriceBookValues(
  priceBookValues: Record<string, number | undefined> | undefined,
  priceBooks: ProductExcelPriceBook[],
) {
  if (!priceBookValues) return undefined

  const serialized = Object.fromEntries(
    priceBooks.flatMap((priceBook) => {
      const value = priceBookValues[priceBook.name]
      return value === undefined ? [] : [[priceBook.id, value]]
    }),
  )

  return Object.keys(serialized).length > 0 ? serialized : undefined
}

function getIncludedColumnSet(includedColumns?: string[]) {
  return new Set((includedColumns ?? []).filter(Boolean))
}

export function hasAnyPriceBookValue(priceBookValues: Record<string, number | undefined> | undefined) {
  return Object.values(priceBookValues ?? {}).some((value) => value !== undefined)
}

export function buildProductExcelRows(
  products: Array<Record<string, any>>,
  priceBooks: ProductExcelPriceBook[],
): ProductExcelRow[] {
  const rows: ProductExcelRow[] = []

  for (const product of products) {
    const groupCode = getProductGroupCode(product)
    const variants = Array.isArray(product.variants) ? product.variants : []

    if (variants.length === 0) {
      rows.push({
        groupCode,
        rowType: 'VARIANT',
        sku: normalizeText(product.sku) ?? groupCode,
        sourceSku: undefined,
        productName: normalizeText(product.name),
        rowUnit: normalizeText(product.unit),
        barcode: normalizeText(product.barcode),
        category: normalizeText(product.category),
        brand: normalizeText(product.brand),
        importName: normalizeText(product.importName),
        targetSpecies: normalizeUpperText(product.targetSpecies),
        costPrice: normalizeNumber(product.costPrice),
        vat: normalizeNumber(product.vat),
        weight: normalizeNumber(product.weight),
        minStock: normalizeNumber(product.minStock),
        tags: normalizeText(product.tags),
        isActive: typeof product.isActive === 'boolean' ? product.isActive : true,
        lastCountShift: normalizeUpperText(product.lastCountShift),
        imageUrl: normalizeText(product.image),
        priceBookValues: buildExportPriceBookValues(
          null,
          normalizeNumber(product.price),
          priceBooks,
        ),
      })
      continue
    }

    for (const variant of variants) {
      const conversion = parseVariantConversion(variant)
      const rowType: ProductExcelRowType = conversion?.unit ? 'CONVERSION' : 'VARIANT'
      const attributeColumns = buildAttributeColumns(product, variant)
      const sourceVariant = rowType === 'CONVERSION' ? findSourceVariantForConversion(product, variant, variants) : null

      rows.push({
        groupCode,
        rowType,
        sku: normalizeText(variant.sku) ?? '',
        sourceSku: rowType === 'CONVERSION' ? normalizeText(sourceVariant?.sku ?? conversion?.sourceSku) : undefined,
        productName: normalizeText(product.name),
        attributeName1: attributeColumns[0]?.name,
        attributeValue1: attributeColumns[0]?.value,
        attributeName2: attributeColumns[1]?.name,
        attributeValue2: attributeColumns[1]?.value,
        attributeName3: attributeColumns[2]?.name,
        attributeValue3: attributeColumns[2]?.value,
        rowUnit: rowType === 'CONVERSION'
          ? normalizeText(resolveProductVariantLabels(product.name, variant).unitLabel) ?? normalizeText(conversion?.unit)
          : normalizeText(product.unit),
        conversionRate: rowType === 'CONVERSION' ? normalizeNumber(conversion?.rate) : undefined,
        barcode: normalizeText(variant.barcode),
        category: normalizeText(product.category),
        brand: normalizeText(product.brand),
        importName: normalizeText(product.importName),
        targetSpecies: normalizeUpperText(product.targetSpecies),
        costPrice: normalizeNumber(variant.costPrice ?? product.costPrice),
        vat: normalizeNumber(product.vat),
        weight: normalizeNumber(product.weight),
        minStock: normalizeNumber(product.minStock),
        tags: normalizeText(product.tags),
        isActive: typeof product.isActive === 'boolean' ? product.isActive : true,
        lastCountShift: normalizeUpperText(product.lastCountShift),
        imageUrl: normalizeText(variant.image),
        priceBookValues: buildExportPriceBookValues(
          variant.priceBookPrices,
          normalizeNumber(variant.price ?? product.price),
          priceBooks,
        ),
      })
    }
  }

  return rows
}

export function filterProductExcelRows(
  rows: ProductExcelRow[],
  options?: { columns?: string[]; priceBookColumns?: string[] },
): ProductExcelRow[] {
  const hasStaticSelection = Array.isArray(options?.columns) && options.columns.length > 0
  const hasPriceSelection = Array.isArray(options?.priceBookColumns)
  if (!hasStaticSelection && !hasPriceSelection) return rows

  const selectedColumns = new Set(options?.columns ?? [])
  const selectedPriceBooks = new Set(options?.priceBookColumns ?? [])

  return rows.map((row) => {
    const next: ProductExcelRow = {}
    if (hasStaticSelection) {
      for (const key of selectedColumns) {
        if (key === 'price' || key === 'priceBookValues') continue
        if (key in row) {
          const target = next as Record<string, unknown>
          target[key] = (row as Record<string, unknown>)[key]
        }
      }
    } else {
      Object.assign(next, row)
      delete next.priceBookValues
    }

    next.priceBookValues = hasPriceSelection
      ? Object.fromEntries(
        Object.entries(row.priceBookValues ?? {}).filter(([header]) => selectedPriceBooks.has(header)),
      )
      : row.priceBookValues

    return next
  })
}

export function normalizeProductExcelRows(rows: ProductExcelRow[], priceBookHeaders?: string[]) {
  return rows.map((row, index): NormalizedProductExcelRow => {
    const nextPriceBookHeaders = Array.from(
      new Set([...(priceBookHeaders ?? []), ...Object.keys(row.priceBookValues ?? {})].filter(Boolean)),
    )
    const normalizedPriceBookValues = Object.fromEntries(
      nextPriceBookHeaders.map((header) => [header, normalizeNumber(row.priceBookValues?.[header])]),
    )

    return {
      rowNumber: index + 2,
      groupCode: normalizeText(row.groupCode) ?? '',
      rowType: (normalizeUpperText(row.rowType) as ProductExcelRowType | undefined) ?? 'VARIANT',
      sku: normalizeText(row.sku) ?? '',
      sourceSku: normalizeText(row.sourceSku),
      productName: normalizeText(row.productName),
      attributeName1: normalizeText(row.attributeName1),
      attributeValue1: normalizeText(row.attributeValue1),
      attributeName2: normalizeText(row.attributeName2),
      attributeValue2: normalizeText(row.attributeValue2),
      attributeName3: normalizeText(row.attributeName3),
      attributeValue3: normalizeText(row.attributeValue3),
      rowUnit: normalizeText(row.rowUnit),
      conversionRate: normalizeNumber(row.conversionRate),
      barcode: normalizeText(row.barcode),
      category: normalizeText(row.category),
      brand: normalizeText(row.brand),
      importName: normalizeText(row.importName),
      targetSpecies: normalizeUpperText(row.targetSpecies),
      costPrice: normalizeNumber(row.costPrice),
      vat: normalizeNumber(row.vat),
      weight: normalizeNumber(row.weight),
      minStock: normalizeNumber(row.minStock),
      tags: normalizeText(row.tags),
      isActive: normalizeBoolean(row.isActive),
      lastCountShift: normalizeUpperText(row.lastCountShift),
      imageUrl: normalizeText(row.imageUrl),
      price: normalizeNumber(row.price),
      priceBookValues: normalizedPriceBookValues,
    }
  })
}

export function analyzeProductExcelRows(
  rows: ProductExcelRow[],
  options?: {
    includedColumns?: string[]
    priceBookHeaders?: string[]
    mode?: ProductImportMode
  },
) {
  const normalizedRows = normalizeProductExcelRows(rows, options?.priceBookHeaders)
  const groups = new Map<string, ProductImportAnalysisGroup>()
  const includedColumns = getIncludedColumnSet(options?.includedColumns)
  const mode = options?.mode ?? 'update'

  for (const row of normalizedRows) {
    const key = row.groupCode || row.sku
    if (!groups.has(key)) {
      groups.set(key, {
        groupCode: key,
        rows: [],
        commonValues: {},
        attributeNames: [undefined, undefined, undefined],
        rowMessages: new Map(),
        groupMessages: [],
      })
    }

    const group = groups.get(key)!
    group.rows.push({ ...row, groupCode: key })
    group.rowMessages.set(row.rowNumber, [])
  }

  for (const group of groups.values()) {
    const variantRows = group.rows.filter((row) => row.rowType === 'VARIANT')
    if (variantRows.length === 0) {
      group.groupMessages.push('Moi nhom phai co it nhat 1 dong VARIANT.')
    }

    for (const row of group.rows) {
      const rowMessages = group.rowMessages.get(row.rowNumber)!

      if (!PRODUCT_EXCEL_ROW_TYPES.includes(row.rowType)) {
        rowMessages.push(`Loai dong khong hop le: ${row.rowType}.`)
      }
      if (!row.groupCode) {
        rowMessages.push('Thieu Ma nhom SP.')
      }
      if (!row.sku) {
        rowMessages.push('Thieu SKU.')
      }
      if (row.rowType === 'CONVERSION') {
        if (!row.sourceSku) rowMessages.push('Dong CONVERSION phai co SKU nguon quy doi.')
        if (mode === 'create' || includedColumns.has('rowUnit')) {
          if (!row.rowUnit) rowMessages.push('Dong CONVERSION phai co Don vi dong.')
        }
        if (mode === 'create' || includedColumns.has('conversionRate')) {
          if (!row.conversionRate || row.conversionRate <= 0) rowMessages.push('Dong CONVERSION phai co Ty le quy doi lon hon 0.')
        }
      }
      if (row.rowType !== 'CONVERSION' && row.sourceSku) {
        rowMessages.push('Chi dong CONVERSION moi duoc co SKU nguon quy doi.')
      }
      if ((mode === 'create' || includedColumns.has('conversionRate')) && row.rowType !== 'CONVERSION' && row.conversionRate !== undefined) {
        rowMessages.push('Chi dong CONVERSION moi duoc co Ty le quy doi.')
      }
      if ((row.attributeValue1 && !row.attributeName1) || (row.attributeValue2 && !row.attributeName2) || (row.attributeValue3 && !row.attributeName3)) {
        rowMessages.push('Cac cot gia tri phan loai phai di kem ten phan loai tuong ung.')
      }
      if (row.lastCountShift && !/^(MON|TUE|WED|THU|FRI|SAT)_[ABCD]$/.test(row.lastCountShift)) {
        rowMessages.push('Ca kiem gan nhat khong hop le.')
      }
    }

    if (mode === 'create') {
      const variantSkus = new Set(variantRows.map((row) => row.sku))
      for (const row of group.rows) {
        if (row.rowType === 'CONVERSION' && row.sourceSku && !variantSkus.has(row.sourceSku)) {
          group.rowMessages.get(row.rowNumber)!.push(`SKU nguon quy doi ${row.sourceSku} khong ton tai trong cung nhom.`)
        }
      }
    }

    for (const field of PRODUCT_COMMON_FIELDS) {
      if (includedColumns.size > 0 && !includedColumns.has(field)) continue

      const definedValues = group.rows
        .map((row) => row[field])
        .filter((value) => value !== undefined)

      if (definedValues.length === 0) continue

      const normalizedValues = definedValues.map((value) => `${value}`)
      const firstValue = normalizedValues[0]
      const hasMismatch = normalizedValues.some((value) => value !== firstValue)
      const hasBlank = group.rows.some((row) => row[field] === undefined)

      if (hasMismatch || (group.rows.length > 1 && hasBlank)) {
        group.groupMessages.push(`Du lieu chung "${field}" phai lap lai va nhat quan tren moi dong cua cung Ma nhom SP.`)
      } else {
        group.commonValues[field] = definedValues[0] as never
      }
    }

    const attributeNameKeys = ['attributeName1', 'attributeName2', 'attributeName3'] as const
    for (const index of [0, 1, 2] as const) {
      const nameKey = attributeNameKeys[index]
      if (includedColumns.size > 0 && !includedColumns.has(nameKey)) continue

      const values = group.rows
        .filter((row) => row.rowType === 'VARIANT')
        .map((row) => row[nameKey])
        .filter((value) => value !== undefined)

      if (values.length === 0) continue

      const firstValue = values[0]
      const hasMismatch = values.some((value) => value !== firstValue)
      if (hasMismatch) {
        group.groupMessages.push(`Ten phan loai ${index + 1} phai nhat quan trong cung Ma nhom SP.`)
      } else {
        group.attributeNames[index] = firstValue
      }
    }
  }

  return {
    normalizedRows,
    groups: Array.from(groups.values()),
  }
}

export function buildVariantLabelFromRow(row: NormalizedProductExcelRow) {
  return [row.attributeValue1, row.attributeValue2, row.attributeValue3].filter(Boolean).join(' - ') || undefined
}

export function buildAttributesFromRows(group: ProductImportAnalysisGroup) {
  const attributeValueKeys = ['attributeValue1', 'attributeValue2', 'attributeValue3'] as const
  const sourceRows = group.rows.filter((row) => row.rowType === 'VARIANT')

  return group.attributeNames
    .map((name, index) => {
      if (!name) return null
      const valueKey = attributeValueKeys[index]
      if (!valueKey) return null
      const values = Array.from(
        new Set(
          sourceRows
            .map((row) => row[valueKey])
            .filter((value): value is string => Boolean(value)),
        ),
      )

      return values.length > 0 ? { name, values } : null
    })
    .filter((entry): entry is { name: string; values: string[] } => Boolean(entry))
}

export function buildVariantPayloadFromRow(
  productName: string,
  baseUnit: string,
  row: NormalizedProductExcelRow,
  priceBooks: ProductExcelPriceBook[],
) {
  const variantLabel = buildVariantLabelFromRow(row)
  const unitLabel = row.rowType === 'CONVERSION' ? row.rowUnit : undefined
  const name = buildProductVariantName(productName, variantLabel, unitLabel) || row.productName || productName
  const serializedPriceBookValues = serializePriceBookValues(row.priceBookValues, priceBooks)

  return {
    name,
    variantLabel,
    unitLabel,
    sku: row.sku,
    barcode: row.barcode,
    price: resolvePrimaryPriceFromValues(row.priceBookValues, priceBooks, row.price) ?? 0,
    costPrice: row.costPrice,
    image: row.imageUrl,
    priceBookPrices: serializedPriceBookValues ? JSON.stringify(serializedPriceBookValues) : undefined,
    conversions: row.rowType === 'CONVERSION'
      ? JSON.stringify({ rate: row.conversionRate, unit: row.rowUnit ?? baseUnit, sourceSku: row.sourceSku })
      : undefined,
  }
}

export function matchPriceBookHeaders(
  headers: string[] | undefined,
  priceBooks: ProductExcelPriceBook[],
) {
  const lookup = new Map(priceBooks.map((priceBook) => [normalizeHeaderToken(priceBook.name), priceBook]))
  const matched = new Map<string, ProductExcelPriceBook>()
  const unknown: string[] = []

  for (const header of headers ?? []) {
    const normalized = normalizeHeaderToken(header)
    const priceBook = lookup.get(normalized)
    if (!priceBook) {
      unknown.push(header)
      continue
    }
    matched.set(header, priceBook)
  }

  return { matched, unknown }
}

export function buildProductGuideSheetRows(priceBookNames: string[]) {
  const dynamicPriceHeaders = priceBookNames.length > 0 ? priceBookNames : ['Gia le', 'Gia si', 'Gia Shopee']
  const sampleVariantPrices = dynamicPriceHeaders.map((_, index) => Math.round(180000 * (1 + index * 0.1)))
  const sampleConversionPrices = dynamicPriceHeaders.map((_, index) => Math.round(1800000 * (1 + index * 0.1)))

  const sampleHeader = [
    'Ma nhom SP*',
    'Loai dong*',
    'SKU*',
    'SKU nguon quy doi',
    'Ten san pham',
    'Ten phan loai 1',
    'Gia tri phan loai 1',
    'Don vi dong',
    'Ty le quy doi',
    'Ma vach',
    'Danh muc',
    'Thuong hieu',
    'Ten nhap',
    'Dang ban',
    'Anh link',
    'Gia von',
    ...dynamicPriceHeaders,
  ]

  return [
    ['NHAP/XUAT SAN PHAM - HUONG DAN'],
    ['1. Sheet Products chua du lieu de sua va import lai.'],
    ['2. He thong nhan dien theo ten dau de cot, khong theo thu tu cot.'],
    ['3. Co the xoa bot cot khong can cap nhat trong che do update, nhung phai giu cac cot co dau * .'],
    ['4. Moi dong tuong ung 1 SKU van hanh: VARIANT hoac CONVERSION.'],
    ['5. Ma nhom SP dung de nhom nhieu SKU vao cung 1 san pham cha.'],
    ['6. Dong CONVERSION phai co SKU nguon quy doi tro toi 1 dong VARIANT cung nhom.'],
    ['7. Cot gia dong lay tu cai dat bang gia hien tai: ' + dynamicPriceHeaders.join(', ') + '.'],
    ['8. Anh link tren dong se cap nhat anh cua SKU do; dong trong update se duoc bo qua.'],
    [],
    ['Vi du nhom san pham'],
    sampleHeader,
    ['RC-DOG', 'VARIANT', 'RC-DOG-S', '', 'Royal Canin Mini Adult', 'Kich co', 'Size S', 'goi', '', '893RC003S', 'Thuc an', 'Royal Canin', 'RC Mini Adult', 'Co', 'https://example.com/rc-dog-s.jpg', 140000, ...sampleVariantPrices],
    ['RC-DOG', 'CONVERSION', 'RC-DOG-BOX', 'RC-DOG-S', 'Royal Canin Mini Adult', 'Kich co', 'Size S', 'thung', 6, '893RC003BOX', 'Thuc an', 'Royal Canin', 'RC Mini Adult', 'Co', 'https://example.com/rc-dog-box.jpg', 1500000, ...sampleConversionPrices],
  ] as Array<Array<string | number | null>>
}

export {
  normalizeHeaderToken,
}
