import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ReportsService, FindTransactionsDto, CreateTransactionDto } from './reports.service.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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

  // ─── Finance / Sổ quỹ ─────────────────────────────────────────────────────
  // NOTE: specific routes MUST be declared before /:voucherNumber wildcard

  @Get('transactions')
  @ApiOperation({ summary: 'Danh sách thu/chi (Sổ quỹ)' })
  findTransactions(@Query() query: FindTransactionsDto) {
    return this.reportsService.findTransactions(query)
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Tạo phiếu thu/chi' })
  createTransaction(@Body() dto: CreateTransactionDto) {
    return this.reportsService.createTransaction(dto)
  }

  @Get('transactions/:voucherNumber')
  @ApiOperation({ summary: 'Tìm phiếu thu/chi theo số chứng từ' })
  findTransactionByVoucher(@Param('voucherNumber') voucherNumber: string) {
    return this.reportsService.findTransactionByVoucher(voucherNumber)
  }
}
