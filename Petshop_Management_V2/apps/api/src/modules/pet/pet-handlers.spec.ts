import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PetAccessPolicy } from './application/policies/pet-access.policy'

const makePetRepo = () => ({
  findById: jest.fn(),
  findAll: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  nextCode: jest.fn(),
})

const makeReferenceLookup = () => ({
  resolveBranchIdentity: jest.fn(),
  findAccessiblePetIdentity: jest.fn(),
  findAccessibleCustomerById: jest.fn(),
  petExists: jest.fn(),
  customerExists: jest.fn(),
})

const makeReadModel = () => ({
  getPetDetail: jest.fn(),
  getActivePetServices: jest.fn(),
})

const makeMedicalRecords = () => ({
  createWeightLog: jest.fn(),
  updatePetWeight: jest.fn(),
  createVaccination: jest.fn(),
  updateAvatar: jest.fn(),
  appendTimelineEntry: jest.fn(),
  syncAttribute: jest.fn(),
})

const makePetSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: 'pet-1',
  petCode: 'PET000001',
  name: 'Mochi',
  species: 'Cho',
  breed: 'Poodle',
  gender: 'MALE',
  branchId: 'branch-1',
  customerId: 'customer-1',
  dateOfBirth: null,
  weight: null,
  color: null,
  allergies: null,
  temperament: null,
  notes: null,
  avatar: null,
  microchipId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
})

const makePetEntity = (snapshot = makePetSnapshot()) => ({
  id: snapshot.id as string,
  petCode: snapshot.petCode as string,
  branchId: snapshot.branchId as string | null,
  customerId: snapshot.customerId as string,
  toSnapshot: jest.fn().mockReturnValue(snapshot),
  updateInfo: jest.fn(),
  moveToCustomer: jest.fn(),
})

const makeActor = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  role: 'STAFF',
  permissions: ['pet.read', 'pet.update'],
  branchId: 'branch-1',
  authorizedBranchIds: ['branch-1'],
  ...overrides,
})

