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
  createMemoryUploadOptions,
  IMAGE_UPLOAD_EXTENSIONS,
  IMAGE_UPLOAD_MIME_TYPES,
  validateUploadedFile,
} from '../../common/utils/upload.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { StorageService } from '../storage/storage.service.js'
import {
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
  constructor(
    private readonly pricingService: PricingService,
    private readonly storageService: StorageService,
  ) { }

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
      ...createMemoryUploadOptions({
        destination: 'uploads/spa-services',
        ...serviceImageUploadOptions,
      }),
    }),
  )
  async uploadSpaServiceImage(
    @Param('packageCode') packageCode: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('label') label?: string,
    @Body('species') species?: string,
  ) {
    validateUploadedFile(file, serviceImageUploadOptions)
    const asset = await this.storageService.uploadAsset({
      category: 'image',
      scope: 'services',
      ownerType: 'SPA_SERVICE_IMAGE',
      ownerId: `${species?.trim() || 'all'}:${packageCode}`,
      fieldName: 'imageUrl',
      displayName: label?.trim() || packageCode,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
    })

    try {
      return await this.pricingService.uploadSpaServiceImage(packageCode, asset.url, label?.trim(), species?.trim())
    } catch (error) {
      try {
        await this.storageService.unbindAssetReference({
          assetUrl: asset.url,
          entityType: 'SPA_SERVICE_IMAGE',
          entityId: `${species?.trim() || 'all'}:${packageCode}`,
          fieldName: 'imageUrl',
        })
      } catch {
        // Preserve original error when cleanup fails
      }
      throw error
    }
  }

  @Put('spa-service-images')
  @Permissions('grooming.update', 'settings.pricing_policy.manage')
  bulkUpdateSpaServiceImages(@Body() body: { images: Array<{ species?: string | null; packageCode: string; imageUrl: string }> }) {
    return this.pricingService.bulkUpdateSpaServiceImages(body.images ?? [])
  }

  @Get('hotel-service-images')
  @Permissions('hotel.read', 'settings.pricing_policy.manage')
  listHotelServiceImages() {
    return this.pricingService.listHotelServiceImages()
  }

  @Post('hotel-service-images/:species')
  @Permissions('hotel.update', 'settings.pricing_policy.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createMemoryUploadOptions({
        destination: 'uploads/pricing-services',
        ...serviceImageUploadOptions,
      }),
    }),
  )
  async uploadHotelServiceImage(
    @Param('species') species: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('label') label?: string,
  ) {
    validateUploadedFile(file, serviceImageUploadOptions)
    const asset = await this.storageService.uploadAsset({
      category: 'image',
      scope: 'services',
      ownerType: 'HOTEL_SERVICE_IMAGE',
      ownerId: species,
      fieldName: 'imageUrl',
      displayName: label?.trim() || species,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
    })

    try {
      return await this.pricingService.uploadHotelServiceImage(species, asset.url, label?.trim())
    } catch (error) {
      try {
        await this.storageService.unbindAssetReference({
          assetUrl: asset.url,
          entityType: 'HOTEL_SERVICE_IMAGE',
          entityId: species,
          fieldName: 'imageUrl',
        })
      } catch {
        // Preserve original error when cleanup fails
      }
      throw error
    }
  }

  @Put('hotel-service-images')
  @Permissions('hotel.update', 'settings.pricing_policy.manage')
  bulkUpdateHotelServiceImages(@Body() body: { images: Array<{ species?: string | null; packageCode?: string | null; imageUrl: string; label?: string | null }> }) {
    return this.pricingService.bulkUpdateHotelServiceImages(body.images ?? [])
  }

  @Post('service-images/upload')
  @Permissions('hotel.update', 'grooming.update', 'settings.pricing_policy.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createMemoryUploadOptions({
        destination: 'uploads/pricing-services',
        ...serviceImageUploadOptions,
      }),
    }),
  )
  async uploadPricingServiceImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('displayName') displayName?: string,
  ) {
    validateUploadedFile(file, serviceImageUploadOptions)
    const asset = await this.storageService.uploadAsset({
      category: 'image',
      scope: 'services',
      fieldName: 'imageUrl',
      displayName: displayName || null,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
    })
    return { imageUrl: asset.url, assetId: asset.id, reused: Boolean((asset as any).reused) }
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

  // ─── Excel Export / Import ──────────────────────────────────────────────

  @Get('export/xlsx')
  @Permissions('settings.pricing_policy.manage')
  async exportExcel(@Query('type') type: string, @Query() _query: any) {
    const normalizedType = (type === 'grooming' || type === 'hotel') ? type : 'all' as const
    const buffer = await this.pricingService.exportToExcel(normalizedType)
    return {
      buffer: buffer.toString('base64'),
      filename: `bang-gia-${normalizedType}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    }
  }

  @Post('import/xlsx')
  @Permissions('settings.pricing_policy.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createDiskUploadOptions({
        destination: './uploads/temp',
        allowedMimeTypes: new Set([
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ]),
        allowedExtensions: new Set(['.xlsx', '.xls']),
        maxFileSize: 10 * 1024 * 1024,
        errorMessage: 'Chỉ hỗ trợ file Excel (.xlsx). Kích thước tối đa 10MB.',
      }),
    }),
  )
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    validateUploadedFile(file, {
      allowedMimeTypes: new Set([
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ]),
      allowedExtensions: new Set(['.xlsx', '.xls']),
      maxFileSize: 10 * 1024 * 1024,
      errorMessage: 'Chỉ hỗ trợ file Excel (.xlsx)',
      requireStoredFilename: true,
    })
    const fs = await import('fs/promises')
    const buffer = await fs.readFile(file.path)
    const result = await this.pricingService.importFromExcel(buffer)
    // Clean up temp file
    try { await fs.unlink(file.path) } catch { /* ignore */ }
    return result
  }
}
