import { BadRequestException, Injectable } from '@nestjs/common'
import { getRolePermissions, hasAnyPermission, resolvePermissions } from '@petshop/auth'
import { getNextSequentialCode } from '../../common/utils/sequential-code.util.js'
import { DatabaseService } from '../../database/database.service.js'
import type {
  CrmExcelIssue,
  CrmExcelNormalizedPayload,
  CrmExcelPreviewResult,
  CrmExcelScope,
  CrmExcelSummary,
  CrmExcelUser,
  NormalizedCustomerImportRow,
  NormalizedPetImportRow,
} from './crm-excel.types.js'

type ColumnDef = {
  key: string
  header: string
  width: number
  readonly?: boolean
  required?: boolean
}

const CUSTOMER_SHEET = 'KhachHang'
const PET_SHEET = 'Pet'
const GUIDE_SHEET = 'HuongDan'

const CUSTOMER_COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'id', width: 26, readonly: true },
  { key: 'customerCode', header: 'customerCode', width: 16 },
  { key: 'fullName', header: 'fullName', width: 28, required: true },
  { key: 'phone', header: 'phone', width: 18, required: true },
  { key: 'email', header: 'email', width: 24 },
  { key: 'address', header: 'address', width: 30 },
  { key: 'dateOfBirth', header: 'dateOfBirth', width: 16 },
  { key: 'groupName', header: 'groupName', width: 18 },
  { key: 'branchName', header: 'branchName', width: 24 },
  { key: 'tier', header: 'tier', width: 14 },
  { key: 'points', header: 'points', width: 12 },
  { key: 'pointsUsed', header: 'pointsUsed', width: 14, readonly: true },
  { key: 'debt', header: 'debt', width: 14 },
  { key: 'notes', header: 'notes', width: 30 },
  { key: 'taxCode', header: 'taxCode', width: 18 },
  { key: 'description', header: 'description', width: 30 },
  { key: 'isActive', header: 'isActive', width: 12 },
  { key: 'isSupplier', header: 'isSupplier', width: 12 },
  { key: 'supplierCode', header: 'supplierCode', width: 18 },
  { key: 'companyName', header: 'companyName', width: 26 },
  { key: 'companyAddress', header: 'companyAddress', width: 30 },
  { key: 'representativeName', header: 'representativeName', width: 24 },
  { key: 'representativePhone', header: 'representativePhone', width: 20 },
  { key: 'bankAccount', header: 'bankAccount', width: 20 },
  { key: 'bankName', header: 'bankName', width: 20 },
  { key: 'totalSpent', header: 'totalSpent', width: 16, readonly: true },
  { key: 'totalOrders', header: 'totalOrders', width: 14, readonly: true },
  { key: 'petCount', header: 'petCount', width: 12, readonly: true },
  { key: 'createdAt', header: 'createdAt', width: 22, readonly: true },
  { key: 'updatedAt', header: 'updatedAt', width: 22, readonly: true },
]

const PET_COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'id', width: 26, readonly: true },
  { key: 'petCode', header: 'petCode', width: 16 },
  { key: 'ownerCustomerCode', header: 'ownerCustomerCode', width: 20, required: true },
  { key: 'ownerName', header: 'ownerName', width: 24, readonly: true },
  { key: 'ownerPhone', header: 'ownerPhone', width: 18, readonly: true },
  { key: 'name', header: 'name', width: 22, required: true },
  { key: 'species', header: 'species', width: 16, required: true },
  { key: 'breed', header: 'breed', width: 18 },
  { key: 'gender', header: 'gender', width: 14 },
  { key: 'dateOfBirth', header: 'dateOfBirth', width: 16 },
  { key: 'weight', header: 'weight', width: 12 },
  { key: 'color', header: 'color', width: 14 },
  { key: 'microchipId', header: 'microchipId', width: 20 },
  { key: 'allergies', header: 'allergies', width: 26 },
  { key: 'temperament', header: 'temperament', width: 20 },
  { key: 'notes', header: 'notes', width: 30 },
  { key: 'isActive', header: 'isActive', width: 12 },
  { key: 'createdAt', header: 'createdAt', width: 22, readonly: true },
  { key: 'updatedAt', header: 'updatedAt', width: 22, readonly: true },
]

