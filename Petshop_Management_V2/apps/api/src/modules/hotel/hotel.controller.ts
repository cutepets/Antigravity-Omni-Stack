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
  UseGuards,
} from '@nestjs/common'
import type { PaymentStatus } from '@petshop/database'
import type { JwtPayload } from '@petshop/shared'
import type { Request } from 'express'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import {
  CreateCageDto,
  CreateHotelRateTableDto,
  CreateHotelStayDto,
} from './dto/create-hotel.dto.js'
import {
  CalculateHotelPriceDto,
  CheckoutHotelStayDto,
  UpdateCageDto,
  UpdateHotelRateTableDto,
  UpdateHotelStayDto,
} from './dto/update-hotel.dto.js'
import { HotelService } from './hotel.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@Controller('hotel')
@UseGuards(JwtGuard, PermissionsGuard)
export class HotelController {
  constructor(private readonly hotelService: HotelService) { }

  @Post('cages')
  @Permissions('hotel.create')
  createCage(@Body() createCageDto: CreateCageDto) {
    return this.hotelService.createCage(createCageDto)
  }

  @Get('cages')
  @Permissions('hotel.read')
  findAllCages(): Promise<any> {
    return this.hotelService.findAllCages()
  }

  @Patch('cages/reorder')
  @Permissions('hotel.update')
  reorderCages(@Body('cageIds') cageIds: string[]) {
    return this.hotelService.reorderCages(cageIds)
  }

  @Patch('cages/:id')
  @Permissions('hotel.update')
  updateCage(@Param('id') id: string, @Body() updateCageDto: UpdateCageDto) {
    return this.hotelService.updateCage(id, updateCageDto)
  }

  @Delete('cages/:id')
  @Permissions('hotel.cancel')
  deleteCage(@Param('id') id: string) {
    return this.hotelService.deleteCage(id)
  }

  @Post('rate-tables')
  @Permissions('hotel.create')
  createRateTable(@Body() createHotelRateTableDto: CreateHotelRateTableDto) {
    return this.hotelService.createRateTable(createHotelRateTableDto)
  }

  @Get('rate-tables')
  @Permissions('hotel.read')
  findAllRateTables(@Query() query: any) {
    return this.hotelService.findAllRateTables(query)
  }

  @Get('rate-tables/:id')
  @Permissions('hotel.read')
  findRateTableById(@Param('id') id: string) {
    return this.hotelService.findRateTableById(id)
  }

  @Patch('rate-tables/:id')
  @Permissions('hotel.update')
  updateRateTable(@Param('id') id: string, @Body() updateHotelRateTableDto: UpdateHotelRateTableDto) {
    return this.hotelService.updateRateTable(id, updateHotelRateTableDto)
  }

  @Delete('rate-tables/:id')
  @Permissions('hotel.cancel')
  deleteRateTable(@Param('id') id: string) {
    return this.hotelService.deleteRateTable(id)
  }

  @Post('stays')
  @Permissions('hotel.create', 'hotel.checkin')
  createStay(@Body() createStayDto: CreateHotelStayDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.createStay(createStayDto, req.user, getRequestedBranchId(req))
  }

  @Get('stays')
  @Permissions('hotel.read')
  findAllStays(@Query() query: any, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.findAllStays(query, req.user, getRequestedBranchId(req))
  }

  @Get('stays/code/:code')
  @Permissions('hotel.read')
  findStayByCode(@Param('code') code: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.findStayByCode(code, req.user)
  }

  @Get('stays/:id')
  @Permissions('hotel.read')
  findStayById(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.findStayById(id, req.user)
  }

  @Get('stays/:id/timeline')
  @Permissions('hotel.read')
  findStayTimeline(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.findStayTimeline(id, req.user)
  }

  @Patch('stays/:id')
  @Permissions('hotel.update')
  updateStay(@Param('id') id: string, @Body() updateStayDto: UpdateHotelStayDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.updateStay(id, updateStayDto, req.user, getRequestedBranchId(req))
  }

  @Patch('stays/:id/payment')
  @Permissions('hotel.update')
  updateStayPayment(@Param('id') id: string, @Body('paymentStatus') paymentStatus: PaymentStatus, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.updateStayPayment(id, paymentStatus, req.user)
  }

  @Post('stays/:id/checkout')
  @Permissions('hotel.checkout')
  checkoutStay(@Param('id') id: string, @Body() checkoutStayDto: CheckoutHotelStayDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.checkoutStay(id, checkoutStayDto, req.user)
  }

  @Delete('stays/:id')
  @Permissions('hotel.cancel')
  deleteStay(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.hotelService.deleteStay(id, req.user)
  }

  @Post('calculate')
  @Permissions('hotel.read', 'hotel.create')
  calculatePrice(@Body() calculateHotelPriceDto: CalculateHotelPriceDto) {
    return this.hotelService.calculatePrice(calculateHotelPriceDto)
  }
}
