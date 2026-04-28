import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  Res,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { createReadStream, existsSync } from 'fs'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { SuperAdminGuard } from '../../common/security/super-admin.guard.js'
import {
  createMemoryUploadOptions,
  DOCUMENT_UPLOAD_EXTENSIONS,
  DOCUMENT_UPLOAD_MIME_TYPES,
  resolveUploadedFilePath,
  validateUploadedFile,
} from '../../common/utils/upload.util.js'
import { resolvePrivateStorageKey } from '../../common/utils/private-storage.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { StorageService } from '../storage/storage.service.js'
import { CreateStaffDto, StaffService, UpdateStaffDto } from './staff.service.js'
import { UploadDocumentDto } from './dto/document.dto.js'
import type { DocumentType } from '@petshop/database'
import type { AuthUser } from '@petshop/shared'

@ApiTags('Staff')
@Controller('staff')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly storageService: StorageService,
  ) { }

  // =========================================================================
  // Collection Routes (phải đứng TRƯỚC resource routes)
  // =========================================================================

  @Get()
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy danh sách nhân viên' })
  findAll() {
    return this.staffService.findAll()
  }

  @Post()
  @Permissions('staff.create')
  @ApiOperation({ summary: 'Tạo nhân viên mới' })
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto)
  }

  @Post('bulk-delete')
  @UseGuards(SuperAdminGuard)
  @Permissions('staff.deactivate')
  @ApiOperation({ summary: 'Dinh chi hang loat nhan vien (chi SUPER_ADMIN)' })
  bulkDeactivate(@Body() body: { ids?: string[] }) {
    return this.staffService.bulkDeactivate(body.ids)
  }

  // =========================================================================
  // Document Management Routes (specific - phải đứng trước :id)
  // =========================================================================

  @Get(':id/documents')
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy danh sách tài liệu của nhân viên' })
  getDocuments(@Param('id') id: string) {
    return this.staffService.getDocuments(id)
  }

  @Post(':id/documents/upload')
  @UseInterceptors(
    FileInterceptor(
      'file',
      createMemoryUploadOptions({
        destination: 'storage/private/documents',
        allowedMimeTypes: DOCUMENT_UPLOAD_MIME_TYPES,
        allowedExtensions: DOCUMENT_UPLOAD_EXTENSIONS,
        maxFileSize: 10 * 1024 * 1024,
        errorMessage: 'Chi chap nhan pdf, doc, docx, xls, xlsx hoac anh',
      }),
    ),
  )
  @Permissions('staff.update')
  @ApiOperation({ summary: 'Tải lên tài liệu cho nhân viên' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: Object.values(require('@petshop/database').DocumentType || {}) },
        description: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
      required: ['file', 'type'],
    },
  })
  async uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Query('currentUser') currentUser?: string,
  ) {
    validateUploadedFile(file, {
      allowedMimeTypes: DOCUMENT_UPLOAD_MIME_TYPES,
      allowedExtensions: DOCUMENT_UPLOAD_EXTENSIONS,
      maxFileSize: 10 * 1024 * 1024,
      errorMessage: 'Chi chap nhan pdf, doc, docx, xls, xlsx hoac anh',
    })
    const asset = await this.storageService.uploadAsset({
      category: 'document',
      scope: 'documents',
      ownerType: 'EMPLOYEE_DOCUMENT',
      ownerId: id,
      fieldName: 'fileUrl',
      displayName: dto.description || dto.type || id,
      uploadedById: currentUser || null,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
    })
    ;(file as any).storageAssetUrl = asset.url
    return this.staffService.uploadDocument(id, currentUser || 'system', file, {
      type: dto.type as DocumentType,
      ...(dto.description && { description: dto.description }),
      ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
    })
  }

  @Get(':id/documents/:docId')
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Tải tài liệu của nhân viên (Proxy)' })
  async downloadDocument(@Param('id') id: string, @Param('docId') docId: string, @Res() res: any) {
    const doc = await this.staffService.getDocumentById(id, docId)
    try {
      if (doc.fileUrl.startsWith('http')) {
        const response = await fetch(doc.fileUrl)
        const arrayBuffer = await response.arrayBuffer()
        res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`)
        res.send(Buffer.from(arrayBuffer as ArrayBuffer))
      } else {
        const { absolutePath } = doc.fileUrl.startsWith('/uploads/documents/')
          ? resolveUploadedFilePath(doc.fileUrl, {
            publicPrefix: '/uploads/documents/',
            rootDir: 'uploads/documents',
          })
          : resolvePrivateStorageKey(doc.fileUrl)

        if (!existsSync(absolutePath)) {
          res.status(404).send('File not found')
          return
        }

        res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`)
        createReadStream(absolutePath).pipe(res)
      }
    } catch (e: any) {
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Disposition', `attachment; filename="mock_${encodeURIComponent(doc.fileName)}"`)
      res.send('Could not fetch remote file. Error: ' + String(e))
    }
  }

  @Delete(':id/documents/:docId')
  @Permissions('staff.update')
  @ApiOperation({ summary: 'Xóa tài liệu của nhân viên' })
  deleteDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.staffService.deleteDocument(id, docId)
  }

  // =========================================================================
  // Performance & Branch Roles Routes (specific - phải đứng trước :id)
  // =========================================================================

  @Get(':id/performance')
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy chỉ số hiệu suất của nhân viên' })
  getPerformance(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.staffService.getPerformanceMetrics(
      id,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    )
  }

  @Get(':id/branch-roles')
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy vai trò theo chi nhánh của nhân viên' })
  getBranchRoles(@Param('id') id: string) {
    return this.staffService.getBranchRoles(id)
  }

  // =========================================================================
  // Attendance & Salary Routes (specific - phải đứng trước :id)
  // =========================================================================

  @Get(':id/attendance')
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy dữ liệu chấm công của nhân viên' })
  getAttendance(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.staffService.getAttendance(
      id,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    )
  }

  @Get(':id/salary')
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy bảng lương của nhân viên' })
  getSalary(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.staffService.getSalary(
      id,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    )
  }

  // =========================================================================
  // Resource Routes (generic - phải đứng SAU cùng)
  // =========================================================================

  @Get(':id')
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy chi tiết nhân viên' })
  findById(@Param('id') id: string) {
    return this.staffService.findById(id)
  }

  @Patch(':id')
  @Permissions('staff.update')
  @ApiOperation({ summary: 'Cập nhật thông tin nhân viên' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto)
  }

  @Delete(':id')
  @Permissions('staff.deactivate')
  @ApiOperation({ summary: 'Đình chỉ nhân viên' })
  deactivate(@Param('id') id: string) {
    return this.staffService.deactivate(id)
  }
}
