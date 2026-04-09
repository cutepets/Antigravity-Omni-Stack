import { PetService } from './pet.service'

describe('PetService', () => {
  it('creates the next sequential pet code from the last valid numeric suffix', async () => {
    const db = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ maxNumber: 4 }]),
      customer: {
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      pet: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'pet-1',
          ...data,
        })),
      },
    } as any

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
        }),
      }),
    )
    expect(result.data.petCode).toBe('PET000005')
  })
})
