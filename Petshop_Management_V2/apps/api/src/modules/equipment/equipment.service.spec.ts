import { BadRequestException } from '@nestjs/common'
import { EquipmentService } from './equipment.service'

const makeActor = (overrides?: Partial<{
  userId: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'
  permissions: string[]
  branchId: string
  authorizedBranchIds: string[]
}>) => ({
  userId: 'user-1',
  role: 'STAFF' as const,
  permissions: ['equipment.create', 'equipment.read', 'equipment.update'],
  branchId: 'branch-1',
  authorizedBranchIds: ['branch-1'],
  ...overrides,
})

describe('EquipmentService', () => {
  let service: EquipmentService
  let db: any

  beforeEach(() => {
    db = {
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(),
      equipment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      equipmentCategory: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      equipmentLocationPreset: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      branch: {
        findUnique: jest.fn(),
      },
    }
    service = new EquipmentService(db)
  })

  it('returns a create draft when scanning a valid equipment code that does not exist', async () => {
    db.equipment.findFirst.mockResolvedValue(null)

    const result = await service.resolveScan({ code: 'TB0001' }, makeActor())

    expect(result).toEqual({
      success: true,
      data: {
        found: false,
        draft: {
          code: 'TB0001',
        },
      },
    })
  })

  it('returns the existing equipment when scanning a known code', async () => {
    db.equipment.findFirst.mockResolvedValue({
      id: 'equipment-1',
      code: 'TB0001',
      name: 'MacBook Pro',
      branchId: 'branch-1',
    })

    const result = await service.resolveScan({ code: 'TB0001' }, makeActor())

    expect(result).toEqual({
      success: true,
      data: {
        found: true,
        equipment: {
          id: 'equipment-1',
          code: 'TB0001',
          name: 'MacBook Pro',
          branchId: 'branch-1',
        },
      },
    })
  })

  it('rejects creating equipment when the selected location belongs to another branch', async () => {
    db.equipmentCategory.findUnique.mockResolvedValue({ id: 'category-1', isActive: true })
    db.equipmentLocationPreset.findUnique.mockResolvedValue({
      id: 'location-1',
      branchId: 'branch-2',
      isActive: true,
    })

    await expect(
      service.createEquipment(
        {
          code: 'TB0001',
          name: 'MacBook Pro',
          branchId: 'branch-1',
          categoryId: 'category-1',
          locationPresetId: 'location-1',
        },
        makeActor(),
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('writes equipment history and activity log when creating equipment', async () => {
    db.equipment.findFirst.mockResolvedValue(null)
    db.equipmentCategory.findUnique.mockResolvedValue({ id: 'category-1', isActive: true, name: 'Laptop' })
    db.equipmentLocationPreset.findUnique.mockResolvedValue({
      id: 'location-1',
      branchId: 'branch-1',
      isActive: true,
      name: 'Văn phòng',
    })
    db.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) =>
      callback({
        equipment: {
          create: jest.fn().mockResolvedValue({
            id: 'equipment-1',
            code: 'TB0001',
            name: 'MacBook Pro',
          }),
        },
        equipmentHistory: {
          create: jest.fn().mockResolvedValue({ id: 'history-1' }),
        },
        activityLog: {
          create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
        },
      }),
    )

    const result = await service.createEquipment(
      {
        code: 'TB0001',
        name: 'MacBook Pro',
        branchId: 'branch-1',
        categoryId: 'category-1',
        locationPresetId: 'location-1',
        status: 'IN_USE',
      },
      makeActor(),
    )

    expect(result.success).toBe(true)
    expect(db.$transaction).toHaveBeenCalled()
  })

  it('writes equipment history and activity log when updating equipment', async () => {
    db.equipment.findUnique.mockResolvedValue({
      id: 'equipment-1',
      code: 'TB0001',
      name: 'MacBook Pro',
      branchId: 'branch-1',
      categoryId: 'category-1',
      locationPresetId: 'location-1',
      status: 'IN_USE',
      imageUrl: null,
      serialNumber: 'OLD-SERIAL',
      purchaseDate: null,
      inServiceDate: null,
      warrantyUntil: null,
      purchaseValue: 42000000,
      holderName: 'Nguyễn Văn A',
      note: null,
      archivedAt: null,
    })
    db.equipmentLocationPreset.findUnique.mockResolvedValue({
      id: 'location-1',
      branchId: 'branch-1',
      isActive: true,
      name: 'Văn phòng',
    })

    const updateMock = jest.fn().mockResolvedValue({
      id: 'equipment-1',
      code: 'TB0001',
      name: 'MacBook Pro 14',
      branchId: 'branch-1',
      status: 'MAINTENANCE',
    })
    const historyCreateMock = jest.fn().mockResolvedValue({ id: 'history-2' })
    const activityCreateMock = jest.fn().mockResolvedValue({ id: 'activity-2' })

    db.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) =>
      callback({
        equipment: {
          update: updateMock,
        },
        equipmentHistory: {
          create: historyCreateMock,
        },
        activityLog: {
          create: activityCreateMock,
        },
      }),
    )

    const result = await service.updateEquipment(
      'equipment-1',
      {
        name: 'MacBook Pro 14',
        status: 'MAINTENANCE',
        holderName: 'Nguyễn Văn B',
      },
      makeActor(),
    )

    expect(result.success).toBe(true)
    expect(updateMock).toHaveBeenCalled()
    expect(historyCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATED',
        }),
      }),
    )
    expect(activityCreateMock).toHaveBeenCalled()
  })

  it('writes equipment history and activity log when archiving equipment', async () => {
    db.equipment.findUnique.mockResolvedValue({
      id: 'equipment-1',
      code: 'TB0001',
      name: 'MacBook Pro',
      branchId: 'branch-1',
      archivedAt: null,
    })

    const archiveDate = new Date('2026-04-21T10:00:00.000Z')
    const updateMock = jest.fn().mockResolvedValue({
      id: 'equipment-1',
      code: 'TB0001',
      name: 'MacBook Pro',
      branchId: 'branch-1',
      archivedAt: archiveDate,
    })
    const historyCreateMock = jest.fn().mockResolvedValue({ id: 'history-3' })
    const activityCreateMock = jest.fn().mockResolvedValue({ id: 'activity-3' })

    db.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) =>
      callback({
        equipment: {
          update: updateMock,
        },
        equipmentHistory: {
          create: historyCreateMock,
        },
        activityLog: {
          create: activityCreateMock,
        },
      }),
    )

    const result = await service.archiveEquipment(
      'equipment-1',
      makeActor({ permissions: ['equipment.archive', 'equipment.read', 'equipment.update'] }),
    )

    expect(result.success).toBe(true)
    expect(updateMock).toHaveBeenCalled()
    expect(historyCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ARCHIVED',
        }),
      }),
    )
    expect(activityCreateMock).toHaveBeenCalled()
  })
})
