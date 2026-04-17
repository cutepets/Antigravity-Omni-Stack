import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { Prisma } from '@petshop/database'
import { DatabaseService } from '../../database/database.service.js'

function normalizeSearchValue(value?: string | null) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
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
      .map((variant: Record<string, any>) =>
        [
          variant.name,
          variant.sku,
          variant.barcode,
          variant.conversions,
          variant.pricePolicies,
          variant.priceBookPrices,
        ]
          .filter(Boolean)
          .join(' '),
      )
      .join(' ')
    : ''

  return normalizeSearchValue(
    [
      product.name,
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

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface FindProductsDto {
  search?: string
  category?: string
  brand?: string
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
  sku: string
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

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) { }

  // ─── Products ─────────────────────────────────────────────────────────────

  async findAllProducts(query: FindProductsDto) {
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
        // @ts-ignore — Prisma nested include type limitation: `variants.include.branchStocks` not reflected in generated types
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
          // @ts-ignore — Prisma nested include type limitation: `variants.include.branchStocks` not reflected in generated types
          include: { variants: { include: { branchStocks: true } }, branchStocks: true },
        }),
        this.db.product.count({ where }),
      ])
    }

    return { success: true, data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
  }

  async findProductById(id: string) {
    const product = await this.db.product.findUnique({
      where: { id },
      // @ts-ignore — Prisma nested include type limitation: `variants.include.branchStocks.include.branch` not reflected
      include: {
        variants: { include: { branchStocks: { include: { branch: true } } } },
        branchStocks: { include: { branch: true } },
      },
    })
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm')
    return { success: true, data: product }
  }

  async createProduct(dto: CreateProductDto) {
    if (dto.sku) {
      const exists = await this.db.product.findFirst({ where: { sku: dto.sku } })
      if (exists) throw new ConflictException('Mã SKU đã tồn tại')
    }
    const product = await this.db.product.create({ data: dto as any })
    return { success: true, data: product }
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.findProductById(id)
    if (dto.sku) {
      const exists = await this.db.product.findFirst({ where: { sku: dto.sku, id: { not: id } } })
      if (exists) throw new ConflictException('Mã SKU đã tồn tại')
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
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm')

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
      // Cập nhật các variants nếu có
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
      return { success: true, message: 'Đã ẩn sản phẩm vào danh sách đã xoá (vì đã phát sinh giao dịch)' }
    } else {
      await this.db.product.delete({ where: { id } })
      return { success: true, message: 'Xóa vĩnh viễn sản phẩm thành công' }
    }
  }

  async restoreProduct(id: string) {
    const product = await this.db.product.findUnique({ where: { id } })
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm')
    if (!product.deletedAt) return { success: true, message: 'Sản phẩm đang ở trạng thái hoạt động' }

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
    return { success: true, message: 'Khôi phục sản phẩm thành công' }
  }

  async batchCreateVariants(productId: string, variants: CreateVariantDto[]) {
    await this.findProductById(productId)
    const created = await this.db.$transaction(
      variants.map((v) =>
        this.db.productVariant.create({ data: { ...v, productId } as any }),
      ),
    )
    return { success: true, data: created }
  }

  async updateVariant(vid: string, dto: Partial<CreateVariantDto>) {
    const variant = await this.db.productVariant.findUnique({ where: { id: vid } })
    if (!variant) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm')
    const updated = await this.db.productVariant.update({ where: { id: vid }, data: dto as any })
    return { success: true, data: updated }
  }

  async removeVariant(vid: string) {
    const variant = await this.db.productVariant.findUnique({ where: { id: vid } })
    if (!variant) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm')
    try {
      await this.db.productVariant.delete({ where: { id: vid } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('Không thể xoá phiên bản đã phát sinh giao dịch')
      }
      throw error
    }
    return { success: true, message: 'Xóa phiên bản thành công' }
  }

  // ─── Services ─────────────────────────────────────────────────────────────

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
    if (!service) throw new NotFoundException('Không tìm thấy dịch vụ')
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
    return { success: true, message: 'Xóa dịch vụ thành công' }
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
    if (!variant) throw new NotFoundException('Không tìm thấy phiên bản dịch vụ')
    const updated = await this.db.serviceVariant.update({ where: { id: vid }, data: dto as any })
    return { success: true, data: updated }
  }

  async removeServiceVariant(vid: string) {
    const variant = await this.db.serviceVariant.findUnique({ where: { id: vid } })
    if (!variant) throw new NotFoundException('Không tìm thấy phiên bản dịch vụ')
    await this.db.serviceVariant.delete({ where: { id: vid } })
    return { success: true, message: 'Xóa phiên bản dịch vụ thành công' }
  }

  // ─── Dictionaries (Category, Brand, Unit, PriceBook) ─────────────────────

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
    return { success: true, message: 'Xóa danh mục thành công' }
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
    return { success: true, message: 'Xóa nhãn hiệu thành công' }
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
    return { success: true, message: 'Xóa đơn vị tính thành công' }
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
    return { success: true, message: 'Xóa bảng giá thành công' }
  }
}
