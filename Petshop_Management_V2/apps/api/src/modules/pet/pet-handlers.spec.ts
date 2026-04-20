/**
 * Unit Tests: Pet CQRS Handlers (Phase 3)
 * Tests for CreatePetHandler, UpdatePetHandler, DeletePetHandler,
 * FindPetHandler, FindPetsHandler.
 *
 * Run: pnpm exec jest --testPathPattern="pet-handlers"
 */

import { BadRequestException, NotFoundException } from '@nestjs/common'

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const makePetRepo = () => ({
    findById: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    nextCode: jest.fn(),
})

const makeDb = () => ({
    customer: {
        findUnique: jest.fn(),
    },
    pet: {
        findUnique: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    branch: {
        findUnique: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'MAIN', name: 'Main Branch', isMain: true }),
        findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'MAIN', name: 'Main Branch', isMain: true }),
    },
})

const makePetEntity = (overrides: Record<string, unknown> = {}) => ({
    id: 'pet-1',
    petCode: 'PET000001',
    name: 'Mochi',
    species: 'Chó',
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
})

const makePetEntityObj = (snapshot = makePetEntity()) => ({
    id: snapshot.id,
    petCode: snapshot.petCode,
    branchId: snapshot.branchId,
    customerId: snapshot.customerId,
    toSnapshot: jest.fn().mockReturnValue(snapshot),
    updateInfo: jest.fn(),
    moveToCustomer: jest.fn(),
})

const makeActor = () => ({
    userId: 'user-1',
    role: 'STAFF',
    permissions: [],
    branchId: 'branch-1',
    authorizedBranchIds: ['branch-1'],
})

// ─── CreatePetHandler ──────────────────────────────────────────────────────────

describe('CreatePetHandler', () => {
    let handler: any
    let petRepo: ReturnType<typeof makePetRepo>
    let db: ReturnType<typeof makeDb>

    beforeEach(async () => {
        petRepo = makePetRepo()
        db = makeDb()

        // Dynamic import to avoid decorator issues in test env
        const { CreatePetHandler } = await import(
            './application/commands/create-pet/create-pet.handler.js'
        )
        handler = new CreatePetHandler(petRepo, db as any)
    })

    it('creates a pet with the generated code and returns snapshot', async () => {
        const snapshot = makePetEntity()
        const entityObj = makePetEntityObj(snapshot)

        petRepo.nextCode.mockResolvedValue('PET000001')
        petRepo.save.mockResolvedValue(entityObj)
        db.customer.findUnique.mockResolvedValue({ id: 'customer-1', branchId: 'branch-1' })

        const { CreatePetCommand } = await import(
            './application/commands/create-pet/create-pet.command.js'
        )
        const command = new CreatePetCommand(
            { name: 'Mochi', species: 'Chó', customerId: 'customer-1' },
            makeActor(),
        )

        const result = await handler.execute(command)

        expect(petRepo.nextCode).toHaveBeenCalledTimes(1)
        expect(petRepo.save).toHaveBeenCalledTimes(1)
        expect(result.success).toBe(true)
        expect(result.data.petCode).toBe('PET000001')
    })

    it('throws BadRequestException when customer does not exist', async () => {
        db.customer.findUnique.mockResolvedValue(null)
        petRepo.nextCode.mockResolvedValue('PET000001')

        const { CreatePetCommand } = await import(
            './application/commands/create-pet/create-pet.command.js'
        )
        const command = new CreatePetCommand(
            { name: 'Mochi', species: 'Chó', customerId: 'nonexistent' },
            makeActor(),
        )

        await expect(handler.execute(command)).rejects.toThrow(BadRequestException)
    })
})

// ─── UpdatePetHandler ──────────────────────────────────────────────────────────

