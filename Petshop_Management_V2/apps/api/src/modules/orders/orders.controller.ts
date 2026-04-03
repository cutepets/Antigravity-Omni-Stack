import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';

@Controller('orders')
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('catalog')
  async getCatalog() {
    // Quick cheat for getting POS items
    const products = await this.ordersService.getProducts();
    const services = await this.ordersService.getServices();
    return { products, services };
  }

  @Post()
  createOrder(@Body() dto: CreateOrderDto, @Req() req: any) {
    const staffId = req.user?.sub || req.user?.id || dto.staffId;
    return this.ordersService.createOrder(dto, staffId);
  }

  @Get()
  getOrders() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
