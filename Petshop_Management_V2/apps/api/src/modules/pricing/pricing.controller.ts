import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { getRolePermissions, hasAnyPermission, resolvePermissions } from '@petshop/auth'
import type { JwtPayload } from '@petshop/shared'
import type { Response } from 'express'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import {
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
const MAX_PRICING_EXCEL_SIZE = 10 * 1024 * 1024

const pricingExcelUploadOptions = {
  allowedMimeTypes: new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]),
  allowedExtensions: new Set(['.xlsx', '.xls']),
  maxFileSize: MAX_PRICING_EXCEL_SIZE,
  errorMessage: 'Chỉ hỗ trợ file Excel (.xlsx). Kích thước tối đa 10MB.',
}

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

  private assertModePermission(user: JwtPayload | undefined, mode: 'GROOMING' | 'HOTEL', action: 'read' | 'update') {
    if (!user) throw new ForbiddenException('Không có quyền truy cập bảng giá')
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.permissions?.includes('FULL_BRANCH_ACCESS')) return
    const userPermissions = resolvePermissions([
      ...(user.permissions || []),
      ...getRolePermissions(user.role as any),
    ])
    const required = mode === 'HOTEL'
      ? [`hotel.${action}`, 'settings.pricing_policy.manage']
      : [`grooming.${action}`, 'settings.pricing_policy.manage']
    if (!hasAnyPermission(userPermissions, required)) {
      throw new ForbiddenException('Không có quyền thao tác bảng giá này')
    }
  }

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

  @Get('excel-export')
  @Permissions('hotel.read', 'grooming.read', 'settings.pricing_policy.manage')
  async exportPricingExcel(
    @Query('mode') mode: string,
    @Query('year') year: string,
    @Req() req: { user?: JwtPayload },
    @Res() res: Response,
  ) {
    const normalizedMode = String(mode ?? '').toUpperCase() === 'HOTEL' ? 'HOTEL' : 'GROOMING'
    this.assertModePermission(req.user, normalizedMode, 'read')
    const normalizedYear = Math.floor(Number(year ?? new Date().getFullYear()))
    const buffer = await this.pricingService.exportPricingExcel({ mode: normalizedMode, year: normalizedYear })
    const filename = `bang-gia-${normalizedMode.toLowerCase()}-${normalizedYear}-${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Post('excel-import/preview')
  @Permissions('hotel.update', 'grooming.update', 'settings.pricing_policy.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createMemoryUploadOptions({
        destination: 'uploads/pricing-excel',
        ...pricingExcelUploadOptions,
      }),
    }),
  )
  previewPricingExcelImport(
    @UploadedFile() file: Express.Multer.File,
    @Query('mode') mode: string,
    @Query('year') year: string,
    @Req() req: { user?: JwtPayload },
  ) {
    validateUploadedFile(file, pricingExcelUploadOptions)
    const normalizedMode = String(mode ?? '').toUpperCase() === 'HOTEL' ? 'HOTEL' : 'GROOMING'
    this.assertModePermission(req.user, normalizedMode, 'update')
    return this.pricingService.previewPricingExcelImport({
      mode: normalizedMode,
      year: Math.floor(Number(year ?? new Date().getFullYear())),
      buffer: file.buffer,
    })
  }

  @Post('excel-import/apply')
  @Permissions('hotel.update', 'grooming.update', 'settings.pricing_policy.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createMemoryUploadOptions({
        destination: 'uploads/pricing-excel',
        ...pricingExcelUploadOptions,
      }),
    }),
  )
  applyPricingExcelImport(
    @UploadedFile() file: Express.Multer.File,
    @Query('mode') mode: string,
    @Query('year') year: string,
    @Req() req: { user?: JwtPayload },
  ) {
    validateUploadedFile(file, pricingExcelUploadOptions)
    const normalizedMode = String(mode ?? '').toUpperCase() === 'HOTEL' ? 'HOTEL' : 'GROOMING'
    this.assertModePermission(req.user, normalizedMode, 'update')
    return this.pricingService.applyPricingExcelImport({
      mode: normalizedMode,
      year: Math.floor(Number(year ?? new Date().getFullYear())),
      buffer: file.buffer,
    })
  }
}
