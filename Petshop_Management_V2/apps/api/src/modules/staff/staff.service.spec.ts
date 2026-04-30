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
