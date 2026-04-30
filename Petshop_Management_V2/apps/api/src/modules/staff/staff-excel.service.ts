import { BadRequestException, Injectable } from '@nestjs/common'
import { getRolePermissions, hasAnyPermission, resolvePermissions } from '@petshop/auth'
import { EmploymentType, StaffStatus } from '@petshop/database'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../database/database.service.js'
import type {
  NormalizedStaffImportRow,
  StaffExcelIssue,
  StaffExcelNormalizedPayload,
  StaffExcelPreviewResult,
  StaffExcelSummary,
  StaffExcelUser,
} from './staff-excel.types.js'

type ColumnDef = {
  key: string
  header: string
  width: number
  readonly?: boolean
  required?: boolean
}

const STAFF_SHEET = 'NhanVien'
const GUIDE_SHEET = 'HuongDan'
const DEFAULT_STAFF_PASSWORD = 'Petshop@123'

const STAFF_COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'id', width: 28, readonly: true },
  { key: 'staffCode', header: 'staffCode', width: 14, readonly: true },
  { key: 'username', header: 'username', width: 18, required: true },
  { key: 'password', header: 'password', width: 18 },
  { key: 'fullName', header: 'fullName', width: 28, required: true },
  { key: 'phone', header: 'phone', width: 18 },
  { key: 'email', header: 'email', width: 26 },
  { key: 'roleName', header: 'roleName', width: 22 },
  { key: 'status', header: 'status', width: 16 },
  { key: 'gender', header: 'gender', width: 14 },
  { key: 'employmentType', header: 'employmentType', width: 18 },
  { key: 'branchName', header: 'branchName', width: 24 },
  { key: 'authorizedBranchNames', header: 'authorizedBranchNames', width: 36 },
  { key: 'dob', header: 'dob', width: 16 },
  { key: 'identityCode', header: 'identityCode', width: 20 },
  { key: 'emergencyContactTitle', header: 'emergencyContactTitle', width: 26 },
  { key: 'emergencyContactPhone', header: 'emergencyContactPhone', width: 22 },
  { key: 'joinDate', header: 'joinDate', width: 16 },
  { key: 'shiftStart', header: 'shiftStart', width: 14 },
  { key: 'shiftEnd', header: 'shiftEnd', width: 14 },
  { key: 'baseSalary', header: 'baseSalary', width: 16 },
  { key: 'spaCommissionRate', header: 'spaCommissionRate', width: 20 },
  { key: 'createdAt', header: 'createdAt', width: 22, readonly: true },
]

const STAFF_EDITABLE_KEYS = new Set(STAFF_COLUMNS.filter((column) => !column.readonly).map((column) => column.key))
const STAFF_STATUSES = new Set(Object.values(StaffStatus))
const EMPLOYMENT_TYPES = new Set(Object.values(EmploymentType))
const GENDERS = new Set(['MALE', 'FEMALE', 'OTHER'])

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

function splitNames(value: unknown) {
  const raw = text(value)
  return raw ? raw.split(',').map((item) => item.trim()).filter(Boolean) : []
}

function emptySummary(): StaffExcelSummary {
  return {
    createCount: 0,
    updateCount: 0,
    skippedCount: 0,
    errorCount: 0,
    warningCount: 0,
  }
}

@Injectable()
export class StaffExcelService {
  constructor(private readonly db: DatabaseService) {}

