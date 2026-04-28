import { PricingService } from './pricing.service'

describe('PricingService Excel grooming pricing', () => {
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

  it('backs up all pricing datasets before destructive pricing changes', async () => {
    db.serviceWeightBand.findMany.mockResolvedValue([{ id: 'band-1' }])
    db.spaPriceRule.findMany.mockResolvedValue([{ id: 'spa-1' }])
    db.hotelPriceRule.findMany.mockResolvedValue([{ id: 'hotel-1' }])
    db.holidayCalendarDate.findMany.mockResolvedValue([{ id: 'holiday-1' }])
    db.systemConfig.findFirst.mockResolvedValue({
      id: 'config-1',
      hotelExtraServices: '[{"name":"Đưa đón","price":10000}]',
      spaServiceImages: '[{"species":"Chó","packageCode":"Tắm","imageUrl":"/uploads/dog.jpg"}]',
      hotelServiceImages: '[{"species":"Chó","packageCode":"HOTEL","imageUrl":"/uploads/hotel-dog.jpg"}]',
    })

    const snapshot = await service.createPricingBackupSnapshot()

    expect(snapshot).toEqual(expect.objectContaining({
      weightBands: [{ id: 'band-1' }],
      spaRules: [{ id: 'spa-1' }],
      hotelRules: [{ id: 'hotel-1' }],
      holidays: [{ id: 'holiday-1' }],
      systemConfig: expect.objectContaining({
        hotelExtraServices: '[{"name":"Đưa đón","price":10000}]',
        spaServiceImages: '[{"species":"Chó","packageCode":"Tắm","imageUrl":"/uploads/dog.jpg"}]',
        hotelServiceImages: '[{"species":"Chó","packageCode":"HOTEL","imageUrl":"/uploads/hotel-dog.jpg"}]',
      }),
    }))
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

  it('exports the full pricing workbook shape used for roundtrip backup', async () => {
    const ExcelJS = await import('exceljs')
    db.serviceWeightBand.findMany
      .mockResolvedValueOnce([{ id: 'g-dog-small', serviceType: 'GROOMING', species: 'Chó', label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0, isActive: true }])
      .mockResolvedValueOnce([{ id: 'h-small', serviceType: 'HOTEL', species: null, label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0, isActive: true }])
      .mockResolvedValueOnce([{ id: 'g-dog-small', serviceType: 'GROOMING', species: 'Chó', label: 'Dưới 3kg', minWeight: 0, maxWeight: 3, sortOrder: 0, isActive: true }])
    db.spaPriceRule.findMany.mockResolvedValue([
      { id: 'spa-1', species: 'Chó', packageCode: 'Tắm', label: 'Tắm', weightBandId: 'g-dog-small', minWeight: null, maxWeight: null, sku: 'CT03', price: 50000, durationMinutes: 30, isActive: true, weightBand: { id: 'g-dog-small' } },
      { id: 'spa-flat-1', species: null, packageCode: 'Vệ sinh tai', label: 'Vệ sinh tai', weightBandId: null, minWeight: 0, maxWeight: null, sku: 'VST', price: 30000, durationMinutes: 10, isActive: true, weightBand: null },
    ])
    db.hotelPriceRule.findMany.mockResolvedValue([
      { id: 'hotel-1', year: 2026, species: 'Chó', dayType: 'REGULAR', weightBandId: 'h-small', sku: 'CHT03', fullDayPrice: 120000, halfDayPrice: 60000, isActive: true, weightBand: { id: 'h-small' } },
    ])
    db.holidayCalendarDate.findMany.mockResolvedValue([{ id: 'holiday-1', date: new Date(Date.UTC(2026, 0, 1)), endDate: null, name: 'Tết', isRecurring: true, isActive: true }])
    db.systemConfig.findFirst.mockResolvedValue({
      hotelExtraServices: JSON.stringify([{ sku: 'HE001', name: 'Đưa đón', minWeight: 0, maxWeight: null, price: 100000, imageUrl: '/uploads/hotel-extra.jpg' }]),
      spaServiceImages: JSON.stringify([{ species: 'Chó', packageCode: 'Tắm', imageUrl: '/uploads/dog-bath.jpg' }]),
      hotelServiceImages: JSON.stringify([{ species: 'Chó', packageCode: 'HOTEL', label: 'Hotel Chó', imageUrl: '/uploads/hotel-dog.jpg' }]),
    })
    db.$queryRawUnsafe.mockResolvedValue([
      { id: 'config-1', hotelServiceImages: JSON.stringify([{ species: 'Chó', packageCode: 'HOTEL', label: 'Hotel Chó', imageUrl: '/uploads/hotel-dog.jpg' }]) },
    ])

    const buffer = await service.exportToExcel('all')
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(expect.arrayContaining([
      'Grooming Matrix',
      'Grooming Other',
      'Hotel Matrix',
      'Hotel Extra',
      'Weight Bands',
      'Holidays',
      'Service Images',
    ]))
    expect(workbook.getWorksheet('Hotel Matrix')!.getRow(1).values).toEqual(expect.arrayContaining(['imageUrl']))
    expect(workbook.getWorksheet('Hotel Matrix')!.getRow(2).getCell('K').value).toBe('/uploads/hotel-dog.jpg')
    expect(workbook.getWorksheet('Service Images')!.getRow(1).values).toEqual([
      undefined,
      'serviceType',
      'species',
      'packageCode',
      'label',
      'imageUrl',
    ])
    expect(workbook.getWorksheet('Grooming Matrix')!.getRow(1).values).toEqual([
      undefined,
      'id',
      'species',
      'packageCode',
      'label',
      'weightBandId',
      'weightBandLabel',
      'minWeight',
      'maxWeight',
      'sku',
      'price',
      'durationMinutes',
      'imageUrl',
      'isActive',
    ])
  })

  it('exports only the backup workbook sheets and includes README guidance', async () => {
    const ExcelJS = await import('exceljs')
    db.serviceWeightBand.findMany.mockResolvedValue([])
    db.spaPriceRule.findMany.mockResolvedValue([])
    db.hotelPriceRule.findMany.mockResolvedValue([])
    db.holidayCalendarDate.findMany.mockResolvedValue([])
    db.systemConfig.findFirst.mockResolvedValue(null)
    db.$queryRawUnsafe.mockResolvedValue([])

    const buffer = await service.exportToExcel('all')
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'README',
      'Grooming Matrix',
      'Grooming Other',
      'Hotel Matrix',
      'Hotel Extra',
      'Weight Bands',
      'Holidays',
      'Service Images',
    ])
    expect(workbook.getWorksheet('Grooming')).toBeUndefined()
    expect(workbook.getWorksheet('Hotel')).toBeUndefined()
    expect(String(workbook.getWorksheet('README')!.getRow(2).getCell(1).value)).toContain('backup')
  })

  it('imports backup workbook rows by stable signatures when ids are blank', async () => {
    const ExcelJS = await import('exceljs')
    const existingBand = {
      id: 'band-existing',
      serviceType: 'GROOMING',
      species: 'Cho',
      label: 'Duoi 3kg',
      minWeight: 0,
      maxWeight: 3,
      sortOrder: 0,
      isActive: true,
    }
    db.serviceWeightBand.findMany.mockResolvedValue([existingBand])
    jest.spyOn(service, 'upsertWeightBand').mockResolvedValue(existingBand as any)
    const bulkUpsertSpaRules = jest.spyOn(service, 'bulkUpsertSpaRules').mockResolvedValue([] as any)
    jest.spyOn(service, 'bulkUpdateSpaServiceImages').mockResolvedValue([] as any)
    jest.spyOn(service, 'bulkUpdateHotelServiceImages').mockResolvedValue([] as any)
    jest.spyOn(service, 'createHoliday').mockResolvedValue({} as any)
    jest.spyOn(service, 'createPricingBackupSnapshot').mockResolvedValue({ createdAt: 'backup' } as any)

    const workbook = new ExcelJS.default.Workbook()
    const bands = workbook.addWorksheet('Weight Bands')
    bands.addRow(['id', 'serviceType', 'species', 'label', 'minWeight', 'maxWeight', 'sortOrder', 'isActive'])
    bands.addRow(['', 'GROOMING', 'Cho', 'Duoi 3kg', 0, 3, 0, true])
    const grooming = workbook.addWorksheet('Grooming Matrix')
    grooming.addRow(['id', 'species', 'packageCode', 'label', 'weightBandId', 'weightBandLabel', 'minWeight', 'maxWeight', 'sku', 'price', 'durationMinutes', 'imageUrl', 'isActive'])
    grooming.addRow(['', 'Cho', 'Tam', 'Tam', '', 'Duoi 3kg', 0, 3, 'SPA001', 120000, 45, '/uploads/tam.jpg', true])

    const result = await service.importFromExcel(Buffer.from(await workbook.xlsx.writeBuffer()))

    expect(result.errors).toEqual([])
    expect((result as any).details).toEqual(expect.arrayContaining([
      expect.objectContaining({ sheet: 'Weight Bands', imported: 1 }),
      expect.objectContaining({ sheet: 'Grooming Matrix', imported: 1 }),
    ]))
    expect((result as any).summary).toEqual(expect.objectContaining({ imported: expect.any(Number), errors: 0 }))
    expect(bulkUpsertSpaRules).toHaveBeenCalledWith({
      rules: [expect.objectContaining({ weightBandId: 'band-existing', sku: 'SPA001', price: 120000, durationMinutes: 45 })],
    })
  })

  it('reports structured row errors when a price row cannot resolve its weight band', async () => {
    const ExcelJS = await import('exceljs')
    db.serviceWeightBand.findMany.mockResolvedValue([])
    jest.spyOn(service, 'createPricingBackupSnapshot').mockResolvedValue({ createdAt: 'backup' } as any)

    const workbook = new ExcelJS.default.Workbook()
    const grooming = workbook.addWorksheet('Grooming Matrix')
    grooming.addRow(['id', 'species', 'packageCode', 'label', 'weightBandId', 'weightBandLabel', 'minWeight', 'maxWeight', 'sku', 'price', 'durationMinutes', 'imageUrl', 'isActive'])
    grooming.addRow(['', 'Cho', 'Tam', 'Tam', '', 'Khong co', 0, 3, 'SPA001', 120000, 45, '', true])

    const result = await service.importFromExcel(Buffer.from(await workbook.xlsx.writeBuffer()))

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect((result as any).details).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sheet: 'Grooming Matrix',
        row: 2,
        message: expect.stringContaining('Khong tim thay hang can'),
      }),
    ]))
  })
})