describe('UpdatePetHandler', () => {
    let handler: any
    let petRepo: ReturnType<typeof makePetRepo>
    let db: ReturnType<typeof makeDb>

    beforeEach(async () => {
        petRepo = makePetRepo()
        db = makeDb()

        const { UpdatePetHandler } = await import(
            './application/commands/update-pet/update-pet.handler.js'
        )
        handler = new UpdatePetHandler(petRepo, db as any)
    })

    it('updates pet info and returns snapshot', async () => {
        const entity = makePetEntityObj()
        petRepo.findById.mockResolvedValue(entity)
        petRepo.update.mockResolvedValue(entity)

        const { UpdatePetCommand } = await import(
            './application/commands/update-pet/update-pet.command.js'
        )
        const command = new UpdatePetCommand(
            'pet-1',
            { name: 'Mochi Updated', breed: 'Samoyed' },
            makeActor(),
        )

        const result = await handler.execute(command)

        expect(entity.updateInfo).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Mochi Updated', breed: 'Samoyed' }),
        )
        expect(petRepo.update).toHaveBeenCalledWith(entity)
        expect(result.success).toBe(true)
    })

    it('handles customer transfer when customerId is provided', async () => {
        const entity = makePetEntityObj()
        petRepo.findById.mockResolvedValue(entity)
        petRepo.update.mockResolvedValue(entity)
        db.customer.findUnique.mockResolvedValue({ id: 'customer-2', branchId: 'branch-2' })

        const { UpdatePetCommand } = await import(
            './application/commands/update-pet/update-pet.command.js'
        )
        const command = new UpdatePetCommand('pet-1', { customerId: 'customer-2' }, makeActor())

        await handler.execute(command)

        expect(entity.moveToCustomer).toHaveBeenCalledWith('customer-2', 'branch-2')
    })

    it('throws BadRequestException when new customer does not exist', async () => {
        const entity = makePetEntityObj()
        petRepo.findById.mockResolvedValue(entity)
        db.customer.findUnique.mockResolvedValue(null)

        const { UpdatePetCommand } = await import(
            './application/commands/update-pet/update-pet.command.js'
        )
        const command = new UpdatePetCommand('pet-1', { customerId: 'ghost' }, makeActor())

        await expect(handler.execute(command)).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when pet not found', async () => {
        petRepo.findById.mockResolvedValue(null)

        const { UpdatePetCommand } = await import(
            './application/commands/update-pet/update-pet.command.js'
        )
        const command = new UpdatePetCommand('ghost-id', { name: 'X' }, makeActor())

        await expect(handler.execute(command)).rejects.toThrow(NotFoundException)
    })
})

// ─── DeletePetHandler ──────────────────────────────────────────────────────────

describe('DeletePetHandler', () => {
    let handler: any
    let petRepo: ReturnType<typeof makePetRepo>

    beforeEach(async () => {
        petRepo = makePetRepo()

        const { DeletePetHandler } = await import(
            './application/commands/delete-pet/delete-pet.handler.js'
        )
        handler = new DeletePetHandler(petRepo)
    })

    it('deletes pet and returns success', async () => {
        const entity = makePetEntityObj()
        petRepo.findById.mockResolvedValue(entity)
        petRepo.delete.mockResolvedValue(undefined)

        const { DeletePetCommand } = await import(
            './application/commands/delete-pet/delete-pet.command.js'
        )
        const command = new DeletePetCommand('pet-1', makeActor())

        const result = await handler.execute(command)

        expect(petRepo.delete).toHaveBeenCalledWith('pet-1')
        expect(result.success).toBe(true)
    })

    it('throws NotFoundException when pet does not exist', async () => {
        petRepo.findById.mockResolvedValue(null)

        const { DeletePetCommand } = await import(
            './application/commands/delete-pet/delete-pet.command.js'
        )
        const command = new DeletePetCommand('ghost', makeActor())

        await expect(handler.execute(command)).rejects.toThrow(NotFoundException)
    })
})

// ─── FindPetHandler ────────────────────────────────────────────────────────────

