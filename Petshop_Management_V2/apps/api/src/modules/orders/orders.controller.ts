import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Req, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { CompleteOrderDto } from './dto/complete-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import type { Request } from 'express';
import type { JwtPayload } from '@petshop/shared';

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

@Controller('orders')
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private getStaffId(req: AuthenticatedRequest): string {
    const staffId = req.user?.userId;
    if (!staffId) throw new UnauthorizedException('Thiếu thông tin người dùng trong token');
    return staffId;
  }

  // ─── Catalog ────────────────────────────────────────────────────────────────
  @Get('catalog')
  async getCatalog() {
    const products = await this.ordersService.getProducts();
    const services = await this.ordersService.getServices();
    return { products, services };
  }

  // ─── Create Order ───────────────────────────────────────────────────────────
  @Post()
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: AuthenticatedRequest) {
    try {
      return await this.ordersService.createOrder(dto, this.getStaffId(req));
    } catch (error: any) {
      console.error('SERVER ERROR IN CREATE ORDER', error);
      throw new InternalServerErrorException(error.message || String(error));
    }
  }

  // ─── Pay Order (additional payment) ─────────────────────────────────────────
  @Patch(':id/pay')
  payOrder(
    @Param('id') id: string,
    @Body() dto: PayOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.payOrder(id, dto, this.getStaffId(req));
  }

  // ─── Complete Order ─────────────────────────────────────────────────────────
  @Post(':id/complete')
  completeOrder(
    @Param('id') id: string,
    @Body() dto: CompleteOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.completeOrder(id, dto, this.getStaffId(req));
  }

  // ─── Cancel Order ───────────────────────────────────────────────────────────
  @Post(':id/cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.cancelOrder(id, dto, this.getStaffId(req));
  }

  // ─── Remove Order Item ──────────────────────────────────────────────────────
  @Delete(':id/items/:itemId')
  removeOrderItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordersService.removeOrderItem(id, itemId);
  }

  // ─── List Orders (with filtering) ──────────────────────────────────────────
  @Get()
  getOrders(
    @Query('search') search?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.ordersService.findAll({
      search,
      paymentStatus,
      status,
      customerId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      dateFrom,
      dateTo,
    });
  }

  // ─── Get Single Order ──────────────────────────────────────────────────────
  @Get(':id')
  getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
