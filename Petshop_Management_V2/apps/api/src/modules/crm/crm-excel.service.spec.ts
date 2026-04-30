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
        tier: 'BRONZE',
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
    expect(workbook.getWorksheet('KhachHang')!.getRow(1).values).toEqual(expect.arrayContaining(['customerCode', 'fullName*', 'phone*', 'petCount']))
    expect(workbook.getWorksheet('Pet')!.getRow(1).values).toEqual(expect.arrayContaining(['petCode', 'ownerCustomerCode*', 'name*', 'species*']))
    expect(workbook.getWorksheet('KhachHang')!.getRow(2).getCell(2).value).toBe('KH000001')
    expect(workbook.getWorksheet('Pet')!.getRow(2).getCell(3).value).toBe('KH000001')
  })

  it('marks required import columns with an asterisk in the template', async () => {
    const ExcelJS = await import('exceljs')
    const buffer = await new CrmExcelService(makeDb()).templateWorkbook()
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(workbook.getWorksheet('KhachHang')!.getRow(1).values).toEqual(expect.arrayContaining(['fullName*', 'phone*']))
    expect(workbook.getWorksheet('Pet')!.getRow(1).values).toEqual(expect.arrayContaining(['ownerCustomerCode*', 'name*', 'species*']))
    expect(workbook.getWorksheet('KhachHang')!.getRow(1).values).toEqual(expect.arrayContaining(['customerCode']))
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