describe('FindPetHandler', () => {
    let handler: any
    let petRepo: ReturnType<typeof makePetRepo>
    let db: ReturnType<typeof makeDb>

    beforeEach(async () => {
        petRepo = makePetRepo()
        db = makeDb()

        const { FindPetHandler } = await import(
            './application/queries/find-pet/find-pet.handler.js'
        )
        handler = new FindPetHandler(petRepo, db as any)
    })

    it('returns full pet detail when found', async () => {
        const snapshot = makePetEntity()
        const entityObj = makePetEntityObj(snapshot)
        petRepo.findById.mockResolvedValue(entityObj)
        db.pet.findUnique.mockResolvedValue({
            ...snapshot,
            customer: { id: 'customer-1', fullName: 'Nguyen Van A', phone: '0900000000' },
            weightLogs: [],
            vaccinations: [],
            timeline: [],
            groomingSessions: [],
            hotelStays: [],
        })

        const { FindPetQuery } = await import('./application/queries/find-pet/find-pet.query.js')
        const result = await handler.execute(new FindPetQuery('pet-1'))

        expect(result.success).toBe(true)
        expect(result.data.id).toBe('pet-1')
        expect(result.data.weightLogs).toBeDefined()
        expect(db.pet.findUnique).toHaveBeenCalledTimes(1)
    })

    it('throws NotFoundException when pet does not exist', async () => {
        petRepo.findById.mockResolvedValue(null)

        const { FindPetQuery } = await import('./application/queries/find-pet/find-pet.query.js')
        await expect(handler.execute(new FindPetQuery('ghost'))).rejects.toThrow(NotFoundException)
    })
})

// ─── FindPetsHandler ───────────────────────────────────────────────────────────

describe('FindPetsHandler', () => {
    let handler: any
    let petRepo: ReturnType<typeof makePetRepo>

    beforeEach(async () => {
        petRepo = makePetRepo()

        const { FindPetsHandler } = await import(
            './application/queries/find-pets/find-pets.handler.js'
        )
        handler = new FindPetsHandler(petRepo)
    })

    it('returns paginated pets with meta', async () => {
        const snapshot = makePetEntity()
        petRepo.findAll.mockResolvedValue({
            data: [makePetEntityObj(snapshot)],
            total: 1,
        })

        const { FindPetsQuery } = await import(
            './application/queries/find-pets/find-pets.query.js'
        )
        const result = await handler.execute(new FindPetsQuery({ page: 1, limit: 10 }))

        expect(result.success).toBe(true)
        expect(result.data).toHaveLength(1)
        expect(result.meta.total).toBe(1)
        expect(result.meta.totalPages).toBe(1)
    })

    it('filters to authorized branchIds for non-admin actors', async () => {
        petRepo.findAll.mockResolvedValue({ data: [], total: 0 })

        const { FindPetsQuery } = await import(
            './application/queries/find-pets/find-pets.query.js'
        )
        const actor = { role: 'STAFF', branchId: 'branch-1', authorizedBranchIds: ['branch-2'] }
        await handler.execute(new FindPetsQuery({ page: 1, limit: 10 }, actor))

        const callArg = petRepo.findAll.mock.calls[0][0]
        expect(callArg.branchIds).toEqual(expect.arrayContaining(['branch-1', 'branch-2']))
    })

    it('does NOT filter branchIds for SUPER_ADMIN', async () => {
        petRepo.findAll.mockResolvedValue({ data: [], total: 0 })

        const { FindPetsQuery } = await import(
            './application/queries/find-pets/find-pets.query.js'
        )
        const actor = { role: 'SUPER_ADMIN', branchId: 'branch-1', authorizedBranchIds: [] }
        await handler.execute(new FindPetsQuery({ page: 1, limit: 10 }, actor))

        const callArg = petRepo.findAll.mock.calls[0][0]
        expect(callArg.branchIds).toBeUndefined()
    })
})
