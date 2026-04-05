import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { ReportsService, FindTransactionsDto, CreateTransactionDto, UpdateTransactionDto } from './reports.service.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtGuard)
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
  @ApiOperation({ summary: 'KPI Dashboard tổng quan' })
  getDashboard() {
    return this.reportsService.getDashboard()
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Biểu đồ doanh thu theo ngày' })
  getRevenueChart(@Query('days') days: string) {
    return this.reportsService.getRevenueChart(Number(days) || 7)
  }

  @Get('top-customers')
  @ApiOperation({ summary: 'Top khách hàng chi tiêu nhiều nhất' })
  getTopCustomers(@Query('limit') limit: string) {
    return this.reportsService.getTopCustomers(Number(limit) || 10)
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top sản phẩm bán chạy nhất' })
  getTopProducts(@Query('limit') limit: string) {
    return this.reportsService.getTopProducts(Number(limit) || 10)
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Danh sách thu/chi (Sổ quỹ)' })
  findTransactions(@Query() query: FindTransactionsDto) {
    return this.reportsService.findTransactions(query)
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Tạo phiếu thu/chi thủ công' })
  createTransaction(@Body() dto: CreateTransactionDto, @Req() req: AuthenticatedRequest) {
    return this.reportsService.createTransaction(dto, this.getStaffId(req))
  }

  @Patch('transactions/:id')
  @ApiOperation({ summary: 'Cập nhật phiếu thu/chi thủ công' })
  updateTransaction(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.updateTransaction(id, dto, this.getStaffId(req))
  }

  @Delete('transactions/:id')
  @ApiOperation({ summary: 'Xóa phiếu thu/chi thủ công' })
  removeTransaction(@Param('id') id: string) {
    return this.reportsService.removeTransaction(id)
  }

  @Get('transactions/:voucherNumber')
  @ApiOperation({ summary: 'Tìm phiếu thu/chi theo số chứng từ' })
  findTransactionByVoucher(@Param('voucherNumber') voucherNumber: string) {
    return this.reportsService.findTransactionByVoucher(voucherNumber)
  }
}
