import { PetService } from './pet.service'

function createDbMock() {
  return {
    pet: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    petWeightLog: {
      create: jest.fn(),
    },
    petTimeline: {
      create: jest.fn(),
    },
  } as any
}

describe('PetService', () => {
  describe('addWeightLog', () => {
    it('creates a weight log and updates the current pet weight', async () => {
      const db = createDbMock()
      db.pet.findFirst.mockResolvedValue({ id: 'pet-1' })
      db.petWeightLog.create.mockResolvedValue({ id: 'weight-1', petId: 'pet-1', weight: 4.5, notes: 'Can lai' })
      db.pet.update.mockResolvedValue({ id: 'pet-1', weight: 4.5 })

      const service = new PetService(db)
      const result = await service.addWeightLog('PET000005', { weight: 4.5, notes: 'Can lai' })

      expect(db.petWeightLog.create).toHaveBeenCalledWith({
        data: { petId: 'pet-1', weight: 4.5, notes: 'Can lai' },
      })
      expect(db.pet.update).toHaveBeenCalledWith({
        where: { id: 'pet-1' },
        data: { weight: 4.5 },
      })
      expect(result.data.id).toBe('weight-1')
    })

    it('throws NotFoundException if pet not found (no branch restriction)', async () => {
      const db = createDbMock()
      db.pet.findFirst.mockResolvedValue(null)

      const service = new PetService(db)
      await expect(
        service.addWeightLog('non-existent-id', { weight: 3 })
      ).rejects.toThrow('Không tìm thấy thú cưng')
    })
  })
})
