import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import {
  StockService,
  FindReceiptsDto, CreateReceiptDto, CreateSupplierDto, UpdateSupplierDto, ReturnItemDto,
} from './stock.service.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'

@ApiTags('Stock')
@Controller('stock')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // ─── Receipts ─────────────────────────────────────────────────────────────

  @Get('receipts')
  @ApiOperation({ summary: 'Danh sách phiếu nhập' })
  findAllReceipts(@Query() query: FindReceiptsDto) {
    return this.stockService.findAllReceipts(query)
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Chi tiết phiếu nhập' })
  findReceiptById(@Param('id') id: string) {
    return this.stockService.findReceiptById(id)
  }

  @Post('receipts')
  @ApiOperation({ summary: 'Tạo phiếu nhập mới' })
  createReceipt(@Body() dto: CreateReceiptDto) {
    return this.stockService.createReceipt(dto)
  }

  @Put('receipts/:id')
  @ApiOperation({ summary: 'Cập nhật phiếu nhập (chỉ DRAFT)' })
  updateReceipt(@Param('id') id: string, @Body() dto: Partial<CreateReceiptDto>) {
    return this.stockService.updateReceipt(id, dto)
  }

  @Patch('receipts/:id/pay')
  @ApiOperation({ summary: 'Thanh toán phiếu nhập' })
  payReceipt(@Param('id') id: string) {
    return this.stockService.payReceipt(id)
  }

  @Patch('receipts/:id/cancel')
  @ApiOperation({ summary: 'Hủy phiếu nhập' })
  cancelReceipt(@Param('id') id: string) {
    return this.stockService.cancelReceipt(id)
  }

  @Patch('receipts/:id/receive')
  @ApiOperation({ summary: 'Nhận hàng — cập nhật tồn kho' })
  receiveReceipt(@Param('id') id: string) {
    return this.stockService.receiveReceipt(id)
  }

  @Post('receipts/:id/returns')
  @ApiOperation({ summary: 'Trả hàng cho nhà cung cấp' })
  returnReceipt(@Param('id') id: string, @Body() body: { items: ReturnItemDto[] }) {
    return this.stockService.returnReceipt(id, body.items)
  }

  // ─── Transactions & Suggestions ──────────────────────────────────────────

  @Get('transactions/:productId')
  @ApiOperation({ summary: 'Lịch sử giao dịch kho của sản phẩm' })
  getTransactions(@Param('productId') productId: string) {
    return this.stockService.getTransactionsByProduct(productId)
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Gợi ý nhập hàng — sản phẩm dưới mức tối thiểu' })
  getSuggestions() {
    return this.stockService.getLowStockSuggestions()
  }

  // ─── Suppliers ────────────────────────────────────────────────────────────

  @Get('suppliers')
  @ApiOperation({ summary: 'Danh sách nhà cung cấp' })
  findAllSuppliers() {
    return this.stockService.findAllSuppliers()
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Chi tiết nhà cung cấp' })
  findSupplierById(@Param('id') id: string) {
    return this.stockService.findSupplierById(id)
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Tạo nhà cung cấp mới' })
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.stockService.createSupplier(dto)
  }

  @Put('suppliers/:id')
  @ApiOperation({ summary: 'Cập nhật nhà cung cấp' })
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.stockService.updateSupplier(id, dto)
  }
}
