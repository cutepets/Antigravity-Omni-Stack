import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
  UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger'
import { SettingsService, CreateBranchDto, UpdateBranchDto, UpdateConfigDto } from './settings.service'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { randomUUID } from 'crypto'

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'])

@ApiTags('Settings')
@Controller()
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ─── System Configs ───────────────────────────────────────────────────────

  @Get('settings/configs')
  @ApiOperation({ summary: 'Lấy cấu hình hệ thống' })
  getConfigs() {
    return this.settingsService.getConfigs()
  }

  @Put('settings/configs')
  @ApiOperation({ summary: 'Cập nhật cấu hình hệ thống' })
  updateConfigs(@Body() dto: UpdateConfigDto) {
    return this.settingsService.updateConfigs(dto)
  }

  // ─── Branches ─────────────────────────────────────────────────────────────

  @Get('settings/branches')
  @ApiOperation({ summary: 'Danh sách chi nhánh' })
  findAllBranches() {
    return this.settingsService.findAllBranches()
  }

  @Post('settings/branches')
  @ApiOperation({ summary: 'Tạo chi nhánh mới' })
  createBranch(@Body() dto: CreateBranchDto) {
    return this.settingsService.createBranch(dto)
  }

  @Put('settings/branches/:id')
  @ApiOperation({ summary: 'Cập nhật chi nhánh' })
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.settingsService.updateBranch(id, dto)
  }

  @Delete('settings/branches/:id')
  @ApiOperation({ summary: 'Xóa chi nhánh' })
  removeBranch(@Param('id') id: string) {
    return this.settingsService.removeBranch(id)
  }

  // ─── Customer Groups ──────────────────────────────────────────────────────

  @Get('customer-groups')
  @ApiOperation({ summary: 'Danh sách nhóm khách hàng' })
  findAllCustomerGroups() {
    return this.settingsService.findAllCustomerGroups()
  }

  @Post('customer-groups')
  @ApiOperation({ summary: 'Tạo nhóm khách hàng mới' })
  createCustomerGroup(@Body() dto: any) {
    return this.settingsService.createCustomerGroup(dto)
  }

  @Put('customer-groups/:id')
  @ApiOperation({ summary: 'Cập nhật nhóm khách hàng' })
  updateCustomerGroup(@Param('id') id: string, @Body() dto: any) {
    return this.settingsService.updateCustomerGroup(id, dto)
  }

  @Delete('customer-groups/:id')
  @ApiOperation({ summary: 'Xóa nhóm khách hàng' })
  removeCustomerGroup(@Param('id') id: string) {
    return this.settingsService.removeCustomerGroup(id)
  }

  // ─── Activity Logs ────────────────────────────────────────────────────────

  @Get('activity-logs')
  @ApiOperation({ summary: 'Danh sách nhật ký thao tác' })
  findActivityLogs(@Query() query: any): any {
    return this.settingsService.findActivityLogs(query)
  }

  @Get('activity-logs/stats')
  @ApiOperation({ summary: 'Thống kê nhật ký thao tác' })
  getActivityLogStats() {
    return this.settingsService.getActivityLogStats()
  }

  // ─── File Upload ──────────────────────────────────────────────────────────

  @Post('upload/image')
  @ApiOperation({ summary: 'Upload ảnh' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase()
        const mime = (file.mimetype || '').toLowerCase()

        if (!ALLOWED_IMAGE_MIME_TYPES.has(mime) || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
          cb(new BadRequestException('Chỉ chấp nhận file ảnh (jpg, png, webp, gif, svg)') as any, false)
          return
        }

        cb(null, true)
      },
      storage: diskStorage({
        destination: './uploads/images',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname)
          cb(null, `${randomUUID()}${ext}`)
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { success: false, message: 'Không tìm thấy file ảnh' }
    return { success: true, url: `/uploads/images/${file.filename}` }
  }
}
