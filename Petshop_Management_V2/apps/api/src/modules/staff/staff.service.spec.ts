import { StaffService } from './staff.service'

describe('StaffService listing', () => {
  it('hides the root superadmin from staff management lists', async () => {
    const db = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const service = new StaffService(db as any)

    await service.findAll()

    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { username: { not: 'superadmin' } },
    }))
  })

  it('includes profile and compensation fields used by the staff list', async () => {
    const db = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const service = new StaffService(db as any)

    await service.findAll()

    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        dob: true,
        identityCode: true,
        emergencyContactTitle: true,
        emergencyContactPhone: true,
        joinDate: true,
        spaCommissionRate: true,
        salaryBankName: true,
        salaryBankAccount: true,
      }),
    }))
  })

  it('includes branch and salary bank fields in staff details', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
    }
    const service = new StaffService(db as any)

    await service.findById('staff-1')

    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        branch: { select: { id: true, name: true } },
        salaryBankName: true,
        salaryBankAccount: true,
      }),
    }))
  })
})

describe('StaffService self update', () => {
  it('only updates avatar, password, and salary bank fields for the current staff member', async () => {
    const db = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
    }
    const service = new StaffService(db as any)

    await service.updateSelf('staff-1', {
      avatar: 'storage/private/avatar.png',
      password: 'secret123',
      salaryBankName: 'VCB',
      salaryBankAccount: '0123456789',
      fullName: 'Should Not Update',
      branchId: 'branch-2',
      baseSalary: 999999999,
    } as any)

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      data: expect.objectContaining({
        avatar: 'storage/private/avatar.png',
        salaryBankName: 'VCB',
        salaryBankAccount: '0123456789',
      }),
      select: expect.any(Object),
    })
    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty('fullName')
    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty('branchId')
    expect(db.user.update.mock.calls[0][0].data).not.toHaveProperty('baseSalary')
    expect(db.user.update.mock.calls[0][0].data.passwordHash).toEqual(expect.any(String))
  })
})

describe('StaffService role restrictions', () => {
  it('rejects assigning the SUPER_ADMIN role to a regular staff account', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: 'role-super', code: 'SUPER_ADMIN' }),
      },
    }
    const service = new StaffService(db as any)

    await expect(service.create({
      username: 'staff1',
      fullName: 'Staff One',
      role: 'role-super',
    })).rejects.toThrow('Chủ cửa hàng chỉ dành cho tài khoản superadmin')
  })
})

describe('StaffService phone uniqueness', () => {
  it('rejects creating a staff member with a phone used by another staff member', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-staff', phone: '0901234567' }),
        count: jest.fn(),
        create: jest.fn(),
      },
    }
    const service = new StaffService(db as any)

    await expect(service.create({
      username: 'newstaff',
      fullName: 'New Staff',
      phone: '0901234567',
    })).rejects.toThrow('Số điện thoại đã được sử dụng bởi người khác')
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('rejects updating a staff member to a phone used by another staff member', async () => {
    const db = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'staff-1', username: 'staff1' })
          .mockResolvedValueOnce({ id: 'staff-2', phone: '0901234567' }),
        update: jest.fn(),
      },
    }
    const service = new StaffService(db as any)

    await expect(service.update('staff-1', { phone: '0901234567' }))
      .rejects.toThrow('Số điện thoại đã được sử dụng bởi người khác')
    expect(db.user.update).not.toHaveBeenCalled()
  })
})

describe('StaffService documents', () => {
  it('stores staff document as a private storage key instead of a public uploads URL', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      employeeDocument: {
        create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      },
    }
    const service = new StaffService(db as any)

    await service.uploadDocument(
      'user-1',
      'admin-1',
      {
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
        size: 128,
        filename: 'stored.pdf',
      } as Express.Multer.File,
      { type: 'CONTRACT' as any },
    )

    expect(db.employeeDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileUrl: 'documents/user-1/stored.pdf',
      }),
    })
  })
})

