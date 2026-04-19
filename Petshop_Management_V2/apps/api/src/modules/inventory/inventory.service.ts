import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { Prisma } from '@petshop/database'
import { buildProductVariantName, resolveProductVariantLabels } from '@petshop/shared'
import { DatabaseService } from '../../database/database.service.js'
import {
  analyzeProductExcelRows,
  buildAttributesFromRows,
  buildProductExcelRows,
  buildProductGuideSheetRows,
  buildVariantLabelFromRow,
  buildVariantPayloadFromRow,
  hasAnyPriceBookValue,
  matchPriceBookHeaders,
  resolvePrimaryPriceFromValues,
  type ProductExportRequest,
  type ProductImportAnalysisGroup,
  type ProductExcelPriceBook,
  type ProductImportPreviewItem,
  type ProductImportPreviewResult,
  type ProductImportRequest,
} from './product-excel.js'

function normalizeSearchValue(value?: string | null) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Ä‘Ä]/g, (char) => (char === 'Ä‘' ? 'd' : 'D'))
    .toLowerCase()
    .trim()
}

function tokenizeSearch(value?: string | null) {
  return normalizeSearchValue(value)
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function buildProductSearchHaystack(product: Record<string, any>) {
  const variantText = Array.isArray(product.variants)
    ? product.variants
      .map((variant: Record<string, any>) => {
        const { variantLabel, unitLabel, displayName } = resolveProductVariantLabels(product.name, variant)
        return [
          variant.name,
          displayName,
          variantLabel,
          unitLabel,
          variant.sku,
          variant.barcode,
          variant.conversions,
          variant.pricePolicies,
          variant.priceBookPrices,
        ]
          .filter(Boolean)
          .join(' ')
      })
      .join(' ')
    : ''

  return normalizeSearchValue(
    [
      product.name,
      product.groupCode,
      product.sku,
      product.barcode,
      product.category,
      product.brand,
      product.importName,
      product.tags,
      product.description,
      variantText,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

// â”€â”€â”€ DTOs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface FindProductsDto {
  search?: string
  category?: string
  brand?: string
  saleStatus?: string
  stockStatus?: string
  supplierId?: string
  branchId?: string
  tags?: string
  lowStock?: string
  status?: string
  page?: number
  limit?: number
}

export interface CreateProductDto {
  name: string
  sku?: string
  groupCode?: string
  barcode?: string
  category?: string
  brand?: string
  unit: string
  costPrice?: number
  price: number
  wholesalePrice?: number
  minStock?: number
  weight?: number
  vat?: number
  conversionRate?: number
  conversionUnit?: string
  image?: string
  description?: string
  supplierId?: string
  importName?: string
  tags?: string
  attributes?: string
  isActive?: boolean
  lastCountShift?: string
}

export interface UpdateProductDto extends Partial<CreateProductDto> { }

export interface CreateVariantDto {
  name: string
  variantLabel?: string
  unitLabel?: string
  sku?: string
  barcode?: string
  costPrice?: number
  price: number
  image?: string
  conversions?: string
  pricePolicies?: string
  priceBookPrices?: string
  isActive?: boolean
}

export interface FindServicesDto {
  search?: string
  type?: string
  page?: number
  limit?: number
}

export interface CreateServiceDto {
  name: string
  type: string
  description?: string
  basePrice: number
  unit?: string
  image?: string
}

export interface UpdateServiceDto extends Partial<CreateServiceDto> { }

function prepareVariantPayload(dto: Partial<CreateVariantDto>, productName?: string | null) {
  const variantLabel = dto.variantLabel?.trim() || null
  const unitLabel = dto.unitLabel?.trim() || null

  return {
    ...dto,
    name: buildProductVariantName(productName, variantLabel, unitLabel) || dto.name,
    variantLabel,
    unitLabel,
  }
}

function parseJson<T>(value?: string | null, fallback?: T): T | undefined {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function sumBranchStock(rows: Array<{ branchId?: string | null; stock?: number | null }> | undefined, branchId?: string) {
  if (!Array.isArray(rows) || rows.length === 0) return 0
  return rows.reduce((total, row) => {
    if (branchId && row.branchId !== branchId) return total
    return total + Number(row.stock ?? 0)
  }, 0)
}

// â”€â”€â”€ Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) { }

  private getProductInclude() {
    return {
      // @ts-ignore â€” Prisma nested include type limitation: `variants.include.branchStocks` not reflected in generated types
      variants: { include: { branchStocks: true } },
      branchStocks: true,
    }
  }

  private async getProductExcelPriceBooks(): Promise<ProductExcelPriceBook[]> {
    const priceBooks = await this.db.priceBook.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    return priceBooks.map((priceBook: any) => ({
      id: priceBook.id,
      name: priceBook.name,
      isDefault: priceBook.isDefault,
      sortOrder: priceBook.sortOrder,
    }))
  }

  private matchesProductFilters(product: Record<string, any>, query: FindProductsDto) {
    const searchTokens = tokenizeSearch(query.search)
    const haystack = searchTokens.length > 0 ? buildProductSearchHaystack(product) : ''
    const productBrand = normalizeSearchValue(product.brand)
    const totalStock = sumBranchStock(product.branchStocks, query.branchId)
    const minStock = Number(product.minStock ?? 0)
    const saleStatus = `${query.saleStatus ?? ''}`.trim().toLowerCase()
    const stockStatus = `${query.stockStatus ?? ''}`.trim().toLowerCase()

    if (searchTokens.length > 0 && !searchTokens.some((token) => haystack.includes(token))) return false
    if (query.brand && !productBrand.includes(normalizeSearchValue(query.brand))) return false
    if (saleStatus === 'active' && !(product.isActive ?? true)) return false
    if (saleStatus === 'inactive' && Boolean(product.isActive ?? true)) return false
    if (query.lowStock === 'true' && totalStock > minStock) return false
    if (stockStatus === 'in_stock' && totalStock <= 0) return false
    if (stockStatus === 'out_of_stock' && totalStock > 0) return false
    if (stockStatus === 'low_stock' && !(totalStock > 0 && totalStock <= minStock)) return false

    return true
  }

  private async listProducts(query: FindProductsDto, options?: { paginate?: boolean }) {
    const {
      search,
      category,
      brand,
      supplierId,
      branchId,
      tags,
      status,
      page = 1,
      limit = 20,
    } = query

    const paginate = options?.paginate ?? true
    const skip = (Number(page) - 1) * Number(limit)
    const searchTokens = tokenizeSearch(search)
    const saleStatus = `${query.saleStatus ?? ''}`.trim().toLowerCase()
    const stockStatus = `${query.stockStatus ?? ''}`.trim().toLowerCase()
    const where: any = {}

    if (category) where.category = { contains: category, mode: 'insensitive' }
    if (brand) where.brand = { contains: brand, mode: 'insensitive' }
    if (supplierId) where.supplierId = supplierId
    if (branchId) where.branchStocks = { some: { branchId } }
    if (tags) where.tags = { contains: tags, mode: 'insensitive' }
    if (status === 'DELETED') {
      where.deletedAt = { not: null }
    } else {
      where.deletedAt = null
    }

    const shouldFilterInMemory =
      !paginate ||
      searchTokens.length > 0 ||
      saleStatus.length > 0 ||
      stockStatus.length > 0 ||
      query.lowStock === 'true'

    let data: any[] = []
    let total = 0

    if (shouldFilterInMemory) {
      const allProducts = await this.db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: this.getProductInclude() as any,
      })

      const filteredProducts = allProducts.filter((product) => this.matchesProductFilters(product, query))
      total = filteredProducts.length
      data = paginate ? filteredProducts.slice(skip, skip + Number(limit)) : filteredProducts
    } else {
      [data, total] = await Promise.all([
        this.db.product.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: this.getProductInclude() as any,
        }),
        this.db.product.count({ where }),
      ])
    }

    return {
      success: true,
      data,
      total,
      page: paginate ? Number(page) : 1,
      limit: paginate ? Number(limit) : total,
      totalPages: paginate ? Math.ceil(total / Number(limit)) : (total > 0 ? 1 : 0),
    }
  }

  // â”€â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async findAllProducts(query: FindProductsDto) {
    return this.listProducts(query, { paginate: true })
  }

  async legacyFindAllProducts(query: FindProductsDto) {
    const { search, category, brand, supplierId, branchId, tags, lowStock, status, page = 1, limit = 20 } = query
    const skip = (Number(page) - 1) * Number(limit)
    const where: any = {}
    const searchTokens = tokenizeSearch(search)

    if (category) where.category = { contains: category, mode: 'insensitive' }
    if (brand) where.brand = { contains: brand, mode: 'insensitive' }
    if (supplierId) where.supplierId = supplierId
    if (branchId) where.branchStocks = { some: { branchId } }
    if (tags) where.tags = { contains: tags, mode: 'insensitive' }
    if (lowStock === 'true') {
      // Products where current stock <= product minStock threshold.
      where.stock = { lte: this.db.product.fields.minStock }
    }
    if (status === 'DELETED') {
      where.deletedAt = { not: null }
    } else {
      where.deletedAt = null
    }

    let data: any[] = []
    let total = 0

    if (searchTokens.length > 0) {
      const allProducts = await this.db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        // @ts-ignore â€” Prisma nested include type limitation: `variants.include.branchStocks` not reflected in generated types
        include: { variants: { include: { branchStocks: true } }, branchStocks: true },
      })

      const filteredProducts = allProducts.filter((product) => {
        const haystack = buildProductSearchHaystack(product)
        return searchTokens.some((token) => haystack.includes(token))
      })

      total = filteredProducts.length
      data = filteredProducts.slice(skip, skip + Number(limit))
    } else {
      [data, total] = await Promise.all([
        this.db.product.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          // @ts-ignore â€” Prisma nested include type limitation: `variants.include.branchStocks` not reflected in generated types
          include: { variants: { include: { branchStocks: true } }, branchStocks: true },
        }),
        this.db.product.count({ where }),
      ])
    }

    return { success: true, data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
  }

  async exportProducts(body: ProductExportRequest) {
    const filters = (body.filters ?? {}) as FindProductsDto
    const priceBooks = await this.getProductExcelPriceBooks()

    let products = (await this.listProducts(filters, { paginate: false })).data ?? []
    if (body.scope === 'selected') {
      const selectedIds = new Set((body.productIds ?? []).filter(Boolean))
      products = products.filter((product: any) => selectedIds.has(product.id))
    }

    const rows = buildProductExcelRows(products, priceBooks)
    return {
      success: true,
      data: {
        rows,
        guideRows: buildProductGuideSheetRows(priceBooks.map((priceBook) => priceBook.name)),
        priceBookHeaders: priceBooks.map((priceBook) => priceBook.name),
        summary: {
          scope: body.scope,
          productCount: products.length,
          rowCount: rows.length,
        },
      },
    }
  }

  private buildImportPreviewResult(
    mode: ProductImportRequest['mode'],
    groups: ProductImportAnalysisGroup[],
  ): ProductImportPreviewResult {
    const items: ProductImportPreviewItem[] = []
    let createCount = 0
    let updateCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const group of groups) {
      const groupMessages = [...group.groupMessages]
      const rowErrors = group.rows.flatMap((row) => group.rowMessages.get(row.rowNumber) ?? [])
      const valid = groupMessages.length === 0 && rowErrors.length === 0
      const action: 'create' | 'update' | 'skip' = valid ? (mode === 'create' ? 'create' : 'update') : 'skip'

      for (const row of group.rows) {
        const messages = [...groupMessages, ...(group.rowMessages.get(row.rowNumber) ?? [])]
        if (messages.length > 0) errorCount += messages.length

        if (action === 'create') createCount += 1
        else if (action === 'update') updateCount += 1
        else skipCount += 1

        items.push({
          rowNumber: row.rowNumber,
          baseSku: group.baseSku,
          sku: row.sku,
          rowType: row.rowType,
          action,
          messages,
        })
      }
    }

    const validRows = items.filter((item) => item.action !== 'skip').length

    return {
      mode,
      canCommit: validRows > 0,
      summary: {
        totalRows: items.length,
        validRows,
        skippedRows: items.length - validRows,
        errorCount,
        warningCount: 0,
        groupCount: groups.length,
        createCount,
        updateCount,
        skipCount,
      },
      items,
      groups: groups.map((group) => {
        const groupMessages = [...group.groupMessages, ...group.rows.flatMap((row) => group.rowMessages.get(row.rowNumber) ?? [])]
        const valid = groupMessages.length === 0
        return {
          baseSku: group.baseSku,
          rowCount: group.rows.length,
          valid,
          action: valid ? (mode === 'create' ? 'create' : 'update') : 'skip',
          messages: Array.from(new Set(groupMessages)),
        }
      }),
    }
  }

  private async analyzeProductImport(body: ProductImportRequest) {
    const priceBooks = await this.getProductExcelPriceBooks()
    const { groups } = analyzeProductExcelRows(body.rows ?? [], {
      includedColumns: body.includedColumns,
      priceBookHeaders: body.priceBookHeaders,
      mode: body.mode,
    })
    const matchedPriceBooks = matchPriceBookHeaders(body.priceBookHeaders, priceBooks)
    const allSkus = Array.from(new Set(groups.flatMap((group) => group.rows.map((row) => row.sku)).filter(Boolean)))
    const allBaseSkus = Array.from(new Set(groups.map((group) => group.baseSku).filter(Boolean)))

    const [existingProducts, existingVariants] = await Promise.all([
      this.db.product.findMany({
        where: { sku: { in: allBaseSkus } },
        include: this.getProductInclude() as any,
      }),
      this.db.productVariant.findMany({
        where: { sku: { in: allSkus } },
        include: { product: true },
      }),
    ])

    const productsBySku = new Map(existingProducts.map((product: any) => [product.sku, product]))
    const variantsBySku = new Map(existingVariants.map((variant: any) => [variant.sku, variant]))
    const skuOccurrences = new Map<string, number[]>()

    for (const group of groups) {
      for (const row of group.rows) {
        if (!row.sku) continue
        if (!skuOccurrences.has(row.sku)) skuOccurrences.set(row.sku, [])
        skuOccurrences.get(row.sku)!.push(row.rowNumber)
      }
    }

    for (const group of groups) {
      if (matchedPriceBooks.unknown.length > 0) {
        group.groupMessages.push(`Khong tim thay bang gia cho cac cot: ${matchedPriceBooks.unknown.join(', ')}.`)
      }

      const productRow = group.rows.find((row) => row.rowType === 'PRODUCT')
      const attrs = buildAttributesFromRows(group)

      for (const row of group.rows) {
        const rowMessages = group.rowMessages.get(row.rowNumber)!
        const duplicateRows = skuOccurrences.get(row.sku) ?? []
        if (duplicateRows.length > 1) {
          rowMessages.push(`SKU ${row.sku} xuat hien nhieu lan trong file.`)
        }
      }

      if (!productRow) {
        group.groupMessages.push('Thieu dong PRODUCT cho nhom SKU goc nay.')
        continue
      }

      if (body.mode === 'create') {
        if (!group.commonValues.productName) group.groupMessages.push('Thieu ten san pham o dong PRODUCT.')
        if (!group.commonValues.baseUnit) group.groupMessages.push('Thieu don vi goc o dong PRODUCT.')
        if (productsBySku.has(group.baseSku) || variantsBySku.has(group.baseSku)) {
          group.groupMessages.push(`SKU goc ${group.baseSku} da ton tai trong he thong.`)
        }

        for (const row of group.rows) {
          const rowMessages = group.rowMessages.get(row.rowNumber)!
          if (row.rowType !== 'PRODUCT' && (productsBySku.has(row.sku) || variantsBySku.has(row.sku))) {
            rowMessages.push(`SKU ${row.sku} da ton tai trong he thong.`)
          }
        }
      } else {
        const existingProduct = productsBySku.get(group.baseSku)
        if (!existingProduct) {
          group.groupMessages.push(`Khong tim thay san pham goc theo SKU ${group.baseSku}.`)
        }

        for (const row of group.rows) {
          if (row.rowType === 'PRODUCT') continue

          const rowMessages = group.rowMessages.get(row.rowNumber)!
          const existingVariant = variantsBySku.get(row.sku)
          if (!existingVariant) {
            rowMessages.push(`Khong tim thay SKU ${row.sku} de cap nhat.`)
            continue
          }
          if (existingProduct && existingVariant.productId !== existingProduct.id) {
            rowMessages.push(`SKU ${row.sku} khong thuoc SKU goc ${group.baseSku}.`)
          }
        }
      }

      if (attrs.length > 3) {
        group.groupMessages.push('V1 chi ho tro toi da 3 cap phan loai.')
      }
    }

    return {
      groups,
      preview: this.buildImportPreviewResult(body.mode, groups),
      priceBooks,
      productsBySku,
      variantsBySku,
    }
  }
  async previewProductImport(body: ProductImportRequest) {
    const analysis = await this.analyzeProductImport(body)
    return {
      success: true,
      data: analysis.preview,
    }
  }

  private compactPatch<T extends Record<string, any>>(value: T) {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    ) as Partial<T>
  }

  private async commitCreateProductImportGroup(
    tx: Prisma.TransactionClient,
    group: ProductImportAnalysisGroup,
    priceBooks: ProductExcelPriceBook[],
  ) {
    const productRow = group.rows.find((row) => row.rowType === 'PRODUCT')!
    const productName = group.commonValues.productName!
    const baseUnit = group.commonValues.baseUnit!
    const attributes = buildAttributesFromRows(group)
    const nonProductRows = group.rows.filter((row) => row.rowType !== 'PRODUCT')
    const shouldCreateRootVariant = nonProductRows.length === 0 || Boolean(buildVariantLabelFromRow(productRow))
    const productPrice = resolvePrimaryPriceFromValues(productRow.priceBookValues, priceBooks, productRow.price) ?? 0
    const productPayload = this.compactPatch({
      name: productName,
      sku: group.baseSku,
      barcode: productRow.barcode,
      category: group.commonValues.category,
      brand: group.commonValues.brand,
      unit: baseUnit,
      costPrice: productRow.costPrice,
      price: productPrice,
      minStock: group.commonValues.minStock ?? 5,
      weight: group.commonValues.weight,
      vat: group.commonValues.vat ?? 0,
      importName: group.commonValues.importName,
      tags: group.commonValues.tags,
      targetSpecies: group.commonValues.targetSpecies,
      isActive: group.commonValues.isActive ?? true,
      lastCountShift: group.commonValues.lastCountShift,
      image: productRow.imageUrl,
      attributes: attributes.length > 0 ? JSON.stringify(attributes) : undefined,
    })

    const product = await tx.product.create({ data: productPayload as any })
    const variantRows = [
      ...(shouldCreateRootVariant ? [productRow] : []),
      ...nonProductRows,
    ]
    const variantPayloads = variantRows.map((row) => buildVariantPayloadFromRow(productName, baseUnit, row, priceBooks))

    if (variantPayloads.length > 0) {
      for (const variant of variantPayloads) {
        await tx.productVariant.create({
          data: {
            ...variant,
            productId: product.id,
          } as any,
        })
      }
    }
  }
  private async commitUpdateProductImportGroup(
    tx: Prisma.TransactionClient,
    group: ProductImportAnalysisGroup,
    productsBySku: Map<string, any>,
    variantsBySku: Map<string, any>,
    priceBooks: ProductExcelPriceBook[],
    includedColumns: Set<string>,
  ) {
    const product = productsBySku.get(group.baseSku)
    if (!product) return

    const productRow = group.rows.find((row) => row.rowType === 'PRODUCT')!
    const shouldUpdateAttributes = [
      'attributeName1',
      'attributeName2',
      'attributeName3',
      'attributeValue1',
      'attributeValue2',
      'attributeValue3',
    ].some((column) => includedColumns.has(column))
    const attributes = shouldUpdateAttributes ? buildAttributesFromRows(group) : []
    const nextProductName = group.commonValues.productName ?? product.name
    const nextBaseUnit = group.commonValues.baseUnit ?? product.unit
    const rootVariant = variantsBySku.get(group.baseSku)

    const parseSerializedJson = (value?: string | null) => {
      if (!value) return {}
      try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        return {}
      }
    }

    const parseStoredPriceBookValues = (raw?: string | null) => {
      const parsed = parseSerializedJson(raw) as Record<string, unknown>
      return Object.fromEntries(
        priceBooks.map((priceBook) => {
          const value = parsed[priceBook.id]
          const normalized = typeof value === 'number' ? value : Number(value)
          return [priceBook.name, Number.isFinite(normalized) ? normalized : undefined]
        }),
      ) as Record<string, number | undefined>
    }

    const buildMergedPriceBookUpdate = (
      existingSerialized: string | null | undefined,
      incomingValues: Record<string, number | undefined>,
      fallbackPrice?: number | null,
    ) => {
      if (!hasAnyPriceBookValue(incomingValues)) return null

      const mergedValues = {
        ...parseStoredPriceBookValues(existingSerialized),
        ...Object.fromEntries(Object.entries(incomingValues).filter(([, value]) => value !== undefined)),
      }

      return {
        primaryPrice: resolvePrimaryPriceFromValues(
          mergedValues,
          priceBooks,
          typeof fallbackPrice === 'number' ? fallbackPrice : undefined,
        ),
        serialized: JSON.stringify(
          Object.fromEntries(
            priceBooks.flatMap((priceBook) => {
              const value = mergedValues[priceBook.name]
              return value === undefined ? [] : [[priceBook.id, value]]
            }),
          ),
        ),
      }
    }

    const productPriceUpdate = buildMergedPriceBookUpdate(rootVariant?.priceBookPrices, productRow.priceBookValues, product.price)
    const productPayload = this.compactPatch({
      name: group.commonValues.productName,
      barcode: productRow.barcode,
      category: group.commonValues.category,
      brand: group.commonValues.brand,
      unit: group.commonValues.baseUnit,
      costPrice: productRow.costPrice,
      price: productPriceUpdate?.primaryPrice ?? productRow.price,
      minStock: group.commonValues.minStock,
      weight: group.commonValues.weight,
      vat: group.commonValues.vat,
      importName: group.commonValues.importName,
      tags: group.commonValues.tags,
      targetSpecies: group.commonValues.targetSpecies,
      isActive: group.commonValues.isActive,
      lastCountShift: group.commonValues.lastCountShift,
      image: productRow.imageUrl,
      attributes: shouldUpdateAttributes ? JSON.stringify(attributes) : undefined,
    })

    if (Object.keys(productPayload).length > 0) {
      await tx.product.update({
        where: { id: product.id },
        data: productPayload as any,
      })
    }

    if (rootVariant && rootVariant.productId === product.id) {
      const shouldUpdateIdentity = includedColumns.has('productName')
        || includedColumns.has('attributeValue1')
        || includedColumns.has('attributeValue2')
        || includedColumns.has('attributeValue3')
      const nextVariantLabel = shouldUpdateIdentity ? buildVariantLabelFromRow(productRow) : rootVariant.variantLabel
      const nextVariantName = shouldUpdateIdentity || includedColumns.has('productName')
        ? buildProductVariantName(nextProductName, nextVariantLabel, rootVariant.unitLabel) || nextProductName
        : undefined
      const rootVariantPriceUpdate = buildMergedPriceBookUpdate(
        rootVariant.priceBookPrices,
        productRow.priceBookValues,
        rootVariant.price,
      )
      const rootVariantPayload = this.compactPatch({
        name: nextVariantName,
        variantLabel: shouldUpdateIdentity ? nextVariantLabel : undefined,
        barcode: productRow.barcode,
        costPrice: productRow.costPrice,
        price: rootVariantPriceUpdate?.primaryPrice ?? productRow.price,
        priceBookPrices: rootVariantPriceUpdate?.serialized,
      })
      if (Object.keys(rootVariantPayload).length > 0) {
        await tx.productVariant.update({
          where: { id: rootVariant.id },
          data: rootVariantPayload as any,
        })
      }
    }

    for (const row of group.rows) {
      if (row.rowType === 'PRODUCT') continue
      const variant = variantsBySku.get(row.sku)
      if (!variant || variant.productId !== product.id) continue

      const shouldUpdateVariantLabel = includedColumns.has('attributeValue1')
        || includedColumns.has('attributeValue2')
        || includedColumns.has('attributeValue3')
      const shouldUpdateUnitLabel = row.rowType === 'CONVERSION' && includedColumns.has('rowUnit')
      const shouldUpdateVariantName = includedColumns.has('productName') || shouldUpdateVariantLabel || shouldUpdateUnitLabel
      const currentConversions = parseSerializedJson(variant.conversions) as { rate?: number; unit?: string }
      const nextVariantLabel = shouldUpdateVariantLabel ? buildVariantLabelFromRow(row) : variant.variantLabel
      const nextUnitLabel = row.rowType === 'CONVERSION'
        ? (shouldUpdateUnitLabel ? row.rowUnit : variant.unitLabel ?? currentConversions.unit)
        : variant.unitLabel
      const nextVariantName = shouldUpdateVariantName
        ? buildProductVariantName(nextProductName, nextVariantLabel, nextUnitLabel) || row.productName || nextProductName
        : undefined
      const priceUpdate = buildMergedPriceBookUpdate(variant.priceBookPrices, row.priceBookValues, variant.price)
      const nextConversions = row.rowType === 'CONVERSION' && (includedColumns.has('rowUnit') || includedColumns.has('conversionRate'))
        ? JSON.stringify({
            rate: includedColumns.has('conversionRate') ? row.conversionRate : currentConversions.rate,
            unit: includedColumns.has('rowUnit') ? row.rowUnit ?? nextBaseUnit : currentConversions.unit ?? nextBaseUnit,
          })
        : undefined

      const variantPayload = this.compactPatch({
        name: nextVariantName,
        variantLabel: shouldUpdateVariantLabel ? nextVariantLabel : undefined,
        unitLabel: shouldUpdateUnitLabel ? nextUnitLabel : undefined,
        barcode: row.barcode,
        costPrice: row.costPrice,
        image: row.imageUrl,
        price: priceUpdate?.primaryPrice ?? row.price,
        priceBookPrices: priceUpdate?.serialized,
        conversions: nextConversions,
      })
      if (Object.keys(variantPayload).length === 0) continue

      await tx.productVariant.update({
        where: { id: variant.id },
        data: variantPayload as any,
      })
    }
  }
  async commitProductImport(body: ProductImportRequest) {
    const analysis = await this.analyzeProductImport(body)
    const includedColumns = new Set(body.includedColumns ?? [])
    const executableGroups = analysis.groups.filter((group) => {
      if (group.groupMessages.length > 0) return false
      return group.rows.every((row) => (group.rowMessages.get(row.rowNumber) ?? []).length === 0)
    })

    if (executableGroups.length > 0) {
      await this.db.$transaction(async (tx) => {
        for (const group of executableGroups) {
          if (body.mode === 'create') {
            await this.commitCreateProductImportGroup(tx, group, analysis.priceBooks)
          } else {
            await this.commitUpdateProductImportGroup(
              tx,
              group,
              analysis.productsBySku,
              analysis.variantsBySku,
              analysis.priceBooks,
              includedColumns,
            )
          }
        }
      })
    }

    return {
      success: true,
      data: analysis.preview,
      message: executableGroups.length > 0
        ? `Da xu ly ${executableGroups.length} nhom san pham.`
        : 'Khong co nhom san pham hop le de xu ly.',
    }
  }
  async findProductById(id: string) {
    const product = await this.db.product.findUnique({
      where: { id },
      // @ts-ignore â€” Prisma nested include type limitation: `variants.include.branchStocks.include.branch` not reflected
      include: {
        variants: { include: { branchStocks: { include: { branch: true } } } },
        branchStocks: { include: { branch: true } },
      },
    })
    if (!product) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m')
    return { success: true, data: product }
  }

  async createProduct(dto: CreateProductDto) {
    if (dto.sku) {
      const exists = await this.db.product.findFirst({ where: { sku: dto.sku } })
      if (exists) throw new ConflictException('MÃ£ SKU Ä‘Ã£ tá»“n táº¡i')
    }
    const productData: any = { ...dto }
    const normalizeVariants = (variants: CreateVariantDto[]) =>
      variants.map((variant) => prepareVariantPayload(variant, dto.name))

    if (Array.isArray(productData.variants?.create)) {
      productData.variants = {
        ...productData.variants,
        create: normalizeVariants(productData.variants.create),
      }
    } else if (Array.isArray(productData.variants)) {
      productData.variants = {
        create: normalizeVariants(productData.variants),
      }
    }

    const product = await this.db.product.create({ data: productData as any })
    return { success: true, data: product }
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.findProductById(id)
    if (dto.sku) {
      const exists = await this.db.product.findFirst({ where: { sku: dto.sku, id: { not: id } } })
      if (exists) throw new ConflictException('MÃ£ SKU Ä‘Ã£ tá»“n táº¡i')
    }
    const updated = await this.db.product.update({ where: { id }, data: dto as any })
    return { success: true, data: updated }
  }

  async removeProduct(id: string) {
    const product = await this.db.product.findUnique({
      where: { id },
      include: {
        orderItems: { take: 1 },
        receiptItems: { take: 1 },
        stockTransactions: { take: 1 }
      }
    })
    if (!product) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m')

    const hasTransactions = product.orderItems.length > 0 || product.receiptItems.length > 0 || product.stockTransactions.length > 0

    if (hasTransactions) {
      const suffix = `_deleted_${Date.now()}`
      await this.db.product.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          sku: product.sku ? `${product.sku}${suffix}` : null,
          barcode: product.barcode ? `${product.barcode}${suffix}` : null
        }
      })
      // Cáº­p nháº­t cÃ¡c variants náº¿u cÃ³
      const variants = await this.db.productVariant.findMany({ where: { productId: id } })
      for (const variant of variants) {
        await this.db.productVariant.update({
          where: { id: variant.id },
          data: {
            deletedAt: new Date(),
            sku: variant.sku ? `${variant.sku}${suffix}` : null,
            barcode: variant.barcode ? `${variant.barcode}${suffix}` : null
          }
        })
      }
      return { success: true, message: 'ÄÃ£ áº©n sáº£n pháº©m vÃ o danh sÃ¡ch Ä‘Ã£ xoÃ¡ (vÃ¬ Ä‘Ã£ phÃ¡t sinh giao dá»‹ch)' }
    } else {
      await this.db.product.delete({ where: { id } })
      return { success: true, message: 'XÃ³a vÄ©nh viá»…n sáº£n pháº©m thÃ nh cÃ´ng' }
    }
  }

  async restoreProduct(id: string) {
    const product = await this.db.product.findUnique({ where: { id } })
    if (!product) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m')
    if (!product.deletedAt) return { success: true, message: 'Sáº£n pháº©m Ä‘ang á»Ÿ tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng' }

    let restoredSku = product.sku
    if (restoredSku && restoredSku.includes('_deleted_')) {
      restoredSku = restoredSku.split('_deleted_')[0] ?? null
      const existing = await this.db.product.findFirst({ where: { sku: restoredSku, deletedAt: null } })
      if (existing) restoredSku = product.sku || null
    }

    let restoredBarcode = product.barcode
    if (restoredBarcode && restoredBarcode.includes('_deleted_')) {
      restoredBarcode = restoredBarcode.split('_deleted_')[0] ?? null
      const existing = await this.db.product.findFirst({ where: { barcode: restoredBarcode, deletedAt: null } })
      if (existing) restoredBarcode = product.barcode || null
    }

    await this.db.product.update({
      where: { id },
      data: { deletedAt: null, sku: restoredSku || null, barcode: restoredBarcode || null }
    })

    const variants = await this.db.productVariant.findMany({ where: { productId: id } })
    for (const variant of variants) {
      if (!variant.deletedAt) continue
      let vRestoredSku = variant.sku
      if (vRestoredSku && vRestoredSku.includes('_deleted_')) {
        vRestoredSku = vRestoredSku.split('_deleted_')[0] ?? null
        const existing = await this.db.productVariant.findFirst({ where: { sku: vRestoredSku, deletedAt: null } })
        if (existing) vRestoredSku = variant.sku || null
      }
      let vRestoredBarcode = variant.barcode
      if (vRestoredBarcode && vRestoredBarcode.includes('_deleted_')) {
        vRestoredBarcode = vRestoredBarcode.split('_deleted_')[0] ?? null
        const existing = await this.db.productVariant.findFirst({ where: { barcode: vRestoredBarcode, deletedAt: null } })
        if (existing) vRestoredBarcode = variant.barcode || null
      }
      await this.db.productVariant.update({
        where: { id: variant.id },
        data: { deletedAt: null, sku: vRestoredSku || null, barcode: vRestoredBarcode || null }
      })
    }
    return { success: true, message: 'KhÃ´i phá»¥c sáº£n pháº©m thÃ nh cÃ´ng' }
  }

  async batchCreateVariants(productId: string, variants: CreateVariantDto[]) {
    const product = await this.findProductById(productId)
    const created = await this.db.$transaction(
      variants.map((v) =>
        this.db.productVariant.create({ data: { ...prepareVariantPayload(v, product.data?.name), productId } as any }),
      ),
    )
    return { success: true, data: created }
  }

  async updateVariant(vid: string, dto: Partial<CreateVariantDto>) {
    const variant = await this.db.productVariant.findUnique({ where: { id: vid }, include: { product: true } })
    if (!variant) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y phiÃªn báº£n sáº£n pháº©m')
    const updated = await this.db.productVariant.update({
      where: { id: vid },
      data: prepareVariantPayload(dto, variant.product?.name) as any,
    })
    return { success: true, data: updated }
  }

  async removeVariant(vid: string) {
    const variant = await this.db.productVariant.findUnique({ where: { id: vid } })
    if (!variant) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y phiÃªn báº£n sáº£n pháº©m')
    try {
      await this.db.productVariant.delete({ where: { id: vid } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('KhÃ´ng thá»ƒ xoÃ¡ phiÃªn báº£n Ä‘Ã£ phÃ¡t sinh giao dá»‹ch')
      }
      throw error
    }
    return { success: true, message: 'XÃ³a phiÃªn báº£n thÃ nh cÃ´ng' }
  }

  // â”€â”€â”€ Services â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async findAllServices(query: FindServicesDto) {
    const { search, type, page = 1, limit = 20 } = query
    const skip = (Number(page) - 1) * Number(limit)
    const where: any = {}

    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }
    if (type) where.type = type

    const [data, total] = await Promise.all([
      this.db.service.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { variants: true },
      }),
      this.db.service.count({ where }),
    ])

    return { success: true, data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
  }

  async findServiceById(id: string) {
    const service = await this.db.service.findUnique({
      where: { id },
      include: { variants: true },
    })
    if (!service) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y dá»‹ch vá»¥')
    return { success: true, data: service }
  }

  async createService(dto: CreateServiceDto) {
    const service = await this.db.service.create({ data: dto as any })
    return { success: true, data: service }
  }

  async updateService(id: string, dto: UpdateServiceDto) {
    await this.findServiceById(id)
    const updated = await this.db.service.update({ where: { id }, data: dto as any })
    return { success: true, data: updated }
  }

  async removeService(id: string) {
    await this.findServiceById(id)
    await this.db.service.delete({ where: { id } })
    return { success: true, message: 'XÃ³a dá»‹ch vá»¥ thÃ nh cÃ´ng' }
  }

  async batchCreateServiceVariants(serviceId: string, variants: CreateVariantDto[]) {
    await this.findServiceById(serviceId)
    const created = await this.db.$transaction(
      variants.map((v) =>
        this.db.serviceVariant.create({ data: { ...v, serviceId } as any }),
      ),
    )
    return { success: true, data: created }
  }

  async updateServiceVariant(vid: string, dto: Partial<CreateVariantDto>) {
    const variant = await this.db.serviceVariant.findUnique({ where: { id: vid } })
    if (!variant) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y phiÃªn báº£n dá»‹ch vá»¥')
    const updated = await this.db.serviceVariant.update({ where: { id: vid }, data: dto as any })
    return { success: true, data: updated }
  }

  async removeServiceVariant(vid: string) {
    const variant = await this.db.serviceVariant.findUnique({ where: { id: vid } })
    if (!variant) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y phiÃªn báº£n dá»‹ch vá»¥')
    await this.db.serviceVariant.delete({ where: { id: vid } })
    return { success: true, message: 'XÃ³a phiÃªn báº£n dá»‹ch vá»¥ thÃ nh cÃ´ng' }
  }

  // â”€â”€â”€ Dictionaries (Category, Brand, Unit, PriceBook) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async findAllCategories() {
    const data = await this.db.category.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data }
  }

  async createCategory(dto: any) {
    const created = await this.db.category.create({ data: dto })
    return { success: true, data: created }
  }

  async updateCategory(id: string, dto: any) {
    const updated = await this.db.category.update({ where: { id }, data: dto })
    return { success: true, data: updated }
  }

  async removeCategory(id: string) {
    await this.db.category.delete({ where: { id } })
    return { success: true, message: 'XÃ³a danh má»¥c thÃ nh cÃ´ng' }
  }

  async findAllBrands() {
    const data = await this.db.brand.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data }
  }

  async createBrand(dto: any) {
    const created = await this.db.brand.create({ data: dto })
    return { success: true, data: created }
  }

  async updateBrand(id: string, dto: any) {
    const updated = await this.db.brand.update({ where: { id }, data: dto })
    return { success: true, data: updated }
  }

  async removeBrand(id: string) {
    await this.db.brand.delete({ where: { id } })
    return { success: true, message: 'XÃ³a nhÃ£n hiá»‡u thÃ nh cÃ´ng' }
  }

  async findAllUnits() {
    const data = await this.db.unit.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data }
  }

  async createUnit(dto: any) {
    const created = await this.db.unit.create({ data: dto })
    return { success: true, data: created }
  }

  async updateUnit(id: string, dto: any) {
    const updated = await this.db.unit.update({ where: { id }, data: dto })
    return { success: true, data: updated }
  }

  async removeUnit(id: string) {
    await this.db.unit.delete({ where: { id } })
    return { success: true, message: 'XÃ³a Ä‘Æ¡n vá»‹ tÃ­nh thÃ nh cÃ´ng' }
  }

  async findAllPriceBooks() {
    const data = await this.db.priceBook.findMany({ orderBy: { sortOrder: 'asc' } })
    return { success: true, data }
  }

  async createPriceBook(dto: any) {
    const created = await this.db.priceBook.create({ data: dto })
    return { success: true, data: created }
  }

  async updatePriceBook(id: string, dto: any) {
    const updated = await this.db.priceBook.update({ where: { id }, data: dto })
    return { success: true, data: updated }
  }

  async removePriceBook(id: string) {
    await this.db.priceBook.delete({ where: { id } })
    return { success: true, message: 'XÃ³a báº£ng giÃ¡ thÃ nh cÃ´ng' }
  }
}

