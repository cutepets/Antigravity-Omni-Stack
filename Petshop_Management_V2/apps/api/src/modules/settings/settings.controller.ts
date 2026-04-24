import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { Roles } from '../../common/decorators/roles.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { RolesGuard } from '../../common/guards/roles.guard.js'
import {
  createMemoryUploadOptions,
  deleteUploadedFile,
  DOCUMENT_UPLOAD_EXTENSIONS,
  DOCUMENT_UPLOAD_MIME_TYPES,
  IMAGE_UPLOAD_EXTENSIONS,
  IMAGE_UPLOAD_MIME_TYPES,
  validateUploadedFile,
} from '../../common/utils/upload.util.js'
import type { Request, Response } from 'express'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { PaymentWebhookService } from '../orders/payment-webhook.service.js'
import { QueueService } from '../queue/queue.service'
import { StorageService } from '../storage/storage.service.js'
import { BackupService } from './backup/backup.service.js'
import {
  APP_BACKUP_EXTENSION,
  APP_BACKUP_MIME_TYPE,
  CreateBackupDto,
  InspectBackupDto,
  RestoreBackupDto,
} from './backup/backup.types.js'
import {
  CreateBranchDto,
  CreateBankTransferAccountDto,
  CreateCashbookCategoryDto,
  CreatePaymentMethodDto,
  CreatePaymentWebhookSecretDto,
  SettingsService,
  TestPaymentWebhookDto,
  UpdateBankTransferAccountDto,
  UpdateBranchDto,
  UpdateCashbookCategoryDto,
  UpdateConfigDto,
  UpdatePaymentMethodDto,
  UpdatePaymentOptionsDto,
  UpdatePrintTemplateDto,
} from './settings.service'

const DOCUMENT_UPLOAD_PREFIX = '/uploads/files/'

