import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import {
  BulkUpsertHotelRulesDto,
  BulkUpsertSpaRulesDto,
  CreateHolidayDto,
  CreatePresetWeightBandsDto,
  UpdateHolidayDto,
  UpsertWeightBandDto,
} from './dto/pricing.dto.js'
import { PricingService } from './pricing.service.js'

@Controller('pricing')
@UseGuards(JwtGuard, PermissionsGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('weight-bands')
  @Permissions('hotel.read', 'grooming.read', 'settings.pricing_policy.manage')
  listWeightBands(@Query() query: any) {
    return this.pricingService.listWeightBands(query)
  }

  @Post('weight-bands')
  @Permissions('hotel.update', 'grooming.update', 'settings.pricing_policy.manage')
  upsertWeightBand(@Body() dto: UpsertWeightBandDto) {
    return this.pricingService.upsertWeightBand(dto)
  }

  @Post('weight-bands/presets')
  @Permissions('hotel.update', 'grooming.update', 'settings.pricing_policy.manage')
  createPresetWeightBands(@Body() dto: CreatePresetWeightBandsDto) {
    return this.pricingService.createPresetWeightBands(dto)
  }

  @Delete('weight-bands/:id')
  @Permissions('hotel.update', 'grooming.update', 'settings.pricing_policy.manage')
  deactivateWeightBand(@Param('id') id: string) {
    return this.pricingService.deactivateWeightBand(id)
  }

  @Get('spa-rules')
  @Permissions('grooming.read', 'settings.pricing_policy.manage')
  listSpaRules(@Query() query: any) {
    return this.pricingService.listSpaRules(query)
  }

  @Put('spa-rules/bulk')
  @Permissions('grooming.update', 'settings.pricing_policy.manage')
  bulkUpsertSpaRules(@Body() dto: BulkUpsertSpaRulesDto) {
    return this.pricingService.bulkUpsertSpaRules(dto)
  }

  @Get('hotel-rules')
  @Permissions('hotel.read', 'settings.pricing_policy.manage')
  listHotelRules(@Query() query: any) {
    return this.pricingService.listHotelRules(query)
  }

  @Put('hotel-rules/bulk')
  @Permissions('hotel.update', 'settings.pricing_policy.manage')
  bulkUpsertHotelRules(@Body() dto: BulkUpsertHotelRulesDto) {
    return this.pricingService.bulkUpsertHotelRules(dto)
  }

  @Get('holidays')
  @Permissions('hotel.read', 'settings.pricing_policy.manage')
  listHolidays(@Query() query: any) {
    return this.pricingService.listHolidays(query)
  }

  @Post('holidays')
  @Permissions('hotel.update', 'settings.pricing_policy.manage')
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.pricingService.createHoliday(dto)
  }

  @Patch('holidays/:id')
  @Permissions('hotel.update', 'settings.pricing_policy.manage')
  updateHoliday(@Param('id') id: string, @Body() dto: UpdateHolidayDto) {
    return this.pricingService.updateHoliday(id, dto)
  }

  @Delete('holidays/:id')
  @Permissions('hotel.update', 'settings.pricing_policy.manage')
  deactivateHoliday(@Param('id') id: string) {
    return this.pricingService.deactivateHoliday(id)
  }
}