describe('Pet CQRS Handlers', () => {
  describe('CreatePetHandler', () => {
    it('creates a pet with generated code and accessible customer branch', async () => {
      const petRepo = makePetRepo()
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)
      const snapshot = makePetSnapshot()
      const entity = makePetEntity(snapshot)

      petRepo.nextCode.mockResolvedValue('PET000001')
      petRepo.save.mockResolvedValue(entity)
      referenceLookup.resolveBranchIdentity.mockResolvedValue({ id: 'branch-1', code: 'MAIN', name: 'Main' })
      referenceLookup.findAccessibleCustomerById.mockResolvedValue({ id: 'customer-1', branchId: 'branch-1' })

      const { CreatePetHandler } = await import('./application/commands/create-pet/create-pet.handler')
      const { CreatePetCommand } = await import('./application/commands/create-pet/create-pet.command')
      const handler = new CreatePetHandler(petRepo, referenceLookup as any, accessPolicy)

      const result = await handler.execute(
        new CreatePetCommand({ name: 'Mochi', species: 'Cho', customerId: 'customer-1' }, makeActor(), 'branch-1'),
      )

      expect(referenceLookup.resolveBranchIdentity).toHaveBeenCalledWith('branch-1')
      expect(petRepo.nextCode).toHaveBeenCalledTimes(1)
      expect(petRepo.save).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.data.petCode).toBe('PET000001')
    })

    it('rejects requested branch outside authorized scope', async () => {
      const petRepo = makePetRepo()
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      const { CreatePetHandler } = await import('./application/commands/create-pet/create-pet.handler')
      const { CreatePetCommand } = await import('./application/commands/create-pet/create-pet.command')
      const handler = new CreatePetHandler(petRepo, referenceLookup as any, accessPolicy)

      await expect(
        handler.execute(
          new CreatePetCommand(
            { name: 'Mochi', species: 'Cho', customerId: 'customer-1' },
            makeActor(),
            'branch-2',
          ),
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('UpdatePetHandler', () => {
    it('updates pet info and transfers customer inside scope', async () => {
      const petRepo = makePetRepo()
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)
      const entity = makePetEntity()

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue({
        id: 'pet-1',
        petCode: 'PET000001',
        branchId: 'branch-1',
        customerId: 'customer-1',
      })
      referenceLookup.findAccessibleCustomerById.mockResolvedValue({ id: 'customer-2', branchId: 'branch-2' })
      petRepo.findById.mockResolvedValue(entity)
      petRepo.update.mockResolvedValue(entity)

      const { UpdatePetHandler } = await import('./application/commands/update-pet/update-pet.handler')
      const { UpdatePetCommand } = await import('./application/commands/update-pet/update-pet.command')
      const handler = new UpdatePetHandler(petRepo, accessPolicy)

      const result = await handler.execute(
        new UpdatePetCommand('pet-1', { name: 'Mochi Updated', customerId: 'customer-2' }, makeActor()),
      )

      expect(entity.moveToCustomer).toHaveBeenCalledWith('customer-2', 'branch-2')
      expect(entity.updateInfo).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mochi Updated' }))
      expect(petRepo.update).toHaveBeenCalledWith(entity)
      expect(result.success).toBe(true)
    })
  })

  describe('DeletePetHandler', () => {
    it('deletes an accessible pet by resolved identity', async () => {
      const petRepo = makePetRepo()
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue({
        id: 'pet-1',
        petCode: 'PET000001',
        branchId: 'branch-1',
        customerId: 'customer-1',
      })

      const { DeletePetHandler } = await import('./application/commands/delete-pet/delete-pet.handler')
      const { DeletePetCommand } = await import('./application/commands/delete-pet/delete-pet.command')
      const handler = new DeletePetHandler(petRepo, accessPolicy)

      const result = await handler.execute(new DeletePetCommand('pet-1', makeActor()))

      expect(petRepo.delete).toHaveBeenCalledWith('pet-1')
      expect(result.success).toBe(true)
    })
  })

  describe('AddWeightLogHandler', () => {
    it('creates a weight log, updates current weight, and appends timeline', async () => {
      const referenceLookup = makeReferenceLookup()
      const medicalRecords = makeMedicalRecords()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue({
        id: 'pet-1',
        petCode: 'PET000001',
        branchId: 'branch-1',
        customerId: 'customer-1',
      })
      medicalRecords.createWeightLog.mockResolvedValue({ id: 'weight-1', petId: 'pet-1', weight: 4.5 })

      const { AddWeightLogHandler } = await import('./application/commands/add-weight-log/add-weight-log.handler')
      const { AddWeightLogCommand } = await import('./application/commands/add-weight-log/add-weight-log.command')
      const handler = new AddWeightLogHandler(accessPolicy, medicalRecords as any)

      const result = await handler.execute(
        new AddWeightLogCommand('pet-1', { weight: 4.5, notes: 'Can lai' }, makeActor()),
      )

      expect(medicalRecords.createWeightLog).toHaveBeenCalledWith({
        petId: 'pet-1',
        weight: 4.5,
        notes: 'Can lai',
      })
      expect(medicalRecords.updatePetWeight).toHaveBeenCalledWith('pet-1', 4.5)
      expect(medicalRecords.appendTimelineEntry).toHaveBeenCalledWith({
        petId: 'pet-1',
        action: 'WEIGHT_UPDATED',
        metadata: { weight: 4.5, notes: 'Can lai' },
      })
      expect(result.data.id).toBe('weight-1')
    })
  })

  describe('AddVaccinationHandler', () => {
    it('creates a vaccination and appends timeline', async () => {
      const referenceLookup = makeReferenceLookup()
      const medicalRecords = makeMedicalRecords()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue({
        id: 'pet-1',
        petCode: 'PET000001',
        branchId: 'branch-1',
        customerId: 'customer-1',
      })
      medicalRecords.createVaccination.mockResolvedValue({ id: 'vac-1', petId: 'pet-1' })

      const { AddVaccinationHandler } = await import('./application/commands/add-vaccination/add-vaccination.handler')
      const { AddVaccinationCommand } = await import('./application/commands/add-vaccination/add-vaccination.command')
      const handler = new AddVaccinationHandler(accessPolicy, medicalRecords as any)

      const result = await handler.execute(
        new AddVaccinationCommand(
          'pet-1',
          { vaccineName: 'Rabies', date: '2025-01-01', notes: 'Dose 1' },
          makeActor(),
        ),
      )

      expect(medicalRecords.createVaccination).toHaveBeenCalledWith(
        expect.objectContaining({ petId: 'pet-1', vaccineName: 'Rabies' }),
      )
      expect(medicalRecords.appendTimelineEntry).toHaveBeenCalledWith({
        petId: 'pet-1',
        action: 'VACCINATION_ADDED',
        metadata: { vaccineName: 'Rabies', date: '2025-01-01', notes: 'Dose 1' },
      })
      expect(result.data.id).toBe('vac-1')
    })
  })

  describe('UpdatePetAvatarHandler', () => {
    it('updates avatar for an accessible pet', async () => {
      const referenceLookup = makeReferenceLookup()
      const medicalRecords = makeMedicalRecords()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue({
        id: 'pet-1',
        petCode: 'PET000001',
        branchId: 'branch-1',
        customerId: 'customer-1',
      })
      medicalRecords.updateAvatar.mockResolvedValue({ id: 'pet-1', avatar: '/uploads/pets/avatar.png' })

      const { UpdatePetAvatarHandler } = await import('./application/commands/update-pet-avatar/update-pet-avatar.handler')
      const { UpdatePetAvatarCommand } = await import('./application/commands/update-pet-avatar/update-pet-avatar.command')
      const handler = new UpdatePetAvatarHandler(accessPolicy, medicalRecords as any)

      const result = await handler.execute(
        new UpdatePetAvatarCommand('pet-1', '/uploads/pets/avatar.png', makeActor()),
      )

      expect(medicalRecords.updateAvatar).toHaveBeenCalledWith('pet-1', '/uploads/pets/avatar.png')
      expect(result.success).toBe(true)
    })
  })

  describe('SyncPetAttributeHandler', () => {
    it('rejects sync when actor lacks settings permission', async () => {
      const medicalRecords = makeMedicalRecords()
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      const { SyncPetAttributeHandler } = await import('./application/commands/sync-pet-attribute/sync-pet-attribute.handler')
      const { SyncPetAttributeCommand } = await import('./application/commands/sync-pet-attribute/sync-pet-attribute.command')
      const handler = new SyncPetAttributeHandler(accessPolicy, medicalRecords as any)

      await expect(
        handler.execute(
          new SyncPetAttributeCommand(
            { attribute: 'breed' as any, oldValue: 'Poodle', newValue: 'Toy Poodle' },
            makeActor({ permissions: ['pet.read'] }),
          ),
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('syncs attribute when actor has settings permission', async () => {
      const medicalRecords = makeMedicalRecords()
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)
      medicalRecords.syncAttribute.mockResolvedValue(4)

      const { SyncPetAttributeHandler } = await import('./application/commands/sync-pet-attribute/sync-pet-attribute.handler')
      const { SyncPetAttributeCommand } = await import('./application/commands/sync-pet-attribute/sync-pet-attribute.command')
      const handler = new SyncPetAttributeHandler(accessPolicy, medicalRecords as any)

      const result = await handler.execute(
        new SyncPetAttributeCommand(
          { attribute: 'breed' as any, oldValue: 'Poodle', newValue: 'Toy Poodle' },
          makeActor({ permissions: ['settings.app.update'] }),
        ),
      )

      expect(medicalRecords.syncAttribute).toHaveBeenCalledWith('breed', 'Poodle', 'Toy Poodle')
      expect(result.count).toBe(4)
    })
  })

  describe('GetActivePetServicesHandler', () => {
    it('returns active grooming and hotel services for an accessible pet', async () => {
      const referenceLookup = makeReferenceLookup()
      const readModel = makeReadModel()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue({
        id: 'pet-1',
        petCode: 'PET000001',
        branchId: 'branch-1',
        customerId: 'customer-1',
      })
      readModel.getActivePetServices.mockResolvedValue({ groomingSessions: [{ id: 'g-1' }], hotelStays: [] })

      const { GetActivePetServicesHandler } = await import('./application/queries/get-active-pet-services/get-active-pet-services.handler')
      const { GetActivePetServicesQuery } = await import('./application/queries/get-active-pet-services/get-active-pet-services.query')
      const handler = new GetActivePetServicesHandler(accessPolicy, readModel as any)

      const result = await handler.execute(new GetActivePetServicesQuery('pet-1', makeActor()))

      expect(readModel.getActivePetServices).toHaveBeenCalledWith('pet-1')
      expect(result.groomingSessions).toHaveLength(1)
    })
  })

  describe('FindPetHandler', () => {
    it('returns pet detail when the actor is in scope', async () => {
      const referenceLookup = makeReferenceLookup()
      const readModel = makeReadModel()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue({
        id: 'pet-1',
        petCode: 'PET000001',
        branchId: 'branch-1',
        customerId: 'customer-1',
      })
      readModel.getPetDetail.mockResolvedValue({ id: 'pet-1', weightLogs: [], vaccinations: [] })

      const { FindPetHandler } = await import('./application/queries/find-pet/find-pet.handler')
      const { FindPetQuery } = await import('./application/queries/find-pet/find-pet.query')
      const handler = new FindPetHandler(accessPolicy, readModel as any)

      const result = await handler.execute(new FindPetQuery('pet-1', makeActor()))

      expect(readModel.getPetDetail).toHaveBeenCalledWith('pet-1')
      expect(result.success).toBe(true)
    })

    it('throws ForbiddenException when pet exists but is outside branch scope', async () => {
      const referenceLookup = makeReferenceLookup()
      const readModel = makeReadModel()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue(null)
      referenceLookup.petExists.mockResolvedValue(true)

      const { FindPetHandler } = await import('./application/queries/find-pet/find-pet.handler')
      const { FindPetQuery } = await import('./application/queries/find-pet/find-pet.query')
      const handler = new FindPetHandler(accessPolicy, readModel as any)

      await expect(handler.execute(new FindPetQuery('pet-1', makeActor()))).rejects.toThrow(ForbiddenException)
    })

    it('throws NotFoundException when pet does not exist', async () => {
      const referenceLookup = makeReferenceLookup()
      const readModel = makeReadModel()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessiblePetIdentity.mockResolvedValue(null)
      referenceLookup.petExists.mockResolvedValue(false)

      const { FindPetHandler } = await import('./application/queries/find-pet/find-pet.handler')
      const { FindPetQuery } = await import('./application/queries/find-pet/find-pet.query')
      const handler = new FindPetHandler(accessPolicy, readModel as any)

      await expect(handler.execute(new FindPetQuery('ghost', makeActor()))).rejects.toThrow(NotFoundException)
    })
  })

  describe('FindPetsHandler', () => {
    it('filters to authorized branch ids for non-admin actors', async () => {
      const petRepo = makePetRepo()
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)
      petRepo.findAll.mockResolvedValue({ data: [], total: 0 })

      const { FindPetsHandler } = await import('./application/queries/find-pets/find-pets.handler')
      const { FindPetsQuery } = await import('./application/queries/find-pets/find-pets.query')
      const handler = new FindPetsHandler(petRepo, accessPolicy)

      await handler.execute(new FindPetsQuery({ page: 1, limit: 10 }, makeActor({ authorizedBranchIds: ['branch-2'] })))

      expect(petRepo.findAll.mock.calls[0][0].branchIds).toEqual(expect.arrayContaining(['branch-1', 'branch-2']))
    })

    it('does not filter branch ids for super admin', async () => {
      const petRepo = makePetRepo()
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)
      petRepo.findAll.mockResolvedValue({ data: [], total: 0 })

      const { FindPetsHandler } = await import('./application/queries/find-pets/find-pets.handler')
      const { FindPetsQuery } = await import('./application/queries/find-pets/find-pets.query')
      const handler = new FindPetsHandler(petRepo, accessPolicy)

      await handler.execute(new FindPetsQuery({ page: 1, limit: 10 }, makeActor({ role: 'SUPER_ADMIN', authorizedBranchIds: [] })))

      expect(petRepo.findAll.mock.calls[0][0].branchIds).toBeUndefined()
    })
  })

  describe('PetAccessPolicy', () => {
    it('throws BadRequestException when customer does not exist', async () => {
      const referenceLookup = makeReferenceLookup()
      const accessPolicy = new PetAccessPolicy(referenceLookup as any)

      referenceLookup.findAccessibleCustomerById.mockResolvedValue(null)
      referenceLookup.customerExists.mockResolvedValue(false)

      await expect(accessPolicy.getAccessibleCustomerOrThrow('missing', makeActor())).rejects.toThrow(BadRequestException)
    })
  })
})
