import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { HotelService } from './hotel.service.js';
import { CreateHotelStayDto, CreateCageDto } from './dto/create-hotel.dto.js';
import { UpdateHotelStayDto, UpdateCageDto } from './dto/update-hotel.dto.js';
import { JwtGuard } from '../auth/guards/jwt.guard.js';

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

  // STAYS
  @Post('stays')
  createStay(@Body() createStayDto: CreateHotelStayDto) {
    return this.hotelService.createStay(createStayDto);
  }

  @Get('stays')
  findAllStays(@Query() query: any) {
    return this.hotelService.findAllStays(query);
  }

  @Patch('stays/:id')
  updateStay(@Param('id') id: string, @Body() updateStayDto: UpdateHotelStayDto) {
    return this.hotelService.updateStay(id, updateStayDto);
  }

  @Delete('stays/:id')
  deleteStay(@Param('id') id: string) {
    return this.hotelService.deleteStay(id);
  }
}
