import { CustomerService } from './customer.service'

describe('CustomerService', () => {
  it('creates the next sequential customer code from the last valid numeric suffix', async () => {
    const db = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ maxNumber: 4 }]),
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: 'branch-main', code: 'HCM', name: 'HCM', isMain: true }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      customerGroup: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'customer-1',
          ...data,
        })),
      },
    } as any

    const service = new CustomerService(db)

    const result = await service.create({
      fullName: 'Khach test',
      phone: '0900000005',
    })

    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM "customers"'),
    )
    expect(db.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerCode: 'KH000005',
        }),
      }),
    )
    expect(result.data.customerCode).toBe('KH000005')
  })
})
