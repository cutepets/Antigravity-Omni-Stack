import { CustomerService } from './customer.service'

describe('CustomerService', () => {
  const makeFindAllDb = () => ({
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  } as any)

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

  it('maps customer list UI sort keys to real database fields', async () => {
    const db = makeFindAllDb()
    const service = new CustomerService(db)

    await service.findAll({ sortBy: 'name', sortOrder: 'asc' })

    expect(db.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { fullName: 'asc' },
      }),
    )
  })

  it('falls back to createdAt sort when customer list receives an unsupported sort key', async () => {
    const db = makeFindAllDb()
    const service = new CustomerService(db)

    await service.findAll({ sortBy: 'orders', sortOrder: 'asc' })

    expect(db.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
      }),
    )
  })
})
