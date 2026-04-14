import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { CancelOrderDto } from './dto/cancel-order.dto.js'
import { CompleteOrderDto } from './dto/complete-order.dto.js'
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto.js'
import { CreateOrderDto } from './dto/create-order.dto.js'
import { PayOrderDto } from './dto/pay-order.dto.js'
import { UpdateOrderDto } from './dto/update-order.dto.js'
import { ApproveOrderDto } from './dto/approve-order.dto.js'
import { ExportStockDto } from './dto/export-stock.dto.js'
import { SettleOrderDto } from './dto/settle-order.dto.js'
import { OrdersService } from './orders.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@Controller('orders')
@UseGuards(JwtGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  private getStaffId(req: AuthenticatedRequest): string {
    const staffId = req.user?.userId
    if (!staffId) throw new UnauthorizedException('Thiếu thông tin người dùng trong token')
    return staffId
  }

  @Get('catalog')
  @Permissions('order.read.all', 'order.read.assigned', 'order.create', 'order.update')
  async getCatalog() {
    const products = await this.ordersService.getProducts()
    const services = await this.ordersService.getServices()
    return { products, services }
  }

  @Post()
  @Permissions('order.create')
  async createOrder(@Body() dto: CreateOrderDto, @Req() req: AuthenticatedRequest): Promise<any> {
    try {
      return await this.ordersService.createOrder(dto, this.getStaffId(req))
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error
      }
      console.error('SERVER ERROR IN CREATE ORDER', error)
      throw new InternalServerErrorException(error.message || String(error))
    }
  }

  @Put(':id')
  @Permissions('order.update')
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    try {
      return await this.ordersService.updateOrder(id, dto, this.getStaffId(req), req.user)
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error
      }
      console.error('SERVER ERROR IN UPDATE ORDER', error)
      throw new InternalServerErrorException(error.message || String(error))
    }
  }

  @Patch(':id/pay')
  @Permissions('order.pay')
  payOrder(
    @Param('id') id: string,
    @Body() dto: PayOrderDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.ordersService.payOrder(id, dto, this.getStaffId(req), req.user)
  }

  @Get(':id/payment-intents')
  @Permissions('order.read.all', 'order.read.assigned', 'order.pay')
  getPaymentIntents(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.ordersService.listPaymentIntents(id, req.user)
  }

  @Post(':id/payment-intents')
  @Permissions('order.pay')
  createPaymentIntent(
    @Param('id') id: string,
    @Body() dto: CreatePaymentIntentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.ordersService.createPaymentIntent(id, dto, req.user)
  }

  @Post(':id/complete')
  @Permissions('order.approve', 'order.ship')
  completeOrder(
    @Param('id') id: string,
    @Body() dto: CompleteOrderDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.ordersService.completeOrder(id, dto, this.getStaffId(req), req.user)
  }

  @Post(':id/cancel')
  @Permissions('order.cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.ordersService.cancelOrder(id, dto, this.getStaffId(req), req.user)
  }

  @Delete(':id/items/:itemId')
  @Permissions('order.update')
  removeOrderItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.ordersService.removeOrderItem(id, itemId, req.user)
  }

  @Get()
  @Permissions('order.read.all', 'order.read.assigned')
  getOrders(
    @Query('search') search?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Req() req?: AuthenticatedRequest,
  ): Promise<any> {
    return this.ordersService.findAll({
      search,
      paymentStatus,
      status,
      customerId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      dateFrom,
      dateTo,
    }, req?.user)
  }

  @Get(':id')
  @Permissions('order.read.all', 'order.read.assigned')
  getOrder(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.ordersService.findOne(id, req.user)
  }

  @Post(':id/approve')
  @Permissions('order.approve')
  approveOrder(
    @Param('id') id: string,
    @Body() dto: ApproveOrderDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.ordersService.approveOrder(id, dto, this.getStaffId(req), req.user!)
  }

  @Post(':id/export-stock')
  @Permissions('order.export_stock')
  exportStock(
    @Param('id') id: string,
    @Body() dto: ExportStockDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.ordersService.exportStock(id, dto, this.getStaffId(req), req.user!)
  }

  @Post(':id/settle')
  @Permissions('order.settle')
  settleOrder(
    @Param('id') id: string,
    @Body() dto: SettleOrderDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.ordersService.settleOrder(id, dto, this.getStaffId(req), req.user!)
  }

  @Get(':id/timeline')
  @Permissions('order.read.all', 'order.read.assigned')
  getOrderTimeline(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.ordersService.getOrderTimeline(id, req.user!)
  }
}
