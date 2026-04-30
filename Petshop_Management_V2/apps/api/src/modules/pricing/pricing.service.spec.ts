import { PricingService } from './pricing.service'

describe('PricingService pricing configuration', () => {
  let service: PricingService
  let db: any

  beforeEach(() => {
    db = {
      $executeRawUnsafe: jest.fn(),
      $queryRawUnsafe: jest.fn(),
      serviceWeightBand: {
        findMany: jest.fn(),
      },
      spaPriceRule: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      hotelPriceRule: {
        findMany: jest.fn(),
      },
      holidayCalendarDate: {
        findMany: jest.fn(),
      },
      systemConfig: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    }
    db.serviceWeightBand.findMany.mockResolvedValue([])
    db.spaPriceRule.findMany.mockResolvedValue([])
    db.hotelPriceRule.findMany.mockResolvedValue([])
    db.holidayCalendarDate.findMany.mockResolvedValue([])
    db.systemConfig.findFirst.mockResolvedValue(null)
    db.$queryRawUnsafe.mockResolvedValue([])
    service = new PricingService(db)
  })

  it('hides legacy technical spa rules when custom named rules exist in the same band', async () => {
    const legacyRule = {
      id: 'legacy-bath',
      species: 'Chó',
      packageCode: 'BATH',
      label: null,
      weightBandId: 'band-medium',
      weightBand: { id: 'band-medium', isActive: true },
      price: 130000,
      durationMinutes: 30,
      isActive: true,
    }
    const namedRule = {
      id: 'custom-bath',
      species: 'Chó',
      packageCode: 'CHỈ TẮM',
      label: 'CHỈ TẮM',
      weightBandId: 'band-medium',
      weightBand: { id: 'band-medium', isActive: true },
      price: 190000,
      durationMinutes: 30,
      isActive: true,
    }
    const standaloneLegacyRule = {
      id: 'legacy-small',
      species: 'Chó',
      packageCode: 'SHAVE',
      label: null,
      weightBandId: 'band-small',
      weightBand: { id: 'band-small', isActive: true },
      price: 90000,
      durationMinutes: 30,
      isActive: true,
    }

    db.spaPriceRule.findMany
      .mockResolvedValueOnce([legacyRule, namedRule, standaloneLegacyRule])
      .mockResolvedValueOnce([])

    const rules = await service.listSpaRules({ species: 'Chó', isActive: 'true' })

    expect(rules).toEqual([namedRule, standaloneLegacyRule])
  })

  it('updates spa service images by species and keeps the other species image', async () => {
    db.systemConfig.findFirst
      .mockResolvedValueOnce({
        id: 'config-1',
        spaServiceImages: JSON.stringify([
          { species: 'Chó', packageCode: 'Tắm', imageUrl: '/uploads/dog-old.jpg' },
          { species: 'Mèo', packageCode: 'Tắm', imageUrl: '/uploads/cat.jpg' },
        ]),
      })
      .mockResolvedValueOnce({ id: 'config-1' })

    const result = await service.uploadSpaServiceImage('Tắm', '/uploads/dog-new.jpg', 'Tắm', 'Chó')

    expect(result).toEqual({ species: 'Chó', packageCode: 'Tắm', imageUrl: '/uploads/dog-new.jpg', label: 'Tắm' })
    expect(db.systemConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        spaServiceImages: JSON.stringify([
          { species: 'Mèo', packageCode: 'Tắm', imageUrl: '/uploads/cat.jpg' },
          { species: 'Chó', packageCode: 'Tắm', imageUrl: '/uploads/dog-new.jpg', label: 'Tắm' },
        ]),
      },
    })
  })

  it('preserves imageUrl in hotel extra services', async () => {
    db.systemConfig.findFirst.mockResolvedValue({ id: 'config-1' })

    const result = await service.bulkUpsertHotelExtraServices({
      services: [{
        sku: 'EX001',
        name: 'Đưa đón',
        minWeight: 0,
        maxWeight: null,
        price: 100000,
        imageUrl: '/uploads/hotel-extra/transfer.jpg',
      }],
    } as any)

    expect(result).toEqual([expect.objectContaining({ imageUrl: '/uploads/hotel-extra/transfer.jpg' })])
    expect(db.systemConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        hotelExtraServices: JSON.stringify([{
          sku: 'EX001',
          name: 'Đưa đón',
          minWeight: 0,
          maxWeight: null,
          price: 100000,
          imageUrl: '/uploads/hotel-extra/transfer.jpg',
        }]),
      },
    })
  })

  it('updates hotel service images by species and keeps the other species image', async () => {
    db.$queryRawUnsafe
      .mockResolvedValueOnce([{
        id: 'config-1',
        hotelServiceImages: JSON.stringify([
          { species: 'Chó', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-dog-old.jpg' },
          { species: 'Mèo', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-cat.jpg' },
        ]),
      }])
      .mockResolvedValueOnce([{ id: 'config-1', hotelServiceImages: null }])

    const result = await service.uploadHotelServiceImage('Chó', '/uploads/hotel-dog-new.jpg', 'Hotel Chó')

    expect(result).toEqual({ species: 'Chó', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-dog-new.jpg', label: 'Hotel Chó' })
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE system_configs'),
      JSON.stringify([
          { species: 'Mèo', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-cat.jpg' },
          { species: 'Chó', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-dog-new.jpg', label: 'Hotel Chó' },
      ]),
      'config-1',
    )
  })

  it('ensures hotel service image column before raw listing', async () => {
    db.$queryRawUnsafe.mockResolvedValueOnce([
      { id: 'config-1', hotelServiceImages: JSON.stringify([{ species: 'Chó', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-dog.jpg' }]) },
    ])

    await expect(service.listHotelServiceImages()).resolves.toEqual([
      { species: 'Chó', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-dog.jpg' },
    ])
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('"hotelServiceImages"'))
  })

  it('lists hotel service images when Prisma client has not been regenerated for the column', async () => {
    db.$queryRawUnsafe = jest.fn().mockResolvedValue([
      {
        id: 'config-1',
        hotelServiceImages: JSON.stringify([{ species: 'Chó', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-dog.jpg' }]),
      },
    ])

    await expect(service.listHotelServiceImages()).resolves.toEqual([
      { species: 'Chó', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-dog.jpg' },
    ])
    expect(db.systemConfig.findFirst).not.toHaveBeenCalled()
  })

  it('exports Grooming workbook with dog, cat, other, and decode sheets', async () => {
    const ExcelJS = await import('exceljs')
    db.serviceWeightBand.findMany.mockResolvedValue([
      { id: 'dog-small', serviceType: 'GROOMING', species: 'Chó', label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0, isActive: true },
      { id: 'cat-small', serviceType: 'GROOMING', species: 'Mèo', label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0, isActive: true },
    ])
    db.spaPriceRule.findMany.mockResolvedValue([
      { id: 'dog-bath', species: 'Chó', packageCode: 'Tắm', label: 'Tắm', weightBandId: 'dog-small', sku: 'CT03', price: 50000, durationMinutes: 30, isActive: true, weightBand: { id: 'dog-small', species: 'Chó', label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0 } },
      { id: 'cat-bath', species: 'Mèo', packageCode: 'Tắm', label: 'Tắm', weightBandId: 'cat-small', sku: 'MT03', price: 60000, durationMinutes: 35, isActive: true, weightBand: { id: 'cat-small', species: 'Mèo', label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0 } },
      { id: 'other-ear', species: null, packageCode: 'Vệ sinh tai', label: 'Vệ sinh tai', weightBandId: null, minWeight: 0, maxWeight: null, sku: 'VST', price: 30000, durationMinutes: 10, isActive: true, weightBand: null },
    ])
    db.systemConfig.findFirst.mockResolvedValue({
      spaServiceImages: JSON.stringify([{ species: null, packageCode: 'Vệ sinh tai', imageUrl: '/uploads/ear.jpg' }]),
    })

    const buffer = await service.exportPricingExcel({ mode: 'GROOMING', year: 2026 })
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Grooming Chó', 'Grooming Mèo', 'Grooming Khác', 'Giải mã'])
    expect(workbook.getWorksheet('Grooming Chó')!.getRow(1).values).toEqual(expect.arrayContaining(['Số tiền - Tắm', 'SKU - Tắm', 'Thời gian - Tắm']))
    expect(workbook.getWorksheet('Grooming Chó')!.getRow(2).getCell(5).value).toBe(50000)
    expect(workbook.getWorksheet('Grooming Khác')!.getRow(2).getCell(3).value).toBe('/uploads/ear.jpg')
    expect(workbook.getWorksheet('Giải mã')!.getRow(2).getCell(2).value).toBe('PRICING_EXCEL_V1')
  })

  it('exports Hotel workbook for the selected year with dog and cat pricing columns', async () => {
    const ExcelJS = await import('exceljs')
    db.serviceWeightBand.findMany.mockResolvedValue([
      { id: 'hotel-small', serviceType: 'HOTEL', species: null, label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0, isActive: true },
    ])
    db.hotelPriceRule.findMany.mockResolvedValue([
      { id: 'hotel-dog-regular', year: 2026, species: 'Chó', dayType: 'REGULAR', weightBandId: 'hotel-small', sku: 'CHT03', fullDayPrice: 120000, halfDayPrice: 60000, isActive: true, weightBand: { id: 'hotel-small' } },
      { id: 'hotel-dog-holiday', year: 2026, species: 'Chó', dayType: 'HOLIDAY', weightBandId: 'hotel-small', sku: 'CHT03', fullDayPrice: 150000, halfDayPrice: 75000, isActive: true, weightBand: { id: 'hotel-small' } },
    ])
    db.$queryRawUnsafe.mockResolvedValue([
      { id: 'config-1', hotelServiceImages: JSON.stringify([{ species: 'Chó', packageCode: 'HOTEL', imageUrl: '/uploads/hotel-dog.jpg' }]) },
    ])

    const buffer = await service.exportPricingExcel({ mode: 'HOTEL', year: 2026 })
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Hotel', 'Giải mã'])
    expect(workbook.getWorksheet('Hotel')!.getRow(1).values).toEqual(expect.arrayContaining(['Chó - SKU', 'Chó - Ngày thường', 'Chó - Ngày lễ', 'Mèo - Ngày thường']))
    expect(workbook.getWorksheet('Hotel')!.getRow(2).getCell(6).value).toBe(120000)
    expect(workbook.getWorksheet('Hotel')!.getRow(2).getCell(7).value).toBe(150000)
    expect(workbook.getWorksheet('Giải mã')!.getRow(2).getCell(2).value).toBe('PRICING_EXCEL_V1')
    expect(workbook.getWorksheet('Giải mã')!.getRow(6).getCell(2).value).toBe('/uploads/hotel-dog.jpg')
  })

  it('previews invalid Grooming workbook with structured missing sheet errors', async () => {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    workbook.addWorksheet('Grooming Chó').addRow(['Tên hạng cân', 'Từ kg'])

    const result = await service.previewPricingExcelImport({
      mode: 'GROOMING',
      year: 2026,
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    })

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ sheet: 'Grooming Mèo', message: expect.stringContaining('Thiếu sheet') }),
      expect.objectContaining({ sheet: 'Grooming Chó', message: expect.stringContaining('Mã hạng cân') }),
    ]))
    expect(result.summary.errorCount).toBeGreaterThan(0)
    expect(result.normalizedPayload).toBeNull()
  })

  it('applies Grooming import in a transaction and deactivates pricing rows missing from the snapshot', async () => {
    const ExcelJS = await import('exceljs')
    const existingBand = { id: 'dog-small', serviceType: 'GROOMING', species: 'Chó', label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0, isActive: true }
    db.$transaction = jest.fn(async (callback) => callback(db))
    db.serviceWeightBand.findMany.mockResolvedValue([existingBand])
    db.serviceWeightBand.update = jest.fn().mockResolvedValue(existingBand)
    db.serviceWeightBand.create = jest.fn()
    db.serviceWeightBand.updateMany = jest.fn()
    db.spaPriceRule.findMany.mockResolvedValue([
      { id: 'old-dog-bath', species: 'Chó', packageCode: 'Tắm', weightBandId: 'dog-small', minWeight: null, maxWeight: null, isActive: true },
      { id: 'old-remove', species: 'Chó', packageCode: 'Cạo', weightBandId: 'dog-small', minWeight: null, maxWeight: null, isActive: true },
    ])
    db.spaPriceRule.update = jest.fn().mockResolvedValue({ id: 'old-dog-bath' })
    db.spaPriceRule.create = jest.fn()
    db.spaPriceRule.updateMany = jest.fn()
    jest.spyOn(service, 'createPricingBackupSnapshot').mockResolvedValue({ createdAt: 'backup' } as any)

    const workbook = new ExcelJS.default.Workbook()
    const dog = workbook.addWorksheet('Grooming Chó')
    dog.addRow(['Mã hạng cân', 'Tên hạng cân', 'Từ kg', 'Đến kg', 'Số tiền - Tắm', 'SKU - Tắm', 'Thời gian - Tắm'])
    dog.addRow(['dog-small', 'Dưới 3kg', 0, 3, 55000, 'CT03', 30])
    const cat = workbook.addWorksheet('Grooming Mèo')
    cat.addRow(['Mã hạng cân', 'Tên hạng cân', 'Từ kg', 'Đến kg'])
    const other = workbook.addWorksheet('Grooming Khác')
    other.addRow(['Mã rule', 'SKU', 'Link ảnh', 'Tên dịch vụ', 'Từ kg', 'Đến kg', 'Giá', 'Phút'])
    const decode = workbook.addWorksheet('Giải mã')
    decode.addRow(['Khóa', 'Giá trị', 'Ghi chú'])
    decode.addRow(['version', 'PRICING_EXCEL_V1', ''])

    const result = await service.applyPricingExcelImport({
      mode: 'GROOMING',
      year: 2026,
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    })

    expect(result.summary.ruleCount).toBe(1)
    expect(db.$transaction).toHaveBeenCalled()
    expect(db.spaPriceRule.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-dog-bath' },
      data: expect.objectContaining({ price: 55000, sku: 'CT03', isActive: true }),
    }))
    expect(db.spaPriceRule.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { notIn: ['old-dog-bath'] }, isActive: true }),
      data: { isActive: false },
    }))
  })

})
