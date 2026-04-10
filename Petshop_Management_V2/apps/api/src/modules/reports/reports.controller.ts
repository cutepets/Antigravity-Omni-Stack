import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import {
  CreateTransactionDto,
  FindTransactionsDto,
  ReportsService,
  UpdateTransactionDto,
} from './reports.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private getStaffId(req: AuthenticatedRequest): string {
    const staffId = req.user?.userId
    if (!staffId) {
      throw new UnauthorizedException('Thiếu thông tin người dùng trong token')
    }
    return staffId
  }

  @Get('dashboard')
  @Permissions('dashboard.read')
  @ApiOperation({ summary: 'KPI dashboard tổng quan' })
  getDashboard(@Req() req: AuthenticatedRequest) {
    return this.reportsService.getDashboard(req.user, getRequestedBranchId(req))
  }

  @Get('revenue-chart')
  @Permissions('report.sales')
  @ApiOperation({ summary: 'Biểu đồ doanh thu theo ngày' })
  getRevenueChart(
    @Query('days') days: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.getRevenueChart(Number(days) || 7, req.user, getRequestedBranchId(req), dateFrom, dateTo)
  }

  @Get('top-customers')
  @Permissions('report.customer')
  @ApiOperation({ summary: 'Top khách hàng chi tiêu cao' })
  getTopCustomers(
    @Query('limit') limit: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.getTopCustomers(Number(limit) || 10, req.user, getRequestedBranchId(req), dateFrom, dateTo)
  }

  @Get('top-products')
  @Permissions('report.sales')
  @ApiOperation({ summary: 'Top sản phẩm bán chạy' })
  getTopProducts(
    @Query('limit') limit: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.getTopProducts(Number(limit) || 10, req.user, getRequestedBranchId(req), dateFrom, dateTo)
  }

  @Get('purchases/summary')
  @Permissions('report.purchase', 'report.debt')
  @ApiOperation({ summary: 'Bao cao tong hop mua hang theo nha cung cap' })
  getPurchaseSummary(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.getPurchaseSummary(req.user, getRequestedBranchId(req), dateFrom, dateTo)
  }

  @Get('inventory/health')
  @Permissions('report.inventory')
  @ApiOperation({ summary: 'Bao cao suc khoe ton kho va hang sap thieu' })
  getInventoryHealth(@Req() req: AuthenticatedRequest) {
    return this.reportsService.getInventoryHealth(req.user, getRequestedBranchId(req))
  }

  @Get('debts/summary')
  @Permissions('report.debt')
  @ApiOperation({ summary: 'Bao cao tong hop cong no khach hang va nha cung cap' })
  getDebtSummary(
    @Query('limit') limit: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.getDebtSummary(Number(limit) || 100, req.user, getRequestedBranchId(req), dateFrom, dateTo)
  }

  @Get('transactions')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Danh sách thu chi sổ quỹ' })
  findTransactions(@Query() query: FindTransactionsDto, @Req() req: AuthenticatedRequest) {
    return this.reportsService.findTransactions(query, req.user, getRequestedBranchId(req))
  }

  @Post('transactions')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Tạo phiếu thu chi thủ công' })
  createTransaction(@Body() dto: CreateTransactionDto, @Req() req: AuthenticatedRequest) {
    return this.reportsService.createTransaction(dto, this.getStaffId(req), req.user, getRequestedBranchId(req))
  }

  @Post('transactions/upload')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Tải lên ảnh đính kèm phiếu thu chi' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/finance'
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true })
          }
          cb(null, uploadPath)
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID()
          const ext = file.originalname.split('.').pop()
          cb(null, `${uniqueSuffix}.${ext}`)
        },
      }),
    }),
  )
  uploadTransactionAttachment(
    @Req() req: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })], // 10MB limit for receipts
      }),
    )
    file: Express.Multer.File,
  ) {
    const attachmentUrl = `/uploads/finance/${file.filename}`
    return { success: true, data: { attachmentUrl } }
  }

  @Patch('transactions/:id')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Cập nhật phiếu thu chi thủ công' })
  updateTransaction(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.updateTransaction(id, dto, this.getStaffId(req), req.user, getRequestedBranchId(req))
  }

  @Delete('transactions/:id')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Xóa phiếu thu chi thủ công' })
  removeTransaction(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.reportsService.removeTransaction(id, req.user)
  }

  @Get('transactions/by-voucher/:voucherNumber')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Tìm phiếu thu chi theo số chứng từ' })
  findTransactionByVoucher(@Param('voucherNumber') voucherNumber: string, @Req() req: AuthenticatedRequest) {
    return this.reportsService.findTransactionByVoucher(voucherNumber, req.user)
  }
}
