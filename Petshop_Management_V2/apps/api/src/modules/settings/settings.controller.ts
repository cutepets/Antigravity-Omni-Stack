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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { randomUUID } from 'crypto'
import { unlink } from 'fs/promises'
import { diskStorage } from 'multer'
import { extname, resolve } from 'path'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard'
import { PaymentWebhookService } from '../orders/payment-webhook.service.js'
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

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'])
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'])
const DOCUMENT_UPLOAD_PREFIX = '/uploads/files/'
const DOCUMENT_UPLOAD_ROOT = resolve(process.cwd(), 'uploads/files')

function resolveDocumentUploadPath(url: string) {
  const normalizedUrl = String(url ?? '').trim()
  if (!normalizedUrl.startsWith(DOCUMENT_UPLOAD_PREFIX)) {
    throw new BadRequestException('Đường dẫn tài liệu không hợp lệ')
  }

  const fileName = normalizedUrl.slice(DOCUMENT_UPLOAD_PREFIX.length).trim()
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    throw new BadRequestException('Tên file tài liệu không hợp lệ')
  }

  return {
    fileName,
    absolutePath: resolve(DOCUMENT_UPLOAD_ROOT, fileName),
  }
}

@ApiTags('Settings')
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly paymentWebhookService: PaymentWebhookService,
  ) { }

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
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { success: false, message: 'Không tìm thấy file ảnh' }
    return { success: true, url: `/uploads/images/${file.filename}` }
  }

  @Post('upload/file')
  @Permissions('settings.app.update', 'supplier.create', 'supplier.update')
  @ApiOperation({ summary: 'Upload tài liệu' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase()
        const mime = (file.mimetype || '').toLowerCase()

        if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mime) || !ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
          cb(new BadRequestException('Chỉ chấp nhận pdf, doc, docx, xls, xlsx hoặc ảnh') as any, false)
          return
        }

        cb(null, true)
      },
      storage: diskStorage({
        destination: './uploads/files',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname)
          cb(null, `${randomUUID()}${ext}`)
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { success: false, message: 'Không tìm thấy file tài liệu' }
    return { success: true, url: `/uploads/files/${file.filename}`, name: file.originalname }
  }

  @Delete('upload/file')
  @Permissions('settings.app.update', 'supplier.create', 'supplier.update')
  @ApiOperation({ summary: 'Xóa tài liệu đã upload' })
  async deleteFile(@Body('url') url: string) {
    const { absolutePath } = resolveDocumentUploadPath(url)

    try {
      await unlink(absolutePath)
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw new BadRequestException('Không thể xóa file tài liệu')
      }
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
}
