import { PetService } from './pet.service'

function createDbMock() {
  return {
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ maxNumber: 4 }]),
    branch: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'MAIN', name: 'Main' }),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'customer-1',
        fullName: 'Nguyen Van A',
        phone: '0900000000',
        branchId: 'branch-1',
      }),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pet: {
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'pet-1',
        ...data,
      })),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    petWeightLog: {
      create: jest.fn(),
    },
  } as any
}

describe('PetService', () => {
  it('creates the next sequential pet code from the last valid numeric suffix', async () => {
    const db = createDbMock()
    const service = new PetService(db)

    const result = await service.create({
      name: 'Mochi',
      species: 'Cho',
      customerId: 'customer-1',
    })

    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM "pets"'),
    )
    expect(db.pet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          petCode: 'PET000005',
          branchId: 'branch-1',
        }),
      }),
    )
    expect(result.data.petCode).toBe('PET000005')
  })

  it('finds pet detail by pet code inside the authorized branch scope', async () => {
    const db = createDbMock()
    db.pet.findFirst.mockResolvedValue({
      id: 'pet-1',
      petCode: 'PET000005',
      name: 'Mochi',
      weightLogs: [],
      vaccinations: [],
      groomingSessions: [],
      hotelStays: [],
    })

    const service = new PetService(db)

    const result = await service.findOne('PET000005', {
      userId: 'user-1',
      role: 'STAFF',
      permissions: [],
      branchId: 'branch-1',
      authorizedBranchIds: ['branch-1'],
    })

    expect(result.data.petCode).toBe('PET000005')
    expect(JSON.stringify(db.pet.findFirst.mock.calls[0][0].where)).toContain('PET000005')
    expect(JSON.stringify(db.pet.findFirst.mock.calls[0][0].where)).toContain('branch-1')
  })

  it('adds a weight log and updates the current pet weight', async () => {
    const db = createDbMock()
    db.pet.findFirst.mockResolvedValue({ id: 'pet-1' })
    db.petWeightLog.create.mockResolvedValue({
      id: 'weight-1',
      petId: 'pet-1',
      weight: 4.5,
      notes: 'Can lai',
    })
    db.pet.update.mockResolvedValue({ id: 'pet-1', weight: 4.5 })

    const service = new PetService(db)
    const result = await service.addWeightLog('PET000005', { weight: 4.5, notes: 'Can lai' })

    expect(db.petWeightLog.create).toHaveBeenCalledWith({
      data: {
        petId: 'pet-1',
        weight: 4.5,
        notes: 'Can lai',
      },
    })
    expect(db.pet.update).toHaveBeenCalledWith({
      where: { id: 'pet-1' },
      data: { weight: 4.5 },
    })
    expect(result.data.id).toBe('weight-1')
  })
})
