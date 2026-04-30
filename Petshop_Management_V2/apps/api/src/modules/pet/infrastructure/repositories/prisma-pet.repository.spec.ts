import { PrismaPetRepository } from './prisma-pet.repository'

describe('PrismaPetRepository', () => {
  it('loads owner summary for pet list rows', async () => {
    const db = {
      pet: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pet-1',
            petCode: 'PET000001',
            name: 'Mochi',
            species: 'Chó',
            breed: 'Poodle',
            gender: 'MALE',
            dateOfBirth: null,
            weight: null,
            color: null,
            allergies: null,
            temperament: null,
            notes: null,
            avatar: null,
            microchipId: null,
            branchId: 'branch-1',
            customerId: 'customer-1',
            customer: { id: 'customer-1', fullName: 'Nguyen Van A', phone: '0900000001' },
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      },
    } as any
    const repository = new PrismaPetRepository(db)

    const result = await repository.findAll({ page: 1, limit: 20 })

    expect(db.pet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      }),
    )
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.toSnapshot()).toEqual(
      expect.objectContaining({
        customer: { id: 'customer-1', fullName: 'Nguyen Van A', phone: '0900000001' },
      }),
    )
  })

  it('searches pets by owner name and phone', async () => {
    const db = {
      pet: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any
    const repository = new PrismaPetRepository(db)

    await repository.findAll({ q: '0900000001', page: 1, limit: 20 })

    expect(db.pet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { customer: { fullName: { contains: '0900000001', mode: 'insensitive' } } },
            { customer: { phone: { contains: '0900000001', mode: 'insensitive' } } },
          ]),
        }),
      }),
    )
  })
})
