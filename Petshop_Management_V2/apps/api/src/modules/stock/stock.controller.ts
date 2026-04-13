import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import {
  CloseReceiptDto,
  CreateReceiptDto,
  CreateReturnReceiptDto,
  CreateSupplierDto,
  FindReceiptsDto,
  FindStockProductsDto,
  PayReceiptDto,
  ReceiveReceiptDto,
  RefundSupplierReturnDto,
  StockService,
  UpdateSupplierDto,
} from './stock.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@ApiTags('Stock')
@Controller('stock')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class StockController {
  constructor(private readonly stockService: StockService) {}

  private getStaffId(req: AuthenticatedRequest): string {
    const staffId = req.user?.userId
    if (!staffId) throw new UnauthorizedException('Thiếu thông tin người dùng trong token')
    return staffId
  }

  @Get('receipts')
  @Permissions('stock_receipt.read')
  @ApiOperation({ summary: 'Danh sách phiếu nhập' })
  findAllReceipts(@Query() query: FindReceiptsDto) {
    return this.stockService.findAllReceipts(query)
  }

  @Get('receipts/:id')
  @Permissions('stock_receipt.read')
  @ApiOperation({ summary: 'Chi tiết phiếu nhập' })
  findReceiptById(@Param('id') id: string) {
    return this.stockService.findReceiptById(id)
  }

  @Post('receipts')
  @Permissions('stock_receipt.create')
  @ApiOperation({ summary: 'Tạo phiếu nhập mới' })
  createReceipt(@Body() dto: CreateReceiptDto) {
    return this.stockService.createReceipt(dto)
  }

  @Put('receipts/:id')
  @Permissions('stock_receipt.update')
  @ApiOperation({ summary: 'Cập nhật phiếu nhập nháp' })
  updateReceipt(@Param('id') id: string, @Body() dto: Partial<CreateReceiptDto>) {
    return this.stockService.updateReceipt(id, dto)
  }

  @Patch('receipts/:id/pay')
  @Permissions('stock_receipt.pay')
  @ApiOperation({ summary: 'Thanh toán phiếu nhập' })
  payReceipt(@Param('id') id: string, @Body() dto: PayReceiptDto, @Req() req: AuthenticatedRequest) {
    return this.stockService.payReceipt(id, this.getStaffId(req), dto)
  }

  @Post('receipts/:id/payments')
  @Permissions('stock_receipt.pay')
  @ApiOperation({ summary: 'Tạo đợt thanh toán cho phiếu nhập' })
  createReceiptPayment(@Param('id') id: string, @Body() dto: PayReceiptDto, @Req() req: AuthenticatedRequest) {
    return this.stockService.payReceipt(id, this.getStaffId(req), dto)
  }

  @Post('suppliers/:supplierId/payments')
  @Permissions('stock_receipt.pay')
  @ApiOperation({ summary: 'Tạo thanh toán NCC độc lập hoặc trả trước' })
  createSupplierPayment(@Param('supplierId') supplierId: string, @Body() dto: PayReceiptDto, @Req() req: AuthenticatedRequest) {
    return this.stockService.createSupplierPayment(supplierId, this.getStaffId(req), dto)
  }

  @Patch('receipts/:id/cancel')
  @Permissions('stock_receipt.cancel')
  @ApiOperation({ summary: 'Hủy phiếu nhập' })
  cancelReceipt(@Param('id') id: string) {
    return this.stockService.cancelReceipt(id)
  }

  @Patch('receipts/:id/receive')
  @Permissions('stock_receipt.receive')
  @ApiOperation({ summary: 'Nhận hàng vào kho' })
  receiveReceipt(@Param('id') id: string, @Body() dto: ReceiveReceiptDto, @Req() req: AuthenticatedRequest) {
    return this.stockService.receiveReceipt(id, dto, this.getStaffId(req))
  }

  @Post('receipts/:id/receivings')
  @Permissions('stock_receipt.receive')
  @ApiOperation({ summary: 'Ghi nhận một đợt nhập hàng cho phiếu nhập' })
  createReceiptReceiving(@Param('id') id: string, @Body() dto: ReceiveReceiptDto, @Req() req: AuthenticatedRequest) {
    return this.stockService.receiveReceipt(id, dto, this.getStaffId(req))
  }

  @Post('receipts/:id/close')
  @Permissions('stock_receipt.update')
  @ApiOperation({ summary: 'Chốt thiếu phiếu nhập' })
  closeReceipt(@Param('id') id: string, @Body() dto: CloseReceiptDto) {
    return this.stockService.shortCloseReceipt(id, dto)
  }

  @Post('receipts/:id/returns')
  @Permissions('stock_receipt.return')
  @ApiOperation({ summary: 'Trả hàng cho nhà cung cấp' })
  returnReceipt(@Param('id') id: string, @Body() body: CreateReturnReceiptDto, @Req() req: AuthenticatedRequest) {
    return this.stockService.returnReceipt(id, body, this.getStaffId(req))
  }

  @Post('returns/:id/refunds')
  @Permissions('stock_receipt.return')
  @ApiOperation({ summary: 'Ghi nhận NCC hoàn tiền sau khi trả hàng' })
  refundSupplierReturn(@Param('id') id: string, @Body() dto: RefundSupplierReturnDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.stockService.refundSupplierReturn(id, this.getStaffId(req), dto)
  }

  @Get('transactions/:productId')
  @Permissions('stock_receipt.read')
  @ApiOperation({ summary: 'Lịch sử giao dịch kho của sản phẩm' })
  getTransactions(@Param('productId') productId: string) {
    return this.stockService.getTransactionsByProduct(productId)
  }

  @Get('suggestions')
  @Permissions('stock_receipt.read')
  @ApiOperation({ summary: 'Gợi ý nhập hàng' })
  getSuggestions() {
    return this.stockService.getLowStockSuggestions()
  }

  @Get('products')
  @Permissions('stock_receipt.read')
  @ApiOperation({ summary: 'Danh sach ton kho tong hop' })
  findInventoryProducts(@Query() query: FindStockProductsDto) {
    return this.stockService.findInventoryProducts(query)
  }

  @Get('suppliers')
  @Permissions('supplier.read')
  @ApiOperation({ summary: 'Danh sách nhà cung cấp' })
  findAllSuppliers(): Promise<any> {
    return this.stockService.findAllSuppliers()
  }

  @Get('suppliers/:id')
  @Permissions('supplier.read')
  @ApiOperation({ summary: 'Chi tiết nhà cung cấp' })
  findSupplierById(@Param('id') id: string): Promise<any> {
    return this.stockService.findSupplierById(id)
  }

  @Post('suppliers')
  @Permissions('supplier.create')
  @ApiOperation({ summary: 'Tạo nhà cung cấp mới' })
  createSupplier(@Body() dto: CreateSupplierDto): Promise<any> {
    return this.stockService.createSupplier(dto)
  }

  @Put('suppliers/:id')
  @Permissions('supplier.update')
  @ApiOperation({ summary: 'Cập nhật nhà cung cấp' })
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto): Promise<any> {
    return this.stockService.updateSupplier(id, dto)
  }
}