const CUSTOMER_EDITABLE_KEYS = new Set(CUSTOMER_COLUMNS.filter((column) => !column.readonly).map((column) => column.key))
const PET_EDITABLE_KEYS = new Set(PET_COLUMNS.filter((column) => !column.readonly).map((column) => column.key))
const CUSTOMER_TIERS = new Set(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'])
const PET_GENDERS = new Set(['MALE', 'FEMALE', 'UNKNOWN'])

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
    .replace(/\*/g, '')
    .trim()
    .toLowerCase()
}

function text(value: unknown) {
  if (value === null || value === undefined) return undefined
  const raw = typeof value === 'object' && 'text' in (value as any) ? (value as any).text : value
  const result = String(raw ?? '').trim()
  return result || undefined
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

function booleanValue(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'co', 'active', 'dang hoat dong'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'khong', 'inactive', 'ngung hoat dong'].includes(normalized)) return false
  return undefined
}

function dateValue(value: unknown) {
  if (!value) return undefined
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function iso(value: unknown) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function emptySummary(): CrmExcelSummary {
  return {
    customerCreateCount: 0,
    customerUpdateCount: 0,
    petCreateCount: 0,
    petUpdateCount: 0,
    skippedCount: 0,
    errorCount: 0,
    warningCount: 0,
  }
}

@Injectable()
export class CrmExcelService {
  constructor(private readonly db: DatabaseService) {}

  async exportWorkbook(params: { scope: CrmExcelScope; user?: CrmExcelUser }) {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    if (params.scope === 'customers' || params.scope === 'all') {
      await this.addCustomerSheet(workbook)
    }
    if (params.scope === 'pets' || params.scope === 'all') {
      await this.addPetSheet(workbook)
    }
    this.addGuideSheet(workbook)
    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  async templateWorkbook() {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    this.addHeader(workbook.addWorksheet(CUSTOMER_SHEET), CUSTOMER_COLUMNS)
    this.addHeader(workbook.addWorksheet(PET_SHEET), PET_COLUMNS)
    this.addGuideSheet(workbook)
    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  async previewImport(params: { buffer: Buffer; user?: CrmExcelUser }): Promise<CrmExcelPreviewResult> {
    return this.parseWorkbook(params.buffer, params.user)
  }

  async applyImport(params: { buffer: Buffer; user?: CrmExcelUser }): Promise<CrmExcelPreviewResult> {
    const preview = await this.previewImport(params)
    if (!preview.normalizedPayload || preview.summary.errorCount > 0) return preview

    await (this.db as any).$transaction(async (tx: any) => {
      const customerIdByCode = new Map<string, string>()
      for (const row of preview.normalizedPayload!.customers) {
        if (row.action === 'update' && row.existingId) {
          await tx.customer.update({ where: { id: row.existingId }, data: row.data })
          await this.recordPointMigrationIfNeeded(tx, {
            customerId: row.existingId,
            actorId: params.user?.userId,
            before: row.previousPoints ?? 0,
            after: typeof row.data.points === 'number' ? row.data.points : undefined,
          })
          if (row.customerCode) customerIdByCode.set(row.customerCode, row.existingId)
        } else {
          const customerCode = await getNextSequentialCode(tx, {
            table: 'customers',
            column: 'customerCode',
            prefix: 'KH',
          })
          const created = await tx.customer.create({
            data: {
              ...row.data,
              customerCode,
              branchId: (row.data.branchId as string | undefined) ?? params.user?.branchId ?? null,
            },
          })
          await this.recordPointMigrationIfNeeded(tx, {
            customerId: created.id,
            actorId: params.user?.userId,
            before: 0,
            after: typeof row.data.points === 'number' ? row.data.points : undefined,
          })
          customerIdByCode.set(created.customerCode, created.id)
        }
      }

      const ownerCodes = [...new Set(preview.normalizedPayload!.pets.map((row) => row.ownerCustomerCode).filter(Boolean) as string[])]
      if (ownerCodes.length > 0) {
        const customers = await tx.customer.findMany({
          where: { customerCode: { in: ownerCodes } },
          select: { id: true, customerCode: true, branchId: true },
        })
        for (const customer of customers) customerIdByCode.set(customer.customerCode, customer.id)
      }

      for (const row of preview.normalizedPayload!.pets) {
        const customerId = row.ownerCustomerCode ? customerIdByCode.get(row.ownerCustomerCode) : undefined
        if (row.action === 'update' && row.existingId) {
          if (row.ownerCustomerCode && !customerId) throw new BadRequestException(`Không tìm thấy khách hàng ${row.ownerCustomerCode}`)
          await tx.pet.update({
            where: { id: row.existingId },
            data: {
              ...row.data,
              ...(customerId ? { customerId } : {}),
            },
          })
        } else {
          if (!customerId) throw new BadRequestException(`Không tìm thấy khách hàng ${row.ownerCustomerCode}`)
          const petCode = await getNextSequentialCode(tx, {
            table: 'pets',
            column: 'petCode',
            prefix: 'PET',
          })
          await tx.pet.create({
            data: {
              ...row.data,
              petCode,
              customerId,
              branchId: params.user?.branchId ?? null,
            },
          })
        }
      }
    })

    return preview
  }

  private async recordPointMigrationIfNeeded(
    tx: any,
    params: { customerId: string; actorId?: string; before: number; after?: number },
  ) {
    if (params.after === undefined || params.after === params.before) return
    await tx.customerPointHistory.create({
      data: {
        customerId: params.customerId,
        actorId: params.actorId ?? null,
        delta: params.after - params.before,
        balanceBefore: params.before,
        balanceAfter: params.after,
        source: 'EXCEL_IMPORT',
        reason: 'Legacy points migration',
      },
    })
  }

  private async addCustomerSheet(workbook: any) {
    const sheet = workbook.addWorksheet(CUSTOMER_SHEET)
    this.addHeader(sheet, CUSTOMER_COLUMNS)
    const customers = await (this.db as any).customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        group: { select: { name: true } },
        branch: { select: { name: true } },
        _count: { select: { pets: true } },
      },
    })
    for (const customer of customers) {
      sheet.addRow(CUSTOMER_COLUMNS.map((column) => {
        if (column.key === 'groupName') return customer.group?.name ?? ''
        if (column.key === 'branchName') return customer.branch?.name ?? ''
        if (column.key === 'petCount') return customer._count?.pets ?? 0
        if (column.key === 'dateOfBirth') return customer.dateOfBirth ? iso(customer.dateOfBirth).slice(0, 10) : ''
        if (column.key === 'createdAt' || column.key === 'updatedAt') return iso(customer[column.key])
        return customer[column.key] ?? ''
      }))
    }
  }

  private async addPetSheet(workbook: any) {
    const sheet = workbook.addWorksheet(PET_SHEET)
    this.addHeader(sheet, PET_COLUMNS)
    const pets = await (this.db as any).pet.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { customerCode: true, fullName: true, phone: true } } },
    })
    for (const pet of pets) {
      sheet.addRow(PET_COLUMNS.map((column) => {
        if (column.key === 'ownerCustomerCode') return pet.customer?.customerCode ?? ''
        if (column.key === 'ownerName') return pet.customer?.fullName ?? ''
        if (column.key === 'ownerPhone') return pet.customer?.phone ?? ''
        if (column.key === 'createdAt' || column.key === 'updatedAt') return iso(pet[column.key])
        if (column.key === 'dateOfBirth') return pet.dateOfBirth ? iso(pet.dateOfBirth).slice(0, 10) : ''
        return pet[column.key] ?? ''
      }))
    }
  }

  private addHeader(sheet: any, columns: ColumnDef[]) {
    sheet.addRow(columns.map((column) => column.required ? `${column.header}*` : column.header))
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.columns = columns.map((column) => ({ width: column.width }))
  }

  private addGuideSheet(workbook: any) {
    const sheet = workbook.addWorksheet(GUIDE_SHEET)
    sheet.addRows([
      ['Sheet', 'Cot', 'Ghi chu'],
      [CUSTOMER_SHEET, 'customerCode', 'Mã KH dùng để cập nhật. Để trống khi tạo mới.'],
      [CUSTOMER_SHEET, 'fullName*, phone*', 'Bắt buộc khi tạo mới khách hàng. Có thể xóa cột không cần cập nhật.'],
      [CUSTOMER_SHEET, 'points', 'Số dư điểm hiện tại khi migrate từ nền tảng cũ. Hệ thống sẽ ghi lịch sử chênh lệch.'],
      [CUSTOMER_SHEET, 'branchName', 'Tên chi nhánh phải tồn tại nếu nhập. Để trống sẽ dùng chi nhánh người thao tác khi tạo mới.'],
      [PET_SHEET, 'ownerCustomerCode*', 'Bắt buộc khi tạo mới Pet hoặc khi muốn đổi chủ sở hữu.'],
      [PET_SHEET, 'petCode', 'Mã PET dùng để cập nhật. Để trống khi tạo mới.'],
      [PET_SHEET, 'gender', 'MALE, FEMALE, UNKNOWN'],
      [CUSTOMER_SHEET, 'tier', 'BRONZE, SILVER, GOLD, PLATINUM, DIAMOND'],
    ])
    sheet.getRow(1).font = { bold: true }
    sheet.columns = [{ width: 18 }, { width: 28 }, { width: 60 }]
  }

  private async parseWorkbook(buffer: Buffer, user?: CrmExcelUser): Promise<CrmExcelPreviewResult> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)
    const errors: CrmExcelIssue[] = []
    const warnings: CrmExcelIssue[] = []
    const payload: CrmExcelNormalizedPayload = { customers: [], pets: [] }

    const customerSheet = workbook.getWorksheet(CUSTOMER_SHEET)
    const petSheet = workbook.getWorksheet(PET_SHEET)
    const permissions = this.permissions(user)
    const canImportCustomers = this.isAdmin(user) || hasAnyPermission(permissions, ['customer.create', 'customer.update'])
    const canImportPets = this.isAdmin(user) || hasAnyPermission(permissions, ['pet.create', 'pet.update'])

    if (!customerSheet) errors.push({ sheet: CUSTOMER_SHEET, message: 'Thiếu sheet KhachHang' })
    if (!petSheet) errors.push({ sheet: PET_SHEET, message: 'Thiếu sheet Pet' })
    if (customerSheet && !canImportCustomers) errors.push({ sheet: CUSTOMER_SHEET, message: 'Không có quyền nhập khách hàng' })
    if (petSheet && !canImportPets) errors.push({ sheet: PET_SHEET, message: 'Không có quyền nhập pet' })

    const customerRows = customerSheet ? this.readRows(customerSheet, CUSTOMER_COLUMNS, errors) : []
    const petRows = petSheet ? this.readRows(petSheet, PET_COLUMNS, errors) : []

    const existingCustomers = await this.loadExistingCustomers(customerRows, petRows)
    const existingPets = await this.loadExistingPets(petRows)
    const groups = await this.loadCustomerGroups()
    const branches = await this.loadBranches()
    this.normalizeCustomerRows(customerRows, existingCustomers, groups, branches, payload, errors)
    this.normalizePetRows(petRows, existingCustomers, existingPets, payload, errors)

    const summary = this.summarize(payload, errors, warnings)
    return {
      summary,
      errors,
      warnings,
      normalizedPayload: errors.length > 0 ? null : payload,
    }
  }

  private readRows(sheet: any, columns: ColumnDef[], errors: CrmExcelIssue[]) {
    const headerRow = sheet.getRow(1)
    const indexByKey = new Map<string, number>()
    const byHeader = new Map(columns.map((column) => [normalizeHeader(column.header), column.key]))
    headerRow.eachCell((cell: any, colNumber: number) => {
      const key = byHeader.get(normalizeHeader(cell.value))
      if (key) indexByKey.set(key, colNumber)
    })
    const rows: Array<{ row: number; values: Record<string, unknown> }> = []
    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return
      const values: Record<string, unknown> = {}
      for (const column of columns) {
        const index = indexByKey.get(column.key)
        if (index) values[column.key] = row.getCell(index).value
      }
      if (Object.values(values).every((value) => !text(value))) return
      rows.push({ row: rowNumber, values })
    })
    if (indexByKey.size === 0 && sheet.rowCount > 0) {
      errors.push({ sheet: sheet.name, row: 1, message: 'Không tìm thấy dòng tiêu đề hợp lệ' })
    }
    return rows
  }

  private async loadExistingCustomers(
    customerRows: Array<{ values: Record<string, unknown> }>,
    petRows: Array<{ values: Record<string, unknown> }>,
  ): Promise<{ byCode: Map<string, any>; byPhone: Map<string, any> }> {
    const customerCodes = new Set<string>()
    const phones = new Set<string>()
    for (const row of customerRows) {
      const code = text(row.values.customerCode)
      const phone = text(row.values.phone)
      if (code) customerCodes.add(code)
      if (phone) phones.add(phone)
    }
    for (const row of petRows) {
      const code = text(row.values.ownerCustomerCode)
      if (code) customerCodes.add(code)
    }
    if (customerCodes.size === 0 && phones.size === 0) {
      return { byCode: new Map<string, any>(), byPhone: new Map<string, any>() }
    }
    const customers = await (this.db as any).customer.findMany({
      where: {
        OR: [
          ...(customerCodes.size ? [{ customerCode: { in: [...customerCodes] } }] : []),
          ...(phones.size ? [{ phone: { in: [...phones] } }] : []),
        ],
      },
      select: { id: true, customerCode: true, phone: true, fullName: true, branchId: true, points: true },
    })
    return {
      byCode: new Map<string, any>(customers.map((customer: any) => [customer.customerCode, customer])),
      byPhone: new Map<string, any>(customers.map((customer: any) => [customer.phone, customer])),
    }
  }

  private async loadExistingPets(petRows: Array<{ values: Record<string, unknown> }>): Promise<Map<string, any>> {
    const petCodes = [...new Set(petRows.map((row) => text(row.values.petCode)).filter(Boolean) as string[])]
    if (petCodes.length === 0) return new Map<string, any>()
    const pets = await (this.db as any).pet.findMany({
      where: { petCode: { in: petCodes } },
      select: { id: true, petCode: true, customerId: true },
    })
    return new Map<string, any>(pets.map((pet: any) => [pet.petCode, pet]))
  }

  private async loadCustomerGroups(): Promise<Map<string, string>> {
    const groups = await (this.db as any).customerGroup.findMany({
      select: { id: true, name: true },
    })
    return new Map<string, string>(groups.map((group: any) => [normalizeHeader(group.name), group.id]))
  }

  private async loadBranches(): Promise<Map<string, string>> {
    const branches = await (this.db as any).branch.findMany({
      select: { id: true, name: true },
    })
    return new Map<string, string>(branches.map((branch: any) => [normalizeHeader(branch.name), branch.id]))
  }

  private normalizeCustomerRows(
    rows: Array<{ row: number; values: Record<string, unknown> }>,
    existing: { byCode: Map<string, any>; byPhone: Map<string, any> },
    groups: Map<string, string>,
    branches: Map<string, string>,
    payload: CrmExcelNormalizedPayload,
    errors: CrmExcelIssue[],
  ) {
    const seenCodes = new Set<string>()
    const seenPhones = new Set<string>()
    for (const row of rows) {
      const customerCode = text(row.values.customerCode)
      const phone = text(row.values.phone)
      const existingByCode = customerCode ? existing.byCode.get(customerCode) : null
      const existingByPhone = phone ? existing.byPhone.get(phone) : null
      const action = existingByCode ? 'update' : 'create'

      if (customerCode && seenCodes.has(customerCode)) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'customerCode', message: `Trùng customerCode ${customerCode} trong file` })
      if (phone && seenPhones.has(phone)) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'phone', message: `Trùng phone ${phone} trong file` })
      if (customerCode) seenCodes.add(customerCode)
      if (phone) seenPhones.add(phone)

      if (customerCode && !existingByCode) {
        errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'customerCode', message: `customerCode ${customerCode} không tồn tại. Để trống cột này khi tạo mới.` })
      }
      if (action === 'create' && !text(row.values.fullName)) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'fullName', message: 'fullName bắt buộc khi tạo mới' })
      if (action === 'create' && !phone) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'phone', message: 'phone bắt buộc khi tạo mới' })
      if (existingByPhone && (!existingByCode || existingByPhone.id !== existingByCode.id)) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'phone', message: `Số điện thoại ${phone} đã được sử dụng` })

      const tier = text(row.values.tier)?.toUpperCase()
      if (tier && !CUSTOMER_TIERS.has(tier)) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'tier', message: `tier không hợp lệ: ${tier}` })
      const groupName = text(row.values.groupName)
      const groupId = groupName ? groups.get(normalizeHeader(groupName)) : undefined
      const branchName = text(row.values.branchName)
      const branchId = branchName ? branches.get(normalizeHeader(branchName)) : undefined
      if (branchName && !branchId) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'branchName', message: `Không tìm thấy chi nhánh ${branchName}` })
      const data: Record<string, unknown> = {}
      for (const key of CUSTOMER_EDITABLE_KEYS) {
        if (key === 'customerCode' || key === 'groupName' || key === 'branchName') continue
        const raw = row.values[key]
        const parsed =
          key === 'isActive' || key === 'isSupplier' ? booleanValue(raw)
            : key === 'points' || key === 'debt' ? numberValue(raw)
              : key === 'dateOfBirth' ? dateValue(raw)
                : text(raw)
        if (parsed !== undefined) data[key] = parsed
      }
      if (typeof data.points === 'number' && data.points < 0) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'points', message: 'points không được âm' })
      if (typeof data.debt === 'number' && data.debt < 0) errors.push({ sheet: CUSTOMER_SHEET, row: row.row, column: 'debt', message: 'debt không được âm' })
      if (tier) data.tier = tier
      if (groupName) data.groupId = groupId ?? null
      if (branchName && branchId) data.branchId = branchId
      payload.customers.push({
        row: row.row,
        action,
        existingId: existingByCode?.id,
        customerCode,
        phone: phone ?? '',
        previousPoints: existingByCode?.points ?? 0,
        data,
      } satisfies NormalizedCustomerImportRow)
    }
  }

  private normalizePetRows(
    rows: Array<{ row: number; values: Record<string, unknown> }>,
    customers: { byCode: Map<string, any>; byPhone: Map<string, any> },
    existingPets: Map<string, any>,
    payload: CrmExcelNormalizedPayload,
    errors: CrmExcelIssue[],
  ) {
    const seenCodes = new Set<string>()
    for (const row of rows) {
      const petCode = text(row.values.petCode)
      const ownerCustomerCode = text(row.values.ownerCustomerCode)
      const existingPet = petCode ? existingPets.get(petCode) : null
      const action = existingPet ? 'update' : 'create'

      if (petCode && seenCodes.has(petCode)) errors.push({ sheet: PET_SHEET, row: row.row, column: 'petCode', message: `Trùng petCode ${petCode} trong file` })
      if (petCode) seenCodes.add(petCode)
      if (action === 'create' && !ownerCustomerCode) errors.push({ sheet: PET_SHEET, row: row.row, column: 'ownerCustomerCode', message: 'ownerCustomerCode bắt buộc khi tạo mới' })
      if (ownerCustomerCode && !customers.byCode.has(ownerCustomerCode)) {
        errors.push({ sheet: PET_SHEET, row: row.row, column: 'ownerCustomerCode', message: `Không tìm thấy ownerCustomerCode ${ownerCustomerCode}` })
      }
      if (action === 'create' && !text(row.values.name)) errors.push({ sheet: PET_SHEET, row: row.row, column: 'name', message: 'name bắt buộc khi tạo mới' })
      if (action === 'create' && !text(row.values.species)) errors.push({ sheet: PET_SHEET, row: row.row, column: 'species', message: 'species bắt buộc khi tạo mới' })

      const gender = text(row.values.gender)?.toUpperCase()
      if (gender && !PET_GENDERS.has(gender)) errors.push({ sheet: PET_SHEET, row: row.row, column: 'gender', message: `gender không hợp lệ: ${gender}` })
      const data: Record<string, unknown> = {}
      for (const key of PET_EDITABLE_KEYS) {
        if (key === 'petCode' || key === 'ownerCustomerCode') continue
        const raw = row.values[key]
        const parsed =
          key === 'isActive' ? booleanValue(raw)
            : key === 'weight' ? numberValue(raw)
              : key === 'dateOfBirth' ? dateValue(raw)
                : text(raw)
        if (parsed !== undefined) data[key] = parsed
      }
      if (gender) data.gender = gender
      payload.pets.push({
        row: row.row,
        action,
        existingId: existingPet?.id,
        petCode,
        ownerCustomerCode: ownerCustomerCode ?? '',
        data,
      } satisfies NormalizedPetImportRow)
    }
  }

  private summarize(payload: CrmExcelNormalizedPayload, errors: CrmExcelIssue[], warnings: CrmExcelIssue[]): CrmExcelSummary {
    const summary = emptySummary()
    for (const customer of payload.customers) {
      if (customer.action === 'create') summary.customerCreateCount += 1
      else summary.customerUpdateCount += 1
    }
    for (const pet of payload.pets) {
      if (pet.action === 'create') summary.petCreateCount += 1
      else summary.petUpdateCount += 1
    }
    summary.errorCount = errors.length
    summary.warningCount = warnings.length
    return summary
  }

  private permissions(user?: CrmExcelUser) {
    return resolvePermissions([
      ...(user?.permissions ?? []),
      ...getRolePermissions(user?.role as any),
    ])
  }

  private isAdmin(user?: CrmExcelUser) {
    return user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.permissions?.includes('FULL_BRANCH_ACCESS')
  }
}
