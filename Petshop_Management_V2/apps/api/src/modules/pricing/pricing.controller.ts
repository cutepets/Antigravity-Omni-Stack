import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import {
  createDiskUploadOptions,
  deleteUploadedFile,
  IMAGE_UPLOAD_EXTENSIONS,
  IMAGE_UPLOAD_MIME_TYPES,
  validateUploadedFile,
} from '../../common/utils/upload.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import {
  BulkUpsertHotelDaycareRulesDto,
  BulkUpsertHotelExtraServicesDto,
  BulkUpsertHotelRulesDto,
  BulkUpsertSpaRulesDto,
  CreateHolidayDto,
  CreatePresetWeightBandsDto,
  UpdateHolidayDto,
  UpsertWeightBandDto,
} from './dto/pricing.dto.js'
import { PricingService } from './pricing.service.js'

const MAX_SERVICE_IMAGE_SIZE = 5 * 1024 * 1024

const serviceImageUploadOptions = {
  allowedMimeTypes: IMAGE_UPLOAD_MIME_TYPES,
  allowedExtensions: IMAGE_UPLOAD_EXTENSIONS,
  maxFileSize: MAX_SERVICE_IMAGE_SIZE,
  errorMessage: 'Định dạng ảnh không hợp lệ. Chấp nhận: jpg, png, webp, gif, svg',
}

@Controller('pricing')
@UseGuards(JwtGuard, PermissionsGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) { }

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

  // ─── Spa Service Images ───────────────────────────────────────────────────

  @Get('spa-service-images')
  @Permissions('grooming.read', 'settings.pricing_policy.manage')
  listSpaServiceImages() {
    return this.pricingService.listSpaServiceImages()
  }

  @Post('spa-service-images/:packageCode')
  @Permissions('grooming.update', 'settings.pricing_policy.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createDiskUploadOptions({
        destination: './uploads/spa-services',
        ...serviceImageUploadOptions,
      }),
    }),
  )
  async uploadSpaServiceImage(
    @Param('packageCode') packageCode: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('label') label?: string,
  ) {
    validateUploadedFile(file, { ...serviceImageUploadOptions, requireStoredFilename: true })
    const imageUrl = `/uploads/spa-services/${file.filename}`

    try {
      return await this.pricingService.uploadSpaServiceImage(packageCode, imageUrl, label?.trim())
    } catch (error) {
      try {
        await deleteUploadedFile(imageUrl, {
          publicPrefix: '/uploads/spa-services/',
          rootDir: './uploads/spa-services',
        })
      } catch {
        // Preserve original error when cleanup fails
      }
      throw error
    }
  }

  @Put('spa-service-images')
  @Permissions('grooming.update', 'settings.pricing_policy.manage')
  bulkUpdateSpaServiceImages(@Body() body: { images: Array<{ packageCode: string; imageUrl: string }> }) {
    return this.pricingService.bulkUpdateSpaServiceImages(body.images ?? [])
  }

  // ─── Hotel Rules ──────────────────────────────────────────────────────────

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

  @Get('hotel-daycare-rules')
  @Permissions('hotel.read', 'settings.pricing_policy.manage')
  listHotelDaycareRules(@Query() query: any) {
    return this.pricingService.listHotelDaycareRules(query)
  }

  @Put('hotel-daycare-rules/bulk')
  @Permissions('hotel.update', 'settings.pricing_policy.manage')
  bulkUpsertHotelDaycareRules(@Body() dto: BulkUpsertHotelDaycareRulesDto) {
    return this.pricingService.bulkUpsertHotelDaycareRules(dto)
  }

  @Get('hotel-extra-services')
  @Permissions('hotel.read', 'settings.pricing_policy.manage')
  listHotelExtraServices() {
    return this.pricingService.listHotelExtraServices()
  }

  @Put('hotel-extra-services/bulk')
  @Permissions('hotel.update', 'settings.pricing_policy.manage')
  bulkUpsertHotelExtraServices(@Body() dto: BulkUpsertHotelExtraServicesDto) {
    return this.pricingService.bulkUpsertHotelExtraServices(dto)
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
