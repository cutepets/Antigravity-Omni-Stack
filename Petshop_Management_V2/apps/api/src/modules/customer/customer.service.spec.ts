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

  it('does not persist legacy supplier flags on customer create payloads', async () => {
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

    await service.create({
      fullName: 'Khach test',
      phone: '0900000005',
      isSupplier: true,
      supplierCode: 'NCC0001',
    } as any)

    expect(db.customer.findFirst).not.toHaveBeenCalledWith({ where: { supplierCode: 'NCC0001' } })
    expect(db.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          isSupplier: expect.anything(),
          supplierCode: expect.anything(),
        }),
      }),
    )
  })

  it('does not persist legacy supplier flags on customer update payloads', async () => {
    const db = {
      customer: {
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-1', phone: '0900000005' }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
    } as any
    const service = new CustomerService(db)

    await service.update('customer-1', {
      fullName: 'Khach test',
      isSupplier: true,
      supplierCode: 'NCC0001',
    } as any)

    expect(db.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: { fullName: 'Khach test' },
    })
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

  it('searches customers globally even when the active branch is different', async () => {
    const customer = {
      id: 'customer-nguyen-khang',
      customerCode: 'KH000001',
      fullName: 'Phan Duc Thanh',
      phone: '0949111520',
      email: null,
      branchId: 'branch-nguyen-khang',
    }
    const db = {
      customer: {
        findMany: jest.fn().mockResolvedValue([customer]),
      },
    } as any
    const service = new CustomerService(db)

    const result = await service.findAll(
      { search: '0949111520', limit: 10 },
      {
        userId: 'staff-kham-thien',
        role: 'STAFF',
        permissions: ['customer.read.assigned'],
        branchId: 'branch-kham-thien',
        authorizedBranchIds: ['branch-kham-thien'],
      } as any,
    )

    expect(db.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ branchId: 'branch-kham-thien' }),
          ]),
        }),
      }),
    )
    expect(result.data).toEqual([customer])
  })

  it('uses database searchable fields before limiting customer search results', async () => {
    const db = {
      customer: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any
    const service = new CustomerService(db)

    await service.findAll({ search: '0949111520', limit: 10 })

    expect(db.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { phone: { contains: '0949111520', mode: 'insensitive' } },
            { customerCode: { contains: '0949111520', mode: 'insensitive' } },
            { email: { contains: '0949111520', mode: 'insensitive' } },
          ]),
        }),
      }),
    )
  })

  it('lists customer point history ordered newest first after scope check', async () => {
    const db = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerPointHistory: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'history-2', delta: -5, balanceBefore: 15, balanceAfter: 10 },
          { id: 'history-1', delta: 15, balanceBefore: 0, balanceAfter: 15 },
        ]),
      },
    } as any
    const service = new CustomerService(db)

    const result = await service.getPointHistory('customer-1', {
      userId: 'admin-1',
      role: 'ADMIN',
      permissions: ['customer.read.all'],
    } as any)

    expect(db.customerPointHistory.findMany).toHaveBeenCalledWith({
      where: { customerId: 'customer-1' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { id: true, fullName: true, username: true } } },
    })
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
  })

  it('adds manual customer points and records before and after balances', async () => {
    const db: any = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'customer-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-1', points: 20 }),
        update: jest.fn().mockResolvedValue({ id: 'customer-1', points: 35 }),
      },
      customerPointHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
      $transaction: jest.fn(async (callback: any) => callback(db)),
    }
    const service = new CustomerService(db)

    const result = await service.adjustPoints(
      'customer-1',
      { delta: 15, reason: 'Thưởng điểm' },
      { userId: 'admin-1', role: 'ADMIN', permissions: ['loyalty.manage'] } as any,
    )

    expect(db.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: { points: 35 },
    })
    expect(db.customerPointHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'customer-1',
        actorId: 'admin-1',
        delta: 15,
        balanceBefore: 20,
        balanceAfter: 35,
        source: 'MANUAL_ADJUSTMENT',
        reason: 'Thưởng điểm',
      }),
      include: { actor: { select: { id: true, fullName: true, username: true } } },
    })
    expect(result.data.customer.points).toBe(35)
  })

  it('rejects manual customer point adjustments from non-admin users', async () => {
    const db: any = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'customer-1' }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      customerPointHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(db)),
    }
    const service = new CustomerService(db)

    await expect(service.adjustPoints(
      'customer-1',
      { delta: 15, reason: 'Thưởng điểm' },
      { userId: 'staff-1', role: 'STAFF', permissions: ['loyalty.manage', 'branch.access.all'] } as any,
    )).rejects.toThrow('Chỉ Super Admin hoặc Admin mới được điều chỉnh điểm')

    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.customer.update).not.toHaveBeenCalled()
    expect(db.customerPointHistory.create).not.toHaveBeenCalled()
  })

  it('rejects manual point reductions that would make the balance negative', async () => {
    const db: any = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'customer-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-1', points: 20 }),
        update: jest.fn(),
      },
      customerPointHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(db)),
    }
    const service = new CustomerService(db)

    await expect(service.adjustPoints(
      'customer-1',
      { delta: -25, reason: 'Nhập sai' },
      { userId: 'admin-1', role: 'ADMIN', permissions: ['loyalty.manage'] } as any,
    )).rejects.toThrow('Số điểm không được âm')

    expect(db.customer.update).not.toHaveBeenCalled()
    expect(db.customerPointHistory.create).not.toHaveBeenCalled()
  })
})
