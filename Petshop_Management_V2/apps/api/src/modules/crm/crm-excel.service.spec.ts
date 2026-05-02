import { CrmExcelService } from './crm-excel.service'

const actor: any = {
  userId: 'user-1',
  role: 'ADMIN',
  permissions: [],
}

function makeDb(overrides: Record<string, any> = {}) {
  const db: any = {
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    customerGroup: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    branch: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    customerPointHistory: {
      create: jest.fn(),
    },
    pet: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ maxNumber: 0 }]),
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

describe('CrmExcelService', () => {
  it('exports CRM workbook with customer, pet, and guide sheets', async () => {
    const ExcelJS = await import('exceljs')
    const db = makeDb()
    db.customer.findMany.mockResolvedValue([
      {
        id: 'customer-1',
        customerCode: 'KH000001',
        fullName: 'Nguyen Van A',
        phone: '0901000001',
        email: null,
        address: 'Ha Noi',
        dateOfBirth: new Date('1990-01-02T00:00:00.000Z'),
        tier: 'BRONZE',
        points: 120,
        pointsUsed: 30,
        debt: 50000,
        notes: null,
        taxCode: null,
        description: null,
        isActive: true,
        companyName: null,
        companyAddress: null,
        representativeName: null,
        representativePhone: null,
        bankAccount: null,
        bankName: null,
        totalSpent: 0,
        totalOrders: 0,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        group: { name: 'VIP' },
        _count: { pets: 1 },
      },
    ])
    db.pet.findMany.mockResolvedValue([
      {
        id: 'pet-1',
        petCode: 'PET000001',
        name: 'Milu',
        species: 'Cho',
        breed: 'Poodle',
        gender: 'MALE',
        dateOfBirth: null,
        weight: 5,
        color: null,
        microchipId: null,
        allergies: null,
        temperament: null,
        notes: null,
        isActive: true,
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
        updatedAt: new Date('2026-04-04T00:00:00.000Z'),
        customer: { customerCode: 'KH000001', fullName: 'Nguyen Van A', phone: '0901000001' },
      },
    ])

    const buffer = await new CrmExcelService(db).exportWorkbook({ scope: 'all', user: actor })
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['KhachHang', 'Pet', 'HuongDan'])
    const customerHeaders = workbook.getWorksheet('KhachHang')!.getRow(1).values
    expect(customerHeaders).toEqual(expect.arrayContaining(['customerCode', 'fullName*', 'phone*', 'dateOfBirth', 'points', 'pointsUsed', 'debt', 'branchName', 'taxCode', 'companyName', 'bankAccount', 'bankName', 'petCount']))
    expect(customerHeaders).not.toEqual(expect.arrayContaining(['isSupplier', 'supplierCode']))
    expect(workbook.getWorksheet('Pet')!.getRow(1).values).toEqual(expect.arrayContaining(['petCode', 'ownerCustomerCode*', 'name*', 'species*']))
    expect(workbook.getWorksheet('KhachHang')!.getRow(2).getCell(2).value).toBe('KH000001')
    expect(workbook.getWorksheet('Pet')!.getRow(2).getCell(3).value).toBe('KH000001')
  })

  it('exports filtered customers with selected columns only', async () => {
    const ExcelJS = await import('exceljs')
    const db = makeDb()
    db.customer.findMany.mockResolvedValue([
      {
        id: 'customer-1',
        customerCode: 'KH000001',
        fullName: 'Nguyen Van A',
        phone: '0901000001',
        email: 'a@example.com',
        tier: 'GOLD',
        isActive: true,
        totalSpent: 250000,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        group: { name: 'VIP' },
        branch: { name: 'Ha Noi' },
        pets: [{ name: 'Milu' }],
        _count: { pets: 1, orders: 2, hotelStays: 0 },
      },
    ])
    db.customer.count = jest.fn().mockResolvedValue(1)

    const buffer = await new CrmExcelService(db).exportCustomerWorkbook({
      scope: 'filtered',
      filters: { search: 'Nguyen', tier: 'GOLD', isActive: true },
      columns: ['customerCode', 'fullName', 'phone', 'groupName'],
      user: actor,
    })
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(db.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tier: 'GOLD',
        isActive: true,
      }),
    }))
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['KhachHang'])
    expect(workbook.getWorksheet('KhachHang')!.getRow(1).values).toEqual([
      undefined,
      'customerCode',
      'fullName',
      'phone',
      'groupName',
    ])
    expect(workbook.getWorksheet('KhachHang')!.getRow(2).values).toEqual([
      undefined,
      'KH000001',
      'Nguyen Van A',
      '0901000001',
      'VIP',
    ])
  })

  it('exports selected customers by ID', async () => {
    const db = makeDb()
    db.customer.findMany.mockResolvedValue([])
    db.customer.count = jest.fn().mockResolvedValue(0)

    await new CrmExcelService(db).exportCustomerWorkbook({
      scope: 'selected',
      customerIds: ['customer-1', 'customer-2'],
      columns: ['customerCode', 'fullName'],
      user: actor,
    })

    expect(db.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['customer-1', 'customer-2'] },
      }),
    }))
  })

  it('marks required import columns with an asterisk in the template', async () => {
    const ExcelJS = await import('exceljs')
    const buffer = await new CrmExcelService(makeDb()).templateWorkbook()
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(workbook.getWorksheet('KhachHang')!.getRow(1).values).toEqual(expect.arrayContaining(['fullName*', 'phone*']))
    expect(workbook.getWorksheet('Pet')!.getRow(1).values).toEqual(expect.arrayContaining(['ownerCustomerCode*', 'name*', 'species*']))
    const customerHeaders = workbook.getWorksheet('KhachHang')!.getRow(1).values
    expect(customerHeaders).toEqual(expect.arrayContaining(['customerCode', 'dateOfBirth', 'points', 'debt', 'branchName', 'taxCode', 'companyName', 'bankAccount', 'bankName']))
    expect(customerHeaders).not.toEqual(expect.arrayContaining(['isSupplier', 'supplierCode']))
    expect(workbook.getWorksheet('Pet')!.getRow(1).values).toEqual(expect.arrayContaining(['petCode']))
  })

  it('previews customer create and update rows without touching read-only values', async () => {
    const db = makeDb()
    db.customer.findMany.mockResolvedValue([
      { id: 'customer-1', customerCode: 'KH000001', phone: '0901000001', fullName: 'Old Name' },
    ])

    const buffer = await workbookBuffer((workbook) => {
      const customers = workbook.addWorksheet('KhachHang')
      customers.addRow(['customerCode', 'fullName', 'phone', 'totalSpent'])
      customers.addRow(['KH000001', 'Nguyen Van A', '0901000001', 999999])
      customers.addRow(['', 'Tran Thi B', '0902000002', 123456])
      const pets = workbook.addWorksheet('Pet')
      pets.addRow(['petCode', 'ownerCustomerCode', 'name', 'species'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new CrmExcelService(db).previewImport({ buffer, user: actor })

    expect(result.summary.customerCreateCount).toBe(1)
    expect(result.summary.customerUpdateCount).toBe(1)
    expect(result.summary.errorCount).toBe(0)
    expect(result.normalizedPayload!.customers[0]!.data).not.toHaveProperty('totalSpent')
  })

  it('previews customer point migration fields and resolves branch names', async () => {
    const db = makeDb()
    db.customer.findMany.mockResolvedValue([
      {
        id: 'customer-1',
        customerCode: 'KH000001',
        phone: '0901000001',
        fullName: 'Old Name',
        branchId: 'branch-old',
        points: 20,
      },
    ])
    db.branch.findMany.mockResolvedValue([{ id: 'branch-1', name: 'Ha Noi' }])

    const buffer = await workbookBuffer((workbook) => {
      const customers = workbook.addWorksheet('KhachHang')
      customers.addRow(['customerCode', 'fullName', 'phone', 'dateOfBirth', 'points', 'debt', 'branchName', 'isSupplier', 'supplierCode'])
      customers.addRow(['KH000001', 'Nguyen Van A', '0901000001', new Date('1990-01-02T00:00:00.000Z'), 150, 25000, 'Ha Noi', 'true', 'NCC0001'])
      workbook.addWorksheet('Pet').addRow(['petCode', 'ownerCustomerCode', 'name', 'species'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new CrmExcelService(db).previewImport({ buffer, user: actor })

    expect(result.summary.errorCount).toBe(0)
    expect(result.normalizedPayload!.customers[0]!.data).toEqual(expect.objectContaining({
      dateOfBirth: new Date('1990-01-02T00:00:00.000Z'),
      points: 150,
      debt: 25000,
      branchId: 'branch-1',
    }))
    expect(result.normalizedPayload!.customers[0]!.data).not.toHaveProperty('isSupplier')
    expect(result.normalizedPayload!.customers[0]!.data).not.toHaveProperty('supplierCode')
  })

  it('rejects negative point balances and unknown branch names during customer import preview', async () => {
    const db = makeDb()
    db.branch.findMany.mockResolvedValue([])

    const buffer = await workbookBuffer((workbook) => {
      const customers = workbook.addWorksheet('KhachHang')
      customers.addRow(['customerCode', 'fullName', 'phone', 'points', 'branchName'])
      customers.addRow(['', 'Tran Thi B', '0902000002', -1, 'Missing Branch'])
      workbook.addWorksheet('Pet').addRow(['petCode', 'ownerCustomerCode', 'name', 'species'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new CrmExcelService(db).previewImport({ buffer, user: actor })

    expect(result.summary.errorCount).toBe(2)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ sheet: 'KhachHang', row: 2, column: 'points', message: 'points không được âm' }),
      expect.objectContaining({ sheet: 'KhachHang', row: 2, column: 'branchName', message: expect.stringContaining('Missing Branch') }),
    ]))
    expect(result.normalizedPayload).toBeNull()
  })

  it('reports a blocking error when pet ownerCustomerCode cannot be resolved', async () => {
    const db = makeDb()
    const buffer = await workbookBuffer((workbook) => {
      workbook.addWorksheet('KhachHang').addRow(['customerCode', 'fullName', 'phone'])
      const pets = workbook.addWorksheet('Pet')
      pets.addRow(['petCode', 'ownerCustomerCode', 'name', 'species'])
      pets.addRow(['', 'KH999999', 'Milu', 'Cho'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new CrmExcelService(db).previewImport({ buffer, user: actor })

    expect(result.summary.errorCount).toBe(1)
    expect(result.errors).toEqual([
      expect.objectContaining({
        sheet: 'Pet',
        row: 2,
        column: 'ownerCustomerCode',
        message: expect.stringContaining('KH999999'),
      }),
    ])
    expect(result.normalizedPayload).toBeNull()
  })

  it('applies valid imports in one transaction and ignores read-only columns', async () => {
    const db = makeDb()
    db.customer.findMany.mockResolvedValueOnce([
      { id: 'customer-1', customerCode: 'KH000001', phone: '0901000001', fullName: 'Old Name' },
    ])
    db.customer.findMany.mockResolvedValueOnce([
      { id: 'customer-1', customerCode: 'KH000001', phone: '0901000001', fullName: 'Old Name' },
    ])
    db.pet.findMany.mockResolvedValue([])
    db.customer.update.mockResolvedValue({ id: 'customer-1' })
    db.pet.create.mockResolvedValue({ id: 'pet-1' })

    const buffer = await workbookBuffer((workbook) => {
      const customers = workbook.addWorksheet('KhachHang')
      customers.addRow(['customerCode', 'fullName', 'phone', 'totalOrders'])
      customers.addRow(['KH000001', 'Nguyen Van A', '0901000001', 77])
      const pets = workbook.addWorksheet('Pet')
      pets.addRow(['petCode', 'ownerCustomerCode', 'name', 'species'])
      pets.addRow(['', 'KH000001', 'Milu', 'Cho'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new CrmExcelService(db).applyImport({ buffer, user: actor })

    expect(result.summary.customerUpdateCount).toBe(1)
    expect(result.summary.petCreateCount).toBe(1)
    expect(db.$transaction).toHaveBeenCalled()
    expect(db.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'customer-1' },
      data: expect.not.objectContaining({ totalOrders: 77 }),
    }))
    expect(db.pet.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: 'customer-1', name: 'Milu' }),
    }))
  })

  it('allocates customer codes in batch and uses an extended transaction timeout for large imports', async () => {
    const db = makeDb()
    db.$queryRawUnsafe.mockResolvedValue([{ maxNumber: 10 }])
    db.customer.create
      .mockImplementationOnce(async ({ data }: any) => ({ id: 'customer-1', ...data }))
      .mockImplementationOnce(async ({ data }: any) => ({ id: 'customer-2', ...data }))

    const buffer = await workbookBuffer((workbook) => {
      const customers = workbook.addWorksheet('KhachHang')
      customers.addRow(['customerCode', 'fullName', 'phone'])
      customers.addRow(['', 'Nguyen Van A', '0901000001'])
      customers.addRow(['', 'Tran Thi B', '0901000002'])
      workbook.addWorksheet('Pet').addRow(['petCode', 'ownerCustomerCode', 'name', 'species'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new CrmExcelService(db).applyImport({ buffer, user: actor })

    expect(result.summary.customerCreateCount).toBe(2)
    expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(1)
    expect(db.customer.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ customerCode: 'KH000011' }),
    }))
    expect(db.customer.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ customerCode: 'KH000012' }),
    }))
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      timeout: expect.any(Number),
    }))
  })

  it('records point history when Excel import sets a different customer point balance', async () => {
    const db = makeDb()
    db.customer.findMany.mockResolvedValueOnce([
      { id: 'customer-1', customerCode: 'KH000001', phone: '0901000001', fullName: 'Old Name', points: 20 },
    ])
    db.customer.update.mockResolvedValue({ id: 'customer-1' })

    const buffer = await workbookBuffer((workbook) => {
      const customers = workbook.addWorksheet('KhachHang')
      customers.addRow(['customerCode', 'fullName', 'phone', 'points'])
      customers.addRow(['KH000001', 'Nguyen Van A', '0901000001', 150])
      workbook.addWorksheet('Pet').addRow(['petCode', 'ownerCustomerCode', 'name', 'species'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new CrmExcelService(db).applyImport({ buffer, user: actor })

    expect(result.summary.customerUpdateCount).toBe(1)
    expect(db.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'customer-1' },
      data: expect.objectContaining({ points: 150 }),
    }))
    expect(db.customerPointHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'customer-1',
        actorId: 'user-1',
        delta: 130,
        balanceBefore: 20,
        balanceAfter: 150,
        source: 'EXCEL_IMPORT',
        reason: 'Legacy points migration',
      }),
    })
  })

  it('updates an existing pet from sparse columns without requiring ownerCustomerCode', async () => {
    const db = makeDb()
    db.pet.findMany.mockResolvedValue([{ id: 'pet-1', petCode: 'PET000001', customerId: 'customer-1' }])
    db.pet.update.mockResolvedValue({ id: 'pet-1' })

    const buffer = await workbookBuffer((workbook) => {
      workbook.addWorksheet('KhachHang').addRow(['customerCode', 'fullName*', 'phone*'])
      const pets = workbook.addWorksheet('Pet')
      pets.addRow(['petCode', 'name'])
      pets.addRow(['PET000001', 'Milu Updated'])
      workbook.addWorksheet('HuongDan').addRow(['Huong dan'])
    })

    const result = await new CrmExcelService(db).applyImport({ buffer, user: actor })

    expect(result.summary.errorCount).toBe(0)
    expect(result.summary.petUpdateCount).toBe(1)
    expect(db.pet.update).toHaveBeenCalledWith({
      where: { id: 'pet-1' },
      data: { name: 'Milu Updated' },
    })
  })
})
