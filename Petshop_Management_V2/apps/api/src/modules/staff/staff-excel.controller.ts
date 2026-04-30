import { Controller, Get, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import {
  createMemoryUploadOptions,
  validateUploadedFile,
} from '../../common/utils/upload.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { StaffExcelService } from './staff-excel.service.js'
import type { StaffExcelUser } from './staff-excel.types.js'

const MAX_STAFF_EXCEL_SIZE = 10 * 1024 * 1024
const staffExcelUploadOptions = {
  allowedMimeTypes: new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]),
  allowedExtensions: new Set(['.xlsx', '.xls']),
  maxFileSize: MAX_STAFF_EXCEL_SIZE,
  errorMessage: 'Chi ho tro file Excel (.xlsx). Kich thuoc toi da 10MB.',
}

@Controller('staff')
@UseGuards(JwtGuard, PermissionsGuard)
export class StaffExcelController {
  constructor(private readonly staffExcelService: StaffExcelService) {}

  @Get('excel-export')
  @Permissions('staff.read')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.staffExcelService.exportWorkbook()
    const filename = `nhan-vien-${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Get('excel-template')
  @Permissions('staff.read')
  async template(@Res() res: Response) {
    const buffer = await this.staffExcelService.templateWorkbook()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="nhan-vien-template.xlsx"')
    res.send(buffer)
  }

  @Post('excel-import/preview')
  @Permissions('staff.create', 'staff.update')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createMemoryUploadOptions({
        destination: 'uploads/staff-excel',
        ...staffExcelUploadOptions,
      }),
    }),
  )
  preview(@UploadedFile() file: Express.Multer.File, @Req() req: { user?: StaffExcelUser }) {
    validateUploadedFile(file, staffExcelUploadOptions)
    return this.staffExcelService.previewImport({ buffer: file.buffer, user: req.user })
  }

  @Post('excel-import/apply')
  @Permissions('staff.create', 'staff.update')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createMemoryUploadOptions({
        destination: 'uploads/staff-excel',
        ...staffExcelUploadOptions,
      }),
    }),
  )
  apply(@UploadedFile() file: Express.Multer.File, @Req() req: { user?: StaffExcelUser }) {
    validateUploadedFile(file, staffExcelUploadOptions)
    return this.staffExcelService.applyImport({ buffer: file.buffer, user: req.user })
  }
}