describe('StaffService activity logs', () => {
  it('loads real staff activity logs ordered by newest first', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      activityLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'log-1',
            userId: 'user-1',
            action: 'STAFF_UPDATED',
            target: 'staff',
            targetId: 'user-1',
            details: { fields: ['phone'] },
            ipAddress: '127.0.0.1',
            createdAt: new Date('2026-04-30T10:00:00.000Z'),
            user: { id: 'admin-1', fullName: 'Admin', staffCode: 'NV00001' },
          },
        ]),
      },
    }
    const service = new StaffService(db as any)

    const result = await service.getActivityLogs('user-1')

    expect(db.activityLog.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        userId: true,
        action: true,
        target: true,
        targetId: true,
        details: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, staffCode: true } },
      },
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'log-1',
      action: 'STAFF_UPDATED',
      target: 'staff',
      targetId: 'user-1',
    }))
  })

  it('returns an empty activity log list when a staff member has no logs', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      activityLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const service = new StaffService(db as any)

    await expect(service.getActivityLogs('user-1')).resolves.toEqual([])
  })
})

describe('StaffService performance metrics', () => {
  it('returns a six month chart from batched aggregate queries', async () => {
    const orderAggregate = jest
      .fn()
      .mockResolvedValueOnce({ _count: { id: 2 }, _sum: { total: 300000 } })
      .mockResolvedValue({ _count: { id: 1 }, _sum: { total: 100000 } })
    const groomingAggregate = jest
      .fn()
      .mockResolvedValueOnce({ _count: { id: 3 } })
      .mockResolvedValue({ _count: { id: 1 } })
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      order: {
        aggregate: orderAggregate,
      },
      groomingSession: {
        aggregate: groomingAggregate,
      },
    }
    const service = new StaffService(db as any)

    const result = await service.getPerformanceMetrics('user-1', 4, 2026)

    expect(result.monthlyRevenue).toBe(300000)
    expect(result.monthlySpaSessions).toBe(3)
    expect(result.monthlyOrders).toBe(2)
    expect(result.chartData).toHaveLength(6)
    expect(orderAggregate).toHaveBeenCalledTimes(7)
    expect(groomingAggregate).toHaveBeenCalledTimes(7)
  })
})

describe('StaffService bulk operations', () => {
  it('hard deletes a staff member inside a transaction', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1', username: 'oldstaff' }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({ id: 'user-1', staffCode: 'NV00001' }),
      },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      groomingSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      hotelStay: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      stockReceiptReceive: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      supplierPayment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      supplierReturn: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      supplierReturnRefund: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      transaction: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      stockTransaction: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      cashVaultEntry: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      activityLog: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      orderTimeline: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      groomingTimeline: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      hotelStayTimeline: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      hotelStayHealthLog: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      attendanceRecord: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      leaveRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      payrollPeriod: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      stockCountSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      stockCountShiftSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      storedAsset: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      equipment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      equipmentHistory: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      payrollSlip: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      staffSchedule: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      shiftSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    }
    const db = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    }
    const service = new StaffService(db as any)

    await service.hardDelete('user-1')

    expect(db.$transaction).toHaveBeenCalled()
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { authorizedBranches: { set: [] }, assignedGroomingSessions: { set: [] } },
    })
    expect(tx.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, staffCode: true },
    })
  })

  it('does not hard delete the bootstrap superadmin account', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'root-1', username: 'superadmin' }),
      },
    }
    const db = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    }
    const service = new StaffService(db as any)

    await expect(service.hardDelete('root-1')).rejects.toThrow('Khong the xoa tai khoan Super Admin goc')
  })

  it('bulk updates only branch, shift, salary, and employment type fields', async () => {
    const db = {
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    }
    const service = new StaffService(db as any)

    const result = await service.bulkUpdate(['u1', 'u2'], {
      branchId: 'branch-1',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      baseSalary: 12000000,
      employmentType: 'PART_TIME',
    })

    expect(result).toEqual({ success: true, updatedIds: ['u1', 'u2'], count: 2 })
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'u2'] } },
      data: {
        branchId: 'branch-1',
        shiftStart: '09:00',
        shiftEnd: '18:00',
        baseSalary: 12000000,
        employmentType: 'PART_TIME',
      },
    })
  })
})
