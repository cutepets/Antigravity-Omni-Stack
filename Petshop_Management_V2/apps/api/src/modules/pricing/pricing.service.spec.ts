import { PricingService } from './pricing.service'

describe('PricingService Excel grooming pricing', () => {
  let service: PricingService
  let db: any

  beforeEach(() => {
    db = {
      serviceWeightBand: {
        findMany: jest.fn(),
      },
      spaPriceRule: {
        findMany: jest.fn(),
      },
      hotelPriceRule: {
        findMany: jest.fn(),
      },
    }
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
})
