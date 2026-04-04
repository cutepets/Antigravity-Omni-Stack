import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface FindReceiptsDto {
  page?: number
  limit?: number
  status?: string
  supplierId?: string
}

export interface ReceiptItemDto {
  productId: string
  quantity: number
  unitCost: number
  notes?: string
}

export interface CreateReceiptDto {
  supplierId?: string
  notes?: string
  items: ReceiptItemDto[]
}

export interface CreateSupplierDto {
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {}

export interface ReturnItemDto {
  productId: string
  quantity: number
  reason?: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class StockService {
  constructor(private readonly db: DatabaseService) {}

  // ─── Receipts ─────────────────────────────────────────────────────────────

  async findAllReceipts(query: FindReceiptsDto) {
    const { page = 1, limit = 20, status, supplierId } = query
    const skip = (Number(page) - 1) * Number(limit)
    const where: any = {}
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    const [data, total] = await Promise.all([
      this.db.stockReceipt.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { supplier: true, items: { include: { product: true } } },
      }),
      this.db.stockReceipt.count({ where }),
    ])

    return { success: true, data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
  }

  async findReceiptById(id: string) {
    const receipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: true } } },
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    return { success: true, data: receipt }
  }

  async createReceipt(dto: CreateReceiptDto) {
    const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
    const receiptNumber = `PO-${Date.now()}` // Tự động sinh mã nhập kho
    const receipt = await this.db.stockReceipt.create({
      data: {
        receiptNumber,
        supplierId: dto.supplierId || null,
        notes: dto.notes || null,
        status: 'DRAFT',
        totalAmount,
        items: { 
          create: dto.items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitCost,
            totalPrice: i.quantity * i.unitCost
          }))
        },
      } as any,
      include: { items: true },
    })
    return { success: true, data: receipt }
  }

  async updateReceipt(id: string, dto: Partial<CreateReceiptDto>) {
    const receipt = await this.db.stockReceipt.findUnique({ where: { id } })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    if ((receipt as any).status !== 'DRAFT') throw new BadRequestException('Chỉ được sửa phiếu ở trạng thái DRAFT')
    const updated = await this.db.stockReceipt.update({ where: { id }, data: dto as any })
    return { success: true, data: updated }
  }

  async payReceipt(id: string) {
    const receipt = await this.db.stockReceipt.findUnique({ where: { id } })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')

    await this.db.$transaction(async (tx) => {
      const amountToPay = receipt.totalAmount - receipt.paidAmount
      await tx.stockReceipt.update({ where: { id }, data: { paymentStatus: 'PAID', paidAmount: receipt.totalAmount } as any })
      if (receipt.supplierId && amountToPay > 0) {
        await tx.supplier.update({
          where: { id: receipt.supplierId },
          data: { debt: { decrement: amountToPay } } as any
        })
      }
    })
    return { success: true, message: 'Đã thanh toán phiếu nhập' }
  }

  async cancelReceipt(id: string) {
    const receipt = await this.db.stockReceipt.findUnique({ where: { id } })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')
    const updated = await this.db.stockReceipt.update({ where: { id }, data: { status: 'CANCELLED' } as any })
    return { success: true, data: updated }
  }

  async receiveReceipt(id: string) {
    const receipt = await this.db.stockReceipt.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập')

    await this.db.$transaction([
      ...((receipt as any).items as any[]).map((item: any) =>
        this.db.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } } as any,
        }),
      ),
      ...((receipt as any).items as any[]).map((item: any) =>
        this.db.stockTransaction.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            reason: 'Nhập hàng',
            referenceId: receipt.id,
          } as any
        }),
      ),
      this.db.stockReceipt.update({
        where: { id },
        data: { status: 'RECEIVED' } as any,
      }),
      // Cập nhật công nợ cho supplier (nếu chưa thanh toán)
      ...(receipt.supplierId ? [
        this.db.supplier.update({
          where: { id: receipt.supplierId },
          data: { debt: { increment: receipt.totalAmount - receipt.paidAmount } } as any
        })
      ] : [])
    ])

    return { success: true, message: 'Nhận hàng thành công, kho đã được cập nhật' }
  }

  async returnReceipt(id: string, returns: ReturnItemDto[]) {
    await this.findReceiptById(id)
    // Deduct stock
    await this.db.$transaction(
      returns.map((r) =>
        this.db.product.update({
          where: { id: r.productId },
          data: { stock: { decrement: r.quantity } } as any,
        }),
      ),
    )
    return { success: true, message: 'Trả hàng thành công' }
  }

  // ─── Stock Transactions ───────────────────────────────────────────────────

  async getTransactionsByProduct(productId: string) {
    const product = await this.db.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm')
    const transactions = await this.db.stockTransaction.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: transactions }
  }

  async getLowStockSuggestions() {
    const products = await this.db.product.findMany({
      where: {
        AND: [
          { minStock: { gt: 0 } },
        ],
      },
    })
    const lowStock = products.filter((p: any) => p.stock <= (p.minStock ?? 0))
    return { success: true, data: lowStock }
  }

  // ─── Suppliers ────────────────────────────────────────────────────────────

  async findAllSuppliers() {
    const suppliers = await this.db.supplier.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data: suppliers }
  }

  async findSupplierById(id: string) {
    const supplier = await this.db.supplier.findUnique({ where: { id } })
    if (!supplier) throw new NotFoundException('Không tìm thấy nhà cung cấp')
    return { success: true, data: supplier }
  }

  async createSupplier(dto: CreateSupplierDto) {
    const supplier = await this.db.supplier.create({ data: dto as any })
    return { success: true, data: supplier }
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.findSupplierById(id)
    const updated = await this.db.supplier.update({ where: { id }, data: dto as any })
    return { success: true, data: updated }
  }
}
