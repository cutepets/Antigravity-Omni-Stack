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

  it('exports grooming durations for each weight band', async () => {
    const ExcelJS = await import('exceljs')
    const bands = [
      { id: 'band-small', serviceType: 'GROOMING', label: 'Dưới 1,5kg', minWeight: 0, maxWeight: 1.5, sortOrder: 0, isActive: true },
      { id: 'band-medium', serviceType: 'GROOMING', label: '1,5 - 3kg', minWeight: 1.5, maxWeight: 3, sortOrder: 1, isActive: true },
    ]
    db.serviceWeightBand.findMany
      .mockResolvedValueOnce(bands)
      .mockResolvedValueOnce(bands)
    db.spaPriceRule.findMany.mockResolvedValue([
      { packageCode: 'Chỉ tắm', label: 'Chỉ tắm', weightBandId: 'band-small', price: 50000, durationMinutes: 20 },
      { packageCode: 'Chỉ tắm', label: 'Chỉ tắm', weightBandId: 'band-medium', price: 70000, durationMinutes: 35 },
    ])

    const buffer = await service.exportToExcel('grooming')
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)
    const sheet = workbook.getWorksheet('Grooming')!

    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'Gói dịch vụ',
      'Tên hiển thị',
      'Dưới 1,5kg',
      'Dưới 1,5kg - Thời lượng (phút)',
      '1,5 - 3kg',
      '1,5 - 3kg - Thời lượng (phút)',
    ])
    expect(sheet.getRow(2).values).toEqual([
      undefined,
      'Chỉ tắm',
      'Chỉ tắm',
      50000,
      20,
      70000,
      35,
    ])
  })

  it('imports grooming durations from each weight band column pair', async () => {
    const ExcelJS = await import('exceljs')
    const bands = [
      { id: 'band-small', serviceType: 'GROOMING', label: 'Dưới 1,5kg', isActive: true },
      { id: 'band-medium', serviceType: 'GROOMING', label: '1,5 - 3kg', isActive: true },
    ]
    db.serviceWeightBand.findMany.mockResolvedValue(bands)
    const bulkUpsertSpaRules = jest.spyOn(service, 'bulkUpsertSpaRules').mockResolvedValue([] as any)

    const workbook = new ExcelJS.default.Workbook()
    const sheet = workbook.addWorksheet('Grooming')
    sheet.addRow([
      'Gói dịch vụ',
      'Tên hiển thị',
      'Dưới 1,5kg',
      'Dưới 1,5kg - Thời lượng (phút)',
      '1,5 - 3kg',
      '1,5 - 3kg - Thời lượng (phút)',
    ])
    sheet.addRow(['Chỉ tắm', 'Chỉ tắm', 50000, 20, 70000, 35])
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

    const result = await service.importFromExcel(buffer)

    expect(result).toEqual({ imported: 2, errors: [] })
    expect(bulkUpsertSpaRules).toHaveBeenCalledWith({
      rules: [
        expect.objectContaining({ packageCode: 'Chỉ tắm', weightBandId: 'band-small', price: 50000, durationMinutes: 20 }),
        expect.objectContaining({ packageCode: 'Chỉ tắm', weightBandId: 'band-medium', price: 70000, durationMinutes: 35 }),
      ],
    })
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
})
