import { StaffExcelService } from './staff-excel.service'

const actor: any = {
  userId: 'admin-1',
  role: 'ADMIN',
  permissions: ['staff.read', 'staff.create', 'staff.update'],
}

function makeDb(overrides: Record<string, any> = {}) {
  const db: any = {
    user: {
      count: jest.fn().mockResolvedValue(7),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'staff-new' }),
      update: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    role: {
      findMany: jest.fn().mockResolvedValue([{ id: 'role-1', name: 'Thu ngan' }]),
    },
    branch: {
      findMany: jest.fn().mockResolvedValue([{ id: 'branch-1', name: 'Ha Noi' }]),
    },
    $transaction: jest.fn(async (callback: any) => callback(db)),
    ...overrides,
  }
  return db
}

async function workbookBuffer(build: (workbook: any) => void) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.default.Workbook()
  build(workbook)
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

describe('StaffExcelService', () => {
  it('excludes the root superadmin from staff Excel exports', async () => {
    const db = makeDb()
    db.user.findMany.mockResolvedValue([])

    await new StaffExcelService(db).exportWorkbook()

    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { username: { not: 'superadmin' } },
    }))
  })

  it('marks required staff import columns with an asterisk in the template', async () => {
    const ExcelJS = await import('exceljs')
    const buffer = await new StaffExcelService(makeDb()).templateWorkbook()
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['NhanVien', 'HuongDan'])
    expect(workbook.getWorksheet('NhanVien')!.getRow(1).values).toEqual(expect.arrayContaining(['username*', 'fullName*']))
    expect(workbook.getWorksheet('NhanVien')!.getRow(1).values).toEqual(expect.arrayContaining(['id', 'staffCode']))
    expect(workbook.getWorksheet('NhanVien')!.getRow(1).values).toEqual(expect.arrayContaining(['salaryBankName', 'salaryBankAccount']))
    expect(workbook.getWorksheet('NhanVien')!.getRow(1).values).not.toEqual(expect.arrayContaining(['password']))
  })

  it('exports staff without password and formats createdAt for display only', async () => {
    const ExcelJS = await import('exceljs')
    const db = makeDb()
    db.user.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        staffCode: 'NV00001',
        username: 'nguyenvana',
        fullName: 'Nguyen Van A',
        phone: '0901000001',
        email: 'a@example.com',
        role: { name: 'Thu ngan' },
        status: 'WORKING',
        gender: null,
        employmentType: 'FULL_TIME',
        branch: { name: 'Ha Noi' },
        authorizedBranches: [],
        dob: null,
        identityCode: null,
        emergencyContactTitle: null,
        emergencyContactPhone: null,
        joinDate: null,
        shiftStart: null,
        shiftEnd: null,
        baseSalary: null,
        salaryBankName: 'Vietcombank',
        salaryBankAccount: '0123456789',
        spaCommissionRate: null,
        createdAt: new Date('2026-04-26T07:42:36.000Z'),
      },
    ])

    const buffer = await new StaffExcelService(db).exportWorkbook()
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)
    const sheet = workbook.getWorksheet('NhanVien')!
    const headers = sheet.getRow(1).values as unknown[]

    expect(headers).not.toEqual(expect.arrayContaining(['password']))
    expect(headers).toEqual(expect.arrayContaining(['salaryBankName', 'salaryBankAccount']))
    expect(sheet.getRow(2).getCell(headers.indexOf('salaryBankName')).value).toBe('Vietcombank')
    expect(sheet.getRow(2).getCell(headers.indexOf('salaryBankAccount')).value).toBe('0123456789')
    expect(sheet.getRow(2).getCell(headers.indexOf('createdAt')).value).toBe('2026/04/26 07:42:36')
  })

  it('previews create and update rows by id while ignoring blank update cells', async () => {
    const db = makeDb()
    db.user.findMany.mockResolvedValue([
      {
        id: 'staff-1',
        username: 'olduser',
        staffCode: 'NV00001',
        fullName: 'Old Name',
        phone: '0901000001',
      },
    ])

    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet('NhanVien')
      sheet.addRow(['id', 'username', 'fullName', 'phone', 'roleName', 'branchName'])
      sheet.addRow(['staff-1', '', 'Nguyen Van A', '', 'Thu ngan', 'Ha Noi'])
      sheet.addRow(['', 'tranthib', 'Tran Thi B', '0902000002', 'Thu ngan', 'Ha Noi'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new StaffExcelService(db).previewImport({ buffer, user: actor })

    expect(result.summary.createCount).toBe(1)
    expect(result.summary.updateCount).toBe(1)
    expect(result.summary.errorCount).toBe(0)
    expect(result.normalizedPayload!.rows[0]!.data).toEqual({
      fullName: 'Nguyen Van A',
      roleId: 'role-1',
      branchId: 'branch-1',
    })
  })

  it('reports duplicate phone numbers inside the uploaded staff workbook', async () => {
    const db = makeDb()
    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet('NhanVien')
      sheet.addRow(['username', 'fullName', 'phone'])
      sheet.addRow(['staffa', 'Staff A', '0901234567'])
      sheet.addRow(['staffb', 'Staff B', '0901234567'])
    })

    const result = await new StaffExcelService(db).previewImport({ buffer, user: actor })

    expect(result.summary.errorCount).toBeGreaterThan(0)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sheet: 'NhanVien',
        row: 3,
        column: 'phone',
        message: 'Trung phone 0901234567 trong file',
      }),
    ]))
  })

  it('reports phone numbers from the uploaded staff workbook that already exist in the database', async () => {
    const db = makeDb()
    db.user.findMany.mockResolvedValue([
      {
        id: 'staff-existing',
        username: 'existing',
        staffCode: 'NV00001',
        fullName: 'Existing Staff',
        phone: '0901234567',
      },
    ])
    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet('NhanVien')
      sheet.addRow(['username', 'fullName', 'phone'])
      sheet.addRow(['staffa', 'Staff A', '0901234567'])
    })

    const result = await new StaffExcelService(db).previewImport({ buffer, user: actor })

    expect(result.summary.errorCount).toBeGreaterThan(0)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sheet: 'NhanVien',
        row: 2,
        column: 'phone',
        message: 'phone 0901234567 da ton tai',
      }),
    ]))
  })

  it('normalizes Excel time cells to HH:mm during import preview', async () => {
    const db = makeDb()

    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet('NhanVien')
      sheet.addRow(['username', 'fullName', 'shiftStart', 'shiftEnd'])
      sheet.addRow([
        'tranthib',
        'Tran Thi B',
        new Date(1899, 11, 30, 8, 0, 0),
        new Date(1899, 11, 30, 17, 0, 0),
      ])
    })

    const result = await new StaffExcelService(db).previewImport({ buffer, user: actor })

    expect(result.summary.errorCount).toBe(0)
    expect(result.normalizedPayload!.rows[0]!.data).toEqual(expect.objectContaining({
      shiftStart: '08:00',
      shiftEnd: '17:00',
    }))
  })

  it('applies valid imports in one transaction with default password for new accounts', async () => {
    const db = makeDb()
    db.user.findMany.mockResolvedValueOnce([
      {
        id: 'staff-1',
        username: 'olduser',
        staffCode: 'NV00001',
        fullName: 'Old Name',
        phone: '0901000001',
      },
    ])

    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet('NhanVien')
      sheet.addRow(['id', 'username', 'password', 'fullName', 'phone'])
      sheet.addRow(['staff-1', '', '', 'Nguyen Van A', ''])
      sheet.addRow(['', 'tranthib', '', 'Tran Thi B', '0902000002'])
    })

    const result = await new StaffExcelService(db).applyImport({ buffer, user: actor })

    expect(result.summary.updateCount).toBe(1)
    expect(result.summary.createCount).toBe(1)
    expect(db.$transaction).toHaveBeenCalled()
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      data: { fullName: 'Nguyen Van A' },
    })
    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: 'tranthib',
        fullName: 'Tran Thi B',
        phone: '0902000002',
        staffCode: 'NV00008',
        status: 'WORKING',
        employmentType: 'FULL_TIME',
        passwordHash: expect.any(String),
      }),
    })
  })
})