@ApiTags('Settings')
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly paymentWebhookService: PaymentWebhookService,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
    private readonly backupService: BackupService,
  ) { }

  private parseBackupModules(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.parseBackupModules(entry))
    }

    const raw = String(value ?? '').trim()
    if (!raw) {
      return []
    }

    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry ?? '').trim()).filter(Boolean)
      }
    } catch {
      // Ignore JSON parse failures and fall back to comma-separated values.
    }

    return raw.split(',').map((entry) => entry.trim()).filter(Boolean)
  }

  @Get('settings/configs')
  @Permissions('settings.app.read')
  @ApiOperation({ summary: 'Lấy cấu hình hệ thống' })
  getConfigs() {
    return this.settingsService.getConfigs()
  }

  @Put('settings/configs')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Cập nhật cấu hình hệ thống' })
  updateConfigs(@Body() dto: UpdateConfigDto) {
    return this.settingsService.updateConfigs(dto)
  }

  @Post('settings/google-drive/test')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Kiem tra ket noi Google Drive dung chung' })
  testGoogleDriveConnection() {
    return this.storageService.testGoogleDriveConnection()
  }

  @Get('settings/backups/catalog')
  @Permissions('settings.app.read')
  @ApiOperation({ summary: 'Lay danh sach module backup hien co' })
  getBackupCatalog() {
    return this.backupService.getCatalog()
  }

  @Post('settings/backups/export')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Tao backup mot-file dang .appbak' })
  async exportBackup(
    @Body() dto: CreateBackupDto,
    @Req() req: Request & { user?: { userId?: string } },
    @Res() res: Response,
  ) {
    const result = await this.backupService.exportBackup(dto, req.user?.userId ?? null)

    if (result.kind === 'download') {
      res.setHeader('Content-Type', APP_BACKUP_MIME_TYPE)
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      )
      res.setHeader('Content-Length', String(result.buffer.length))
      res.send(result.buffer)
      return
    }

    res.json({
      success: true,
      data: result.data,
    })
  }

  @Post('settings/backups/inspect')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Doc thong tin file backup .appbak' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  inspectBackup(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: InspectBackupDto,
  ) {
    if (!file) {
      throw new BadRequestException('Khong tim thay file backup')
    }

    if (!String(file.originalname ?? '').toLowerCase().endsWith(APP_BACKUP_EXTENSION)) {
      throw new BadRequestException('Chi chap nhan file backup .appbak')
    }

    return this.backupService.inspectBackup(file.buffer, dto.password)
  }

  @Post('settings/backups/restore')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Khoi phuc du lieu tu file backup .appbak' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  restoreBackup(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: RestoreBackupDto,
  ) {
    if (!file) {
      throw new BadRequestException('Khong tim thay file backup')
    }

    if (!String(file.originalname ?? '').toLowerCase().endsWith(APP_BACKUP_EXTENSION)) {
      throw new BadRequestException('Chi chap nhan file backup .appbak')
    }

    return this.backupService.restoreBackup(
      file.buffer,
      dto.password,
      this.parseBackupModules(dto.modules),
      dto.strategy ?? 'replace_selected',
    )
  }

  @Get('settings/print-templates')
  @Permissions('settings.app.read')
  @ApiOperation({ summary: 'Lấy cấu hình mẫu in' })
  getPrintTemplates() {
    return this.settingsService.findAllPrintTemplates()
  }

  @Get('settings/print-templates/:type')
  @Permissions('settings.app.read')
  @ApiOperation({ summary: 'Lấy chi tiết mẫu in theo type' })
  getPrintTemplateByType(@Param('type') type: string) {
    return this.settingsService.getPrintTemplate(type)
  }

  @Put('settings/print-templates/:type')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Cập nhật cấu hình mẫu in' })
  updatePrintTemplate(@Param('type') type: string, @Body() dto: UpdatePrintTemplateDto) {
    return this.settingsService.updatePrintTemplate(type, dto)
  }

  @Get('settings/cashbook-categories')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Danh sach danh muc so quy' })
  findAllCashbookCategories(@Query('type') type?: string) {
    return this.settingsService.findAllCashbookCategories(type)
  }

  @Post('settings/cashbook-categories')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Tao danh muc so quy' })
  createCashbookCategory(@Body() dto: CreateCashbookCategoryDto) {
    return this.settingsService.createCashbookCategory(dto)
  }

  @Put('settings/cashbook-categories/:id')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Cap nhat danh muc so quy' })
  updateCashbookCategory(@Param('id') id: string, @Body() dto: UpdateCashbookCategoryDto) {
    return this.settingsService.updateCashbookCategory(id, dto)
  }

  @Delete('settings/cashbook-categories/:id')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Xoa danh muc so quy' })
  removeCashbookCategory(@Param('id') id: string) {
    return this.settingsService.removeCashbookCategory(id)
  }

  @Get('settings/payment-methods')
  @Permissions(
    'settings.payment.manage',
    'report.cashbook',
    'order.create',
    'order.read.all',
    'order.read.assigned',
    'order.update',
    'order.pay',
    'sales_channel.pos',
  )
  @ApiOperation({ summary: 'Danh sach phuong thuc thanh toan' })
  findAllPaymentMethods() {
    return this.settingsService.findAllPaymentMethods()
  }

  @Get('settings/payment-options')
  @Permissions(
    'settings.payment.manage',
    'order.create',
    'order.read.all',
    'order.read.assigned',
    'order.update',
    'order.pay',
    'sales_channel.pos',
  )
  @ApiOperation({ summary: 'Cau hinh hanh vi thanh toan' })
  getPaymentOptions() {
    return this.settingsService.getPaymentOptions()
  }

  @Put('settings/payment-options')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Cap nhat cau hinh hanh vi thanh toan' })
  updatePaymentOptions(@Body() dto: UpdatePaymentOptionsDto) {
    return this.settingsService.updatePaymentOptions(dto)
  }

  @Get('settings/payment-webhook-secrets')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Danh sach key webhook chuyen khoan' })
  findAllPaymentWebhookSecrets() {
    return this.settingsService.findAllPaymentWebhookSecrets()
  }

  @Post('settings/payment-webhook-secrets')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Tao key webhook chuyen khoan' })
  createPaymentWebhookSecret(@Body() dto: CreatePaymentWebhookSecretDto) {
    return this.settingsService.createPaymentWebhookSecret(dto)
  }

  @Delete('settings/payment-webhook-secrets/:id')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Thu hoi key webhook chuyen khoan' })
  removePaymentWebhookSecret(@Param('id') id: string) {
    return this.settingsService.removePaymentWebhookSecret(id)
  }

  @Post('settings/payment-webhook-secrets/test')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Test webhook va ghi vao hang doi giao dich ngan hang' })
  testPaymentWebhook(@Body() dto: TestPaymentWebhookDto) {
    return this.paymentWebhookService.testBankTransferWebhook(dto.provider, dto.payload)
  }

  @Get('settings/bank-transactions')
  @Permissions('settings.payment.manage', 'report.cashbook')
  @ApiOperation({ summary: 'Danh sach giao dich ngan hang da nhan' })
  listBankTransactions(
    @Query('scope') scope?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const params: {
      scope?: string
      status?: string
      search?: string
    } = {}
    if (scope !== undefined) params.scope = scope
    if (status !== undefined) params.status = status
    if (search !== undefined) params.search = search
    return this.paymentWebhookService.listBankTransactions(params)
  }

  @Delete('settings/bank-transactions/:id')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Xoa du lieu test webhook trong hang doi giao dich ngan hang' })
  removeBankTransaction(@Param('id') id: string) {
    return this.paymentWebhookService.removeTestBankTransaction(id)
  }

  @Post('settings/payment-methods')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Tao phuong thuc thanh toan' })
  createPaymentMethod(@Body() dto: CreatePaymentMethodDto) {
    return this.settingsService.createPaymentMethod(dto)
  }

  @Put('settings/payment-methods/:id')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Cap nhat phuong thuc thanh toan' })
  updatePaymentMethod(@Param('id') id: string, @Body() dto: UpdatePaymentMethodDto) {
    return this.settingsService.updatePaymentMethod(id, dto)
  }

  @Delete('settings/payment-methods/:id')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Xoa phuong thuc thanh toan' })
  removePaymentMethod(@Param('id') id: string) {
    return this.settingsService.removePaymentMethod(id)
  }

  @Get('settings/bank-transfer-accounts')
  @Permissions(
    'settings.payment.manage',
    'report.cashbook',
    'order.create',
    'order.read.all',
    'order.read.assigned',
    'order.update',
    'order.pay',
    'sales_channel.pos',
  )
  @ApiOperation({ summary: 'Danh sach tai khoan chuyen khoan' })
  findAllBankTransferAccounts() {
    return this.settingsService.findAllBankTransferAccounts()
  }

  @Post('settings/bank-transfer-accounts')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Tao tai khoan chuyen khoan' })
  createBankTransferAccount(@Body() dto: CreateBankTransferAccountDto) {
    return this.settingsService.createBankTransferAccount(dto)
  }

  @Put('settings/bank-transfer-accounts/:id')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Cap nhat tai khoan chuyen khoan' })
  updateBankTransferAccount(@Param('id') id: string, @Body() dto: UpdateBankTransferAccountDto) {
    return this.settingsService.updateBankTransferAccount(id, dto)
  }

  @Delete('settings/bank-transfer-accounts/:id')
  @Permissions('settings.payment.manage')
  @ApiOperation({ summary: 'Xoa tai khoan chuyen khoan' })
  removeBankTransferAccount(@Param('id') id: string) {
    return this.settingsService.removeBankTransferAccount(id)
  }

  @Get('settings/branches')
  @Permissions('branch.read')
  @ApiOperation({ summary: 'Danh sách chi nhánh' })
  findAllBranches() {
    return this.settingsService.findAllBranches()
  }

  @Post('settings/branches')
  @Permissions('branch.create')
  @ApiOperation({ summary: 'Tạo chi nhánh mới' })
  createBranch(@Body() dto: CreateBranchDto) {
    return this.settingsService.createBranch(dto)
  }

  @Put('settings/branches/:id')
  @Permissions('branch.update')
  @ApiOperation({ summary: 'Cập nhật chi nhánh' })
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.settingsService.updateBranch(id, dto)
  }

  @Delete('settings/branches/:id')
  @Permissions('branch.delete')
  @ApiOperation({ summary: 'Xóa chi nhánh' })
  removeBranch(@Param('id') id: string) {
    return this.settingsService.removeBranch(id)
  }

  @Get('customer-groups')
  @Permissions('settings.app.read')
  @ApiOperation({ summary: 'Danh sách nhóm khách hàng' })
  findAllCustomerGroups() {
    return this.settingsService.findAllCustomerGroups()
  }

  @Post('customer-groups')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Tạo nhóm khách hàng mới' })
  createCustomerGroup(@Body() dto: any) {
    return this.settingsService.createCustomerGroup(dto)
  }

  @Put('customer-groups/:id')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Cập nhật nhóm khách hàng' })
  updateCustomerGroup(@Param('id') id: string, @Body() dto: any) {
    return this.settingsService.updateCustomerGroup(id, dto)
  }

  @Delete('customer-groups/:id')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Xóa nhóm khách hàng' })
  removeCustomerGroup(@Param('id') id: string) {
    return this.settingsService.removeCustomerGroup(id)
  }

  @Get('activity-logs')
  @Permissions('settings.audit_log.read')
  @ApiOperation({ summary: 'Danh sách nhật ký thao tác' })
  findActivityLogs(@Query() query: any): any {
    return this.settingsService.findActivityLogs(query)
  }

  @Get('activity-logs/stats')
  @Permissions('settings.audit_log.read')
  @ApiOperation({ summary: 'Thống kê nhật ký thao tác' })
  getActivityLogStats() {
    return this.settingsService.getActivityLogStats()
  }

  @Post('upload/image')
  @Permissions('settings.app.update', 'supplier.create', 'supplier.update')
  @ApiOperation({ summary: 'Upload ảnh' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor(
      'image',
      createMemoryUploadOptions({
        destination: 'uploads/images',
        allowedMimeTypes: IMAGE_UPLOAD_MIME_TYPES,
        allowedExtensions: IMAGE_UPLOAD_EXTENSIONS,
        maxFileSize: 50 * 1024 * 1024,
        errorMessage: 'Chỉ chấp nhận file ảnh (jpg, png, webp, gif, svg)',
      }),
    ),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request & { user?: { userId?: string } }) {
    if (!file) return { success: false, message: 'Không tìm thấy file ảnh' }
    validateUploadedFile(file, {
      allowedMimeTypes: IMAGE_UPLOAD_MIME_TYPES,
      allowedExtensions: IMAGE_UPLOAD_EXTENSIONS,
      maxFileSize: 50 * 1024 * 1024,
      errorMessage: 'Chi chap nhan file anh (jpg, png, webp, gif, svg)',
    })

    const asset = await this.storageService.uploadAsset({
      category: 'image',
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

  @Post('upload/file')
  @Permissions('settings.app.update', 'supplier.create', 'supplier.update')
  @ApiOperation({ summary: 'Upload tài liệu' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor(
      'file',
      createMemoryUploadOptions({
        destination: 'uploads/files',
        allowedMimeTypes: DOCUMENT_UPLOAD_MIME_TYPES,
        allowedExtensions: DOCUMENT_UPLOAD_EXTENSIONS,
        maxFileSize: 50 * 1024 * 1024,
        errorMessage: 'Chỉ chấp nhận pdf, doc, docx, xls, xlsx hoặc ảnh',
      }),
    ),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: Request & { user?: { userId?: string } }) {
    if (!file) return { success: false, message: 'Không tìm thấy file tài liệu' }
    validateUploadedFile(file, {
      allowedMimeTypes: DOCUMENT_UPLOAD_MIME_TYPES,
      allowedExtensions: DOCUMENT_UPLOAD_EXTENSIONS,
      maxFileSize: 50 * 1024 * 1024,
      errorMessage: 'Chi chap nhan pdf, doc, docx, xls, xlsx hoac anh',
    })

    const asset = await this.storageService.uploadAsset({
      category: 'document',
      uploadedById: req.user?.userId ?? null,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
    })

    return { success: true, url: asset.url, name: file.originalname }
  }

  @Delete('upload/file')
  @Permissions('settings.app.update', 'supplier.create', 'supplier.update')
  @ApiOperation({ summary: 'Xóa tài liệu đã upload' })
  async deleteFile(@Body('url') url: string) {
    await this.queueService.enqueueUploadCleanup({
      url,
      reason: 'settings.upload.delete',
    })

    const deletedAsset = await this.storageService.deleteAssetByUrl({ url })
    if (!deletedAsset) {
      await deleteUploadedFile(url, {
        publicPrefix: DOCUMENT_UPLOAD_PREFIX,
        rootDir: 'uploads/files',
      })
    }

    return { success: true }
  }

  // ─── Module Config ──────────────────────────────────────────────────────────

  @Get('settings/modules')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Lấy danh sách module' })
  async getModules() {
    return this.settingsService.getModules()
  }

  @Patch('settings/modules/:key')
  @Permissions('settings.app.update')
  @ApiOperation({ summary: 'Bật/tắt module' })
  async toggleModule(
    @Param('key') key: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.settingsService.toggleModule(key, isActive)
  }

  // ─── About ──────────────────────────────────────────────────────────────────

  @Get('settings/about')
  @ApiOperation({ summary: 'Thong tin phien ban he thong' })
  getAbout() {
    const meta = this.backupService.getAppMetadata()
    return {
      success: true,
      data: {
        appId: meta.appId,
        version: meta.appVersion,
        nodeEnv: process.env['NODE_ENV'] ?? 'development',
        buildDate: process.env['BUILD_DATE'] ?? null,
      },
    }
  }

  // ─── Purge (Data Reset) ─────────────────────────────────────────────────────

  @Delete('settings/purge')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Xoa du lieu demo theo module (chi SUPER_ADMIN)' })
  async purgeData(
    @Body() dto: { modules: string[]; confirmPhrase: string },
  ) {
    if (dto.confirmPhrase !== 'XOA DU LIEU') {
      throw new BadRequestException('Cum xac nhan khong chinh xac. Nhap "XOA DU LIEU" de xac nhan.')
    }

    if (!dto.modules?.length) {
      throw new BadRequestException('Can chon it nhat 1 module de xoa du lieu')
    }

    const result = await this.backupService.purgeModules(
      this.parseBackupModules(dto.modules),
    )

    return { success: true, data: result }
  }
}