  async exportWorkbook() {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    const sheet = workbook.addWorksheet(STAFF_SHEET)
    this.addHeader(sheet, STAFF_COLUMNS)
    const users = await (this.db as any).user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        role: { select: { name: true } },
        branch: { select: { name: true } },
        authorizedBranches: { select: { name: true } },
      },
    })
    for (const user of users) {
      sheet.addRow(STAFF_COLUMNS.map((column) => {
        if (column.key === 'roleName') return user.role?.name ?? ''
        if (column.key === 'branchName') return user.branch?.name ?? ''
        if (column.key === 'authorizedBranchNames') return user.authorizedBranches?.map((branch: any) => branch.name).join(', ') ?? ''
        if (['dob', 'joinDate'].includes(column.key)) return user[column.key] ? iso(user[column.key]).slice(0, 10) : ''
        if (column.key === 'createdAt') return iso(user.createdAt)
        if (column.key === 'password') return ''
        return user[column.key] ?? ''
      }))
    }
    this.addGuideSheet(workbook)
    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  async templateWorkbook() {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    this.addHeader(workbook.addWorksheet(STAFF_SHEET), STAFF_COLUMNS)
    this.addGuideSheet(workbook)
    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  async previewImport(params: { buffer: Buffer; user?: StaffExcelUser }): Promise<StaffExcelPreviewResult> {
    return this.parseWorkbook(params.buffer, params.user)
  }

  async applyImport(params: { buffer: Buffer; user?: StaffExcelUser }): Promise<StaffExcelPreviewResult> {
    const preview = await this.previewImport(params)
    if (!preview.normalizedPayload || preview.summary.errorCount > 0) return preview

    await (this.db as any).$transaction(async (tx: any) => {
      let nextStaffNumber = (await tx.user.count()) + 1
      for (const row of preview.normalizedPayload!.rows) {
        if (row.action === 'update' && row.existingId) {
          await tx.user.update({
            where: { id: row.existingId },
            data: this.toPrismaData(row.data, 'update'),
          })
        } else {
          const passwordHash = await bcrypt.hash(row.password || DEFAULT_STAFF_PASSWORD, 12)
          await tx.user.create({
            data: {
              staffCode: `NV${String(nextStaffNumber).padStart(5, '0')}`,
              username: row.username,
              passwordHash,
              status: StaffStatus.WORKING,
              employmentType: EmploymentType.FULL_TIME,
              ...this.toPrismaData(row.data, 'create'),
            },
          })
          nextStaffNumber += 1
        }
      }
    })

    return preview
  }

  private addHeader(sheet: any, columns: ColumnDef[]) {
    sheet.addRow(columns.map((column) => (column.required ? `${column.header}*` : column.header)))
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.columns = columns.map((column) => ({ width: column.width }))
  }

  private addGuideSheet(workbook: any) {
    const sheet = workbook.addWorksheet(GUIDE_SHEET)
    sheet.addRows([
      ['Cot', 'Ghi chu'],
      ['id', 'De trong khi tao moi. Neu co id trung he thong se cap nhat nhan vien do.'],
      ['username*, fullName*', 'Bat buoc khi tao moi. Password co the de trong de dung mat khau mac dinh.'],
      ['roleName, branchName', 'Nhap bang ten hien thi tren he thong.'],
      ['authorizedBranchNames', 'Nhieu chi nhanh cach nhau bang dau phay.'],
      ['status', [...STAFF_STATUSES].join(', ')],
      ['employmentType', [...EMPLOYMENT_TYPES].join(', ')],
    ])
    sheet.getRow(1).font = { bold: true }
    sheet.columns = [{ width: 28 }, { width: 80 }]
  }

  private async parseWorkbook(buffer: Buffer, user?: StaffExcelUser): Promise<StaffExcelPreviewResult> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)
    const errors: StaffExcelIssue[] = []
    const warnings: StaffExcelIssue[] = []
    const payload: StaffExcelNormalizedPayload = { rows: [] }

    const sheet = workbook.getWorksheet(STAFF_SHEET)
    if (!sheet) {
      errors.push({ sheet: STAFF_SHEET, message: 'Thieu sheet NhanVien' })
      return this.result(payload, errors, warnings)
    }

    const rows = this.readRows(sheet, STAFF_COLUMNS, errors, warnings)
    const [existingUsers, roles, branches] = await Promise.all([
      this.loadExistingUsers(rows),
      this.loadLookup('role'),
      this.loadLookup('branch'),
    ])
    this.normalizeRows(rows, existingUsers, roles, branches, payload, errors)
    this.validatePermissions(payload, errors, user)
    return this.result(payload, errors, warnings)
  }

  private readRows(sheet: any, columns: ColumnDef[], errors: StaffExcelIssue[], warnings: StaffExcelIssue[]) {
    const headerRow = sheet.getRow(1)
    const indexByKey = new Map<string, number>()
    const byHeader = new Map(columns.map((column) => [normalizeHeader(column.header), column.key]))
    headerRow.eachCell((cell: any, colNumber: number) => {
      const normalized = normalizeHeader(cell.value)
      const key = byHeader.get(normalized)
      if (key) indexByKey.set(key, colNumber)
      else if (normalized) warnings.push({ sheet: sheet.name, row: 1, column: String(cell.value), message: 'Cot khong duoc ho tro va se bi bo qua' })
    })

    const rows: Array<{ row: number; values: Record<string, unknown>; presentKeys: Set<string> }> = []
    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return
      const values: Record<string, unknown> = {}
      for (const column of columns) {
        const index = indexByKey.get(column.key)
        if (index) values[column.key] = row.getCell(index).value
      }
      if (Object.values(values).every((value) => !text(value))) return
      rows.push({ row: rowNumber, values, presentKeys: new Set(indexByKey.keys()) })
    })
    if (indexByKey.size === 0 && sheet.rowCount > 0) {
      errors.push({ sheet: sheet.name, row: 1, message: 'Khong tim thay dong tieu de hop le' })
    }
    return rows
  }

  private async loadExistingUsers(rows: Array<{ values: Record<string, unknown> }>) {
    const ids = new Set<string>()
    const usernames = new Set<string>()
    const phones = new Set<string>()
    for (const row of rows) {
      const id = text(row.values.id)
      const username = text(row.values.username)
      const phone = text(row.values.phone)
      if (id) ids.add(id)
      if (username) usernames.add(username)
      if (phone) phones.add(phone)
    }
    if (ids.size === 0 && usernames.size === 0 && phones.size === 0) {
      return { byId: new Map<string, any>(), byUsername: new Map<string, any>(), byPhone: new Map<string, any>() }
    }
    const users = await (this.db as any).user.findMany({
      where: {
        OR: [
          ...(ids.size ? [{ id: { in: [...ids] } }] : []),
          ...(usernames.size ? [{ username: { in: [...usernames] } }] : []),
          ...(phones.size ? [{ phone: { in: [...phones] } }] : []),
        ],
      },
      select: { id: true, username: true, staffCode: true, fullName: true, phone: true },
    })
    return {
      byId: new Map<string, any>(users.map((staff: any) => [staff.id, staff])),
      byUsername: new Map<string, any>(users.map((staff: any) => [staff.username, staff])),
      byPhone: new Map<string, any>(users.filter((staff: any) => staff.phone).map((staff: any) => [staff.phone, staff])),
    }
  }

  private async loadLookup(kind: 'role' | 'branch') {
    const rows = await (this.db as any)[kind].findMany({ select: { id: true, name: true } })
    const byName = new Map<string, string>()
    const duplicates = new Set<string>()
    for (const row of rows) {
      const key = normalizeHeader(row.name)
      if (byName.has(key)) duplicates.add(key)
      byName.set(key, row.id)
    }
    return { byName, duplicates }
  }

  private normalizeRows(
    rows: Array<{ row: number; values: Record<string, unknown>; presentKeys: Set<string> }>,
    existing: { byId: Map<string, any>; byUsername: Map<string, any>; byPhone: Map<string, any> },
    roles: { byName: Map<string, string>; duplicates: Set<string> },
    branches: { byName: Map<string, string>; duplicates: Set<string> },
    payload: StaffExcelNormalizedPayload,
    errors: StaffExcelIssue[],
  ) {
    const seenIds = new Set<string>()
    const seenUsernames = new Set<string>()
    const seenPhones = new Set<string>()
    for (const row of rows) {
      const id = text(row.values.id)
      const username = text(row.values.username)
      const phone = text(row.values.phone)
      const existingById = id ? existing.byId.get(id) : null
      const action = id ? 'update' : 'create'

      if (id && seenIds.has(id)) errors.push({ sheet: STAFF_SHEET, row: row.row, column: 'id', message: `Trung id ${id} trong file` })
      if (username && seenUsernames.has(username)) errors.push({ sheet: STAFF_SHEET, row: row.row, column: 'username', message: `Trung username ${username} trong file` })
      if (phone && seenPhones.has(phone)) errors.push({ sheet: STAFF_SHEET, row: row.row, column: 'phone', message: `Trung phone ${phone} trong file` })
      if (id) seenIds.add(id)
      if (username) seenUsernames.add(username)
      if (phone) seenPhones.add(phone)

      if (id && !existingById) errors.push({ sheet: STAFF_SHEET, row: row.row, column: 'id', message: `Khong tim thay nhan vien id ${id}` })
      if (action === 'create' && !username) errors.push({ sheet: STAFF_SHEET, row: row.row, column: 'username', message: 'username bat buoc khi tao moi' })
      if (action === 'create' && !text(row.values.fullName)) errors.push({ sheet: STAFF_SHEET, row: row.row, column: 'fullName', message: 'fullName bat buoc khi tao moi' })

      const existingUsername = username ? existing.byUsername.get(username) : null
      const existingPhone = phone ? existing.byPhone.get(phone) : null
      if (existingUsername && (!existingById || existingUsername.id !== existingById.id)) {
        errors.push({ sheet: STAFF_SHEET, row: row.row, column: 'username', message: `username ${username} da ton tai` })
      }
      if (existingPhone && (!existingById || existingPhone.id !== existingById.id)) {
        errors.push({ sheet: STAFF_SHEET, row: row.row, column: 'phone', message: `phone ${phone} da ton tai` })
      }

      const data: Record<string, unknown> = {}
      for (const key of STAFF_EDITABLE_KEYS) {
        if (['username', 'password', 'roleName', 'branchName', 'authorizedBranchNames'].includes(key)) continue
        if (!row.presentKeys.has(key)) continue
        const raw = row.values[key]
        const parsed = this.parseEditableValue(key, raw, row.row, errors)
        if (parsed !== undefined) data[key] = parsed
      }
      if (action === 'update' && username) data.username = username

      this.applyLookups(row, roles, branches, data, errors)
      payload.rows.push({
        row: row.row,
        action,
        existingId: existingById?.id,
        username,
        password: text(row.values.password),
        data,
      } satisfies NormalizedStaffImportRow)
    }
  }

  private parseEditableValue(key: string, raw: unknown, row: number, errors: StaffExcelIssue[]) {
    const rawText = text(raw)
    if (rawText === undefined) return undefined
    if (key === 'baseSalary' || key === 'spaCommissionRate') {
      const value = numberValue(raw)
      if (value === undefined) errors.push({ sheet: STAFF_SHEET, row, column: key, message: `${key} khong phai la so hop le` })
      return value
    }
    if (key === 'dob' || key === 'joinDate') {
      const value = dateValue(raw)
      if (value === undefined) errors.push({ sheet: STAFF_SHEET, row, column: key, message: `${key} khong phai ngay hop le` })
      return value
    }
    if (key === 'status') {
      const value = rawText.toUpperCase()
      if (!STAFF_STATUSES.has(value as StaffStatus)) errors.push({ sheet: STAFF_SHEET, row, column: key, message: `status khong hop le: ${value}` })
      return value
    }
    if (key === 'employmentType') {
      const value = rawText.toUpperCase()
      if (!EMPLOYMENT_TYPES.has(value as EmploymentType)) errors.push({ sheet: STAFF_SHEET, row, column: key, message: `employmentType khong hop le: ${value}` })
      return value
    }
    if (key === 'gender') {
      const value = rawText.toUpperCase()
      if (!GENDERS.has(value)) errors.push({ sheet: STAFF_SHEET, row, column: key, message: `gender khong hop le: ${value}` })
      return value
    }
    return rawText
  }

  private applyLookups(
    row: { row: number; values: Record<string, unknown>; presentKeys: Set<string> },
    roles: { byName: Map<string, string>; duplicates: Set<string> },
    branches: { byName: Map<string, string>; duplicates: Set<string> },
    data: Record<string, unknown>,
    errors: StaffExcelIssue[],
  ) {
    const roleName = text(row.values.roleName)
    if (roleName) data.roleId = this.lookupName(roles, roleName, row.row, 'roleName', errors)
    const branchName = text(row.values.branchName)
    if (branchName) data.branchId = this.lookupName(branches, branchName, row.row, 'branchName', errors)
    const authorizedBranchNames = splitNames(row.values.authorizedBranchNames)
    if (authorizedBranchNames.length > 0) {
      data.authorizedBranchIds = authorizedBranchNames
        .map((name) => this.lookupName(branches, name, row.row, 'authorizedBranchNames', errors))
        .filter(Boolean)
    }
  }

  private lookupName(
    lookup: { byName: Map<string, string>; duplicates: Set<string> },
    name: string,
    row: number,
    column: string,
    errors: StaffExcelIssue[],
  ) {
    const key = normalizeHeader(name)
    if (lookup.duplicates.has(key)) {
      errors.push({ sheet: STAFF_SHEET, row, column, message: `Ten ${name} bi trung trong he thong` })
      return undefined
    }
    const id = lookup.byName.get(key)
    if (!id) errors.push({ sheet: STAFF_SHEET, row, column, message: `Khong tim thay ${name}` })
    return id
  }

  private validatePermissions(payload: StaffExcelNormalizedPayload, errors: StaffExcelIssue[], user?: StaffExcelUser) {
    const permissions = this.permissions(user)
    const canCreate = this.isAdmin(user) || hasAnyPermission(permissions, ['staff.create'])
    const canUpdate = this.isAdmin(user) || hasAnyPermission(permissions, ['staff.update'])
    if (payload.rows.some((row) => row.action === 'create') && !canCreate) {
      errors.push({ sheet: STAFF_SHEET, message: 'Khong co quyen them moi nhan vien' })
    }
    if (payload.rows.some((row) => row.action === 'update') && !canUpdate) {
      errors.push({ sheet: STAFF_SHEET, message: 'Khong co quyen cap nhat nhan vien' })
    }
  }

  private result(payload: StaffExcelNormalizedPayload, errors: StaffExcelIssue[], warnings: StaffExcelIssue[]): StaffExcelPreviewResult {
    const summary = this.summarize(payload, errors, warnings)
    return {
      summary,
      errors,
      warnings,
      normalizedPayload: errors.length > 0 ? null : payload,
    }
  }

  private summarize(payload: StaffExcelNormalizedPayload, errors: StaffExcelIssue[], warnings: StaffExcelIssue[]): StaffExcelSummary {
    const summary = emptySummary()
    for (const row of payload.rows) {
      if (row.action === 'create') summary.createCount += 1
      else summary.updateCount += 1
    }
    summary.errorCount = errors.length
    summary.warningCount = warnings.length
    return summary
  }

  private toPrismaData(data: Record<string, unknown>, mode: 'create' | 'update') {
    const { authorizedBranchIds, ...rest } = data
    return {
      ...rest,
      ...(Array.isArray(authorizedBranchIds) && {
        authorizedBranches: {
          [mode === 'create' ? 'connect' : 'set']: authorizedBranchIds.map((id) => ({ id })),
        },
      }),
    }
  }

  private permissions(user?: StaffExcelUser) {
    return resolvePermissions([
      ...(user?.permissions ?? []),
      ...getRolePermissions(user?.role as any),
    ])
  }

  private isAdmin(user?: StaffExcelUser) {
    return user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.permissions?.includes('FULL_BRANCH_ACCESS')
  }
}
