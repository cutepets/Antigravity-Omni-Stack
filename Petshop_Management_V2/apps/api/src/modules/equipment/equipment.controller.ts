import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { RequireModule } from '../../common/decorators/require-module.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { ModuleGuard } from '../../common/guards/module.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import {
  createMemoryUploadOptions,
  IMAGE_UPLOAD_EXTENSIONS,
  IMAGE_UPLOAD_MIME_TYPES,
} from '../../common/utils/upload.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { StorageService } from '../storage/storage.service.js'
import {
  CreateEquipmentCategoryDto,
  CreateEquipmentDto,
  CreateEquipmentLocationPresetDto,
  EquipmentService,
  FindEquipmentDto,
  ResolveEquipmentScanDto,
  UpdateEquipmentCategoryDto,
  UpdateEquipmentDto,
  UpdateEquipmentLocationPresetDto,
} from './equipment.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@ApiTags('Equipment')
@RequireModule('equipment')
@Controller('equipment')
@UseGuards(JwtGuard, PermissionsGuard, ModuleGuard)
@ApiBearerAuth()
export class EquipmentController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @Permissions('equipment.read')
  @ApiOperation({ summary: 'Danh sach trang thiet bi' })
  findAll(@Query() query: FindEquipmentDto, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.findAll(
      {
        ...query,
        branchId: query.branchId ?? getRequestedBranchId(req),
      },
      req.user,
    )
  }

  @Get('next-code')
  @Permissions('equipment.create')
  @ApiOperation({ summary: 'Goi y ma thiet bi tiep theo' })
  suggestNextCode() {
    return this.equipmentService.suggestNextCode()
  }

  @Get('code/:code')
  @Permissions('equipment.read')
  @ApiOperation({ summary: 'Chi tiet thiet bi theo ma' })
  findByCode(@Param('code') code: string, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.findByCode(code, req.user)
  }

  @Post()
  @Permissions('equipment.create')
  @ApiOperation({ summary: 'Tao thiet bi' })
  create(@Body() dto: CreateEquipmentDto, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.createEquipment(
      {
        ...dto,
        branchId: dto.branchId ?? getRequestedBranchId(req),
      },
      req.user,
    )
  }

  @Patch(':id')
  @Permissions('equipment.update')
  @ApiOperation({ summary: 'Cap nhat thiet bi' })
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.updateEquipment(id, dto, req.user)
  }

  @Post(':id/archive')
  @Permissions('equipment.archive')
  @ApiOperation({ summary: 'Luu tru thiet bi' })
  archive(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.archiveEquipment(id, req.user)
  }

  @Get(':id/history')
  @Permissions('equipment.read')
  @ApiOperation({ summary: 'Lich su cap nhat thiet bi' })
  getHistory(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.getHistory(id, req.user)
  }

  @Post('scan/resolve')
  @Permissions('equipment.scan', 'equipment.read', 'equipment.create')
  @ApiOperation({ summary: 'Resolve ma QR thiet bi' })
  resolveScan(@Body() dto: ResolveEquipmentScanDto, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.resolveScan(dto, req.user)
  }

  @Get('categories/list')
  @Permissions('equipment.read', 'equipment.create', 'equipment.config')
  @ApiOperation({ summary: 'Danh muc loai thiet bi' })
  getCategories() {
    return this.equipmentService.getCategories()
  }

  @Post('categories')
  @Permissions('equipment.config')
  @ApiOperation({ summary: 'Tao loai thiet bi' })
  createCategory(@Body() dto: CreateEquipmentCategoryDto) {
    return this.equipmentService.createCategory(dto)
  }

  @Patch('categories/:id')
  @Permissions('equipment.config')
  @ApiOperation({ summary: 'Cap nhat loai thiet bi' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateEquipmentCategoryDto) {
    return this.equipmentService.updateCategory(id, dto)
  }

  @Get('locations/list')
  @Permissions('equipment.read', 'equipment.create', 'equipment.config')
  @ApiOperation({ summary: 'Preset vi tri theo chi nhanh' })
  getLocations(@Query('branchId') branchId: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.getLocations(branchId ?? getRequestedBranchId(req), req.user)
  }

  @Post('locations')
  @Permissions('equipment.config')
  @ApiOperation({ summary: 'Tao preset vi tri thiet bi' })
  createLocation(@Body() dto: CreateEquipmentLocationPresetDto, @Req() req: AuthenticatedRequest) {
    return this.equipmentService.createLocation(
      {
        ...dto,
        branchId: dto.branchId ?? getRequestedBranchId(req),
      },
      req.user,
    )
  }

  @Patch('locations/:id')
  @Permissions('equipment.config')
  @ApiOperation({ summary: 'Cap nhat preset vi tri thiet bi' })
  updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentLocationPresetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.equipmentService.updateLocation(
      id,
      {
        ...dto,
        branchId: dto.branchId ?? getRequestedBranchId(req),
      },
      req.user,
    )
  }

  @Post('upload-image')
  @Permissions('equipment.create', 'equipment.update')
  @ApiOperation({ summary: 'Upload anh thiet bi' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor(
      'image',
      createMemoryUploadOptions({
        destination: 'uploads/images',
        allowedMimeTypes: IMAGE_UPLOAD_MIME_TYPES,
        allowedExtensions: IMAGE_UPLOAD_EXTENSIONS,
        maxFileSize: 50 * 1024 * 1024,
        errorMessage: 'Chi chap nhan file anh',
      }),
    ),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user?: { userId?: string } },
    @Body('displayName') displayName?: string,
  ) {
    if (!file) {
      return { success: false, message: 'Khong tim thay file anh' }
    }

    const asset = await this.storageService.uploadAsset({
      category: 'image',
      scope: 'equipment',
      fieldName: 'imageUrl',
      displayName: displayName || null,
      uploadedById: req.user?.userId ?? null,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
    })

    return { success: true, url: asset.url }
  }
}
