import { Controller, Get, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import {
  createMemoryUploadOptions,
  validateUploadedFile,
} from '../../common/utils/upload.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { CrmExcelService } from './crm-excel.service.js'
import type { CrmExcelScope, CrmExcelUser } from './crm-excel.types.js'

const MAX_CRM_EXCEL_SIZE = 10 * 1024 * 1024
const crmExcelUploadOptions = {
  allowedMimeTypes: new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]),
  allowedExtensions: new Set(['.xlsx', '.xls']),
  maxFileSize: MAX_CRM_EXCEL_SIZE,
  errorMessage: 'Chi ho tro file Excel (.xlsx). Kich thuoc toi da 10MB.',
}

function scopeValue(scope?: string): CrmExcelScope {
  return scope === 'customers' || scope === 'pets' ? scope : 'all'
}

@Controller('crm')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmExcelController {
  constructor(private readonly crmExcelService: CrmExcelService) {}

  @Get('excel-export')
  @Permissions('customer.read.all', 'customer.read.assigned', 'pet.read')
  async exportExcel(
    @Query('scope') scope: string | undefined,
    @Req() req: { user?: CrmExcelUser },
    @Res() res: Response,
  ) {
    const normalizedScope = scopeValue(scope)
    const buffer = await this.crmExcelService.exportWorkbook({ scope: normalizedScope, user: req.user })
    const filename = `crm-${normalizedScope}-${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  @Get('excel-template')
  @Permissions('customer.read.all', 'customer.read.assigned', 'pet.read')
  async template(@Res() res: Response) {
    const buffer = await this.crmExcelService.templateWorkbook()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="crm-template.xlsx"')
    res.send(buffer)
  }

  @Post('excel-import/preview')
  @Permissions('customer.create', 'customer.update', 'pet.create', 'pet.update')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createMemoryUploadOptions({
        destination: 'uploads/crm-excel',
        ...crmExcelUploadOptions,
      }),
    }),
  )
  preview(@UploadedFile() file: Express.Multer.File, @Req() req: { user?: CrmExcelUser }) {
    validateUploadedFile(file, crmExcelUploadOptions)
    return this.crmExcelService.previewImport({ buffer: file.buffer, user: req.user })
  }

  @Post('excel-import/apply')
  @Permissions('customer.create', 'customer.update', 'pet.create', 'pet.update')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createMemoryUploadOptions({
        destination: 'uploads/crm-excel',
        ...crmExcelUploadOptions,
      }),
    }),
  )
  apply(@UploadedFile() file: Express.Multer.File, @Req() req: { user?: CrmExcelUser }) {
    validateUploadedFile(file, crmExcelUploadOptions)
    return this.crmExcelService.applyImport({ buffer: file.buffer, user: req.user })
  }
}

