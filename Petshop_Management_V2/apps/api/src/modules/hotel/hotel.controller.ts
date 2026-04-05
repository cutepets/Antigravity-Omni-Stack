import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { HotelService } from './hotel.service.js';
import { CreateHotelRateTableDto, CreateHotelStayDto, CreateCageDto } from './dto/create-hotel.dto.js';
import { CalculateHotelPriceDto, CheckoutHotelStayDto, UpdateHotelRateTableDto, UpdateHotelStayDto, UpdateCageDto } from './dto/update-hotel.dto.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import type { PaymentStatus } from '@petshop/database';

@Controller('hotel')
@UseGuards(JwtGuard)
export class HotelController {
  constructor(private readonly hotelService: HotelService) {}

  // CAGES
  @Post('cages')
  createCage(@Body() createCageDto: CreateCageDto) {
    return this.hotelService.createCage(createCageDto);
  }

  @Get('cages')
  findAllCages() {
    return this.hotelService.findAllCages();
  }

  @Patch('cages/:id')
  updateCage(@Param('id') id: string, @Body() updateCageDto: UpdateCageDto) {
    return this.hotelService.updateCage(id, updateCageDto);
  }

  @Delete('cages/:id')
  deleteCage(@Param('id') id: string) {
    return this.hotelService.deleteCage(id);
  }

  // RATE TABLES
  @Post('rate-tables')
  createRateTable(@Body() createHotelRateTableDto: CreateHotelRateTableDto) {
    return this.hotelService.createRateTable(createHotelRateTableDto);
  }

  @Get('rate-tables')
  findAllRateTables(@Query() query: any) {
    return this.hotelService.findAllRateTables(query);
  }

  @Get('rate-tables/:id')
  findRateTableById(@Param('id') id: string) {
    return this.hotelService.findRateTableById(id);
  }

  @Patch('rate-tables/:id')
  updateRateTable(@Param('id') id: string, @Body() updateHotelRateTableDto: UpdateHotelRateTableDto) {
    return this.hotelService.updateRateTable(id, updateHotelRateTableDto);
  }

  @Delete('rate-tables/:id')
  deleteRateTable(@Param('id') id: string) {
    return this.hotelService.deleteRateTable(id);
  }

  // STAYS
  @Post('stays')
  createStay(@Body() createStayDto: CreateHotelStayDto) {
    return this.hotelService.createStay(createStayDto);
  }

  @Get('stays')
  findAllStays(@Query() query: any) {
    return this.hotelService.findAllStays(query);
  }

  @Get('stays/:id')
  findStayById(@Param('id') id: string) {
    return this.hotelService.findStayById(id);
  }

  @Patch('stays/:id')
  updateStay(@Param('id') id: string, @Body() updateStayDto: UpdateHotelStayDto) {
    return this.hotelService.updateStay(id, updateStayDto);
  }

  @Patch('stays/:id/payment')
  updateStayPayment(@Param('id') id: string, @Body('paymentStatus') paymentStatus: PaymentStatus) {
    return this.hotelService.updateStayPayment(id, paymentStatus);
  }

  @Post('stays/:id/checkout')
  checkoutStay(@Param('id') id: string, @Body() checkoutStayDto: CheckoutHotelStayDto) {
    return this.hotelService.checkoutStay(id, checkoutStayDto);
  }

  @Delete('stays/:id')
  deleteStay(@Param('id') id: string) {
    return this.hotelService.deleteStay(id);
  }

  @Post('calculate')
  calculatePrice(@Body() calculateHotelPriceDto: CalculateHotelPriceDto) {
    return this.hotelService.calculatePrice(calculateHotelPriceDto);
  }
}
