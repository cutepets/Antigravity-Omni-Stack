import { Test, TestingModule } from '@nestjs/testing'
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import { CreateGroomingHandler } from './application/commands/create-grooming/create-grooming.handler.js'
import { UpdateGroomingHandler } from './application/commands/update-grooming/update-grooming.handler.js'
import { DeleteGroomingHandler } from './application/commands/delete-grooming/delete-grooming.handler.js'
import { FindGroomingsHandler } from './application/queries/find-groomings/find-groomings.handler.js'
import { FindGroomingHandler } from './application/queries/find-grooming/find-grooming.handler.js'
import { GetGroomingPackagesHandler } from './application/queries/get-grooming-packages/get-grooming-packages.handler.js'
import { CalculateGroomingPriceHandler } from './application/queries/calculate-grooming-price/calculate-grooming-price.handler.js'
import { CreateGroomingCommand } from './application/commands/create-grooming/create-grooming.command.js'
import { UpdateGroomingCommand } from './application/commands/update-grooming/update-grooming.command.js'
import { DeleteGroomingCommand } from './application/commands/delete-grooming/delete-grooming.command.js'
import { FindGroomingsQuery } from './application/queries/find-groomings/find-groomings.query.js'
import { FindGroomingQuery } from './application/queries/find-grooming/find-grooming.query.js'
import { GetGroomingPackagesQuery } from './application/queries/get-grooming-packages/get-grooming-packages.query.js'
import { CalculateGroomingPriceQuery } from './application/queries/calculate-grooming-price/calculate-grooming-price.query.js'

const mockSession = {
    id: 'session-1',
    sessionCode: 'GRM-001',
    petId: 'pet-1',
    petName: 'Mochi',
    customerId: 'cust-1',
    branchId: 'branch-1',
    staffId: 'staff-1',
    status: 'PENDING',
    startTime: null,
    endTime: null,
    notes: null,
}

const mockPet = {
    id: 'pet-1',
    name: 'Mochi',
    species: 'Chó',
    weight: 5,
    customerId: 'cust-1',
    branchId: 'branch-1',
    customer: { id: 'cust-1', fullName: 'Nguyen Van A', branchId: 'branch-1' },
}

const mockBranch = { id: 'branch-1', code: 'HN01', name: 'Ha Noi 01' }
const mockPriceRule = { id: 'rule-1', packageCode: 'SPA_BASIC', species: null, price: 150000, durationMinutes: 60, minWeight: null, maxWeight: null, weightBandId: null }

const mockDb = {
    groomingSession: {
        create: jest.fn().mockResolvedValue({ ...mockSession, pet: mockPet, staff: null, assignedStaff: [], order: null, branch: mockBranch }),
        findMany: jest.fn().mockResolvedValue([{ ...mockSession, pet: mockPet, staff: null, assignedStaff: [], order: null, branch: mockBranch }]),
        findFirst: jest.fn().mockResolvedValue(mockSession),
        update: jest.fn().mockResolvedValue({ ...mockSession, status: 'IN_PROGRESS', pet: mockPet, staff: null, assignedStaff: [], order: null, branch: mockBranch }),
        delete: jest.fn().mockResolvedValue(mockSession),
        count: jest.fn().mockResolvedValue(0),
    },
    pet: { findFirst: jest.fn().mockResolvedValue(mockPet) },
    branch: { findFirst: jest.fn().mockResolvedValue(mockBranch), findUnique: jest.fn().mockResolvedValue(mockBranch) },
    serviceWeightBand: { findMany: jest.fn().mockResolvedValue([]) },
    spaPriceRule: {
        findMany: jest.fn().mockResolvedValue([mockPriceRule]),
    },
}

describe('Grooming CQRS Handlers', () => {
    let commandBus: CommandBus
    let queryBus: QueryBus
    let module: TestingModule

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [CqrsModule],
            providers: [
                { provide: DatabaseService, useValue: mockDb },
                CreateGroomingHandler, UpdateGroomingHandler, DeleteGroomingHandler,
                FindGroomingsHandler, FindGroomingHandler, GetGroomingPackagesHandler, CalculateGroomingPriceHandler,
            ],
        }).compile()

        await module.init()
        commandBus = module.get(CommandBus)
        queryBus = module.get(QueryBus)
    })

    afterEach(async () => {
        await module.close()
        jest.clearAllMocks()
    })

    // ====== COMMANDS ======
    describe('CreateGroomingHandler', () => {
        it('creates grooming session and returns success', async () => {
            const result = await commandBus.execute(
                new CreateGroomingCommand({ petId: 'pet-1', packageCode: null } as any, { userId: 'staff-1' } as any, 'branch-1')
            )
            expect(result.success).toBe(true)
            expect(result.data.sessionCode).toBe('GRM-001')
            expect(mockDb.groomingSession.create).toHaveBeenCalledTimes(1)
        })

        it('throws BadRequestException if pet not found', async () => {
            mockDb.pet.findFirst.mockResolvedValueOnce(null)
            await expect(
                commandBus.execute(new CreateGroomingCommand({ petId: 'bad-pet' } as any, undefined, undefined))
            ).rejects.toThrow(BadRequestException)
        })
    })

    describe('UpdateGroomingHandler', () => {
        it('updates session and returns success', async () => {
            const result = await commandBus.execute(
                new UpdateGroomingCommand('session-1', { status: 'IN_PROGRESS' } as any, { userId: 'staff-1' } as any, undefined)
            )
            expect(result.success).toBe(true)
            expect(result.data.status).toBe('IN_PROGRESS')
        })

        it('throws NotFoundException if session not found', async () => {
            mockDb.groomingSession.findFirst.mockResolvedValueOnce(null)
            await expect(
                commandBus.execute(new UpdateGroomingCommand('bad-id', {} as any, undefined, undefined))
            ).rejects.toThrow(NotFoundException)
        })
    })

    describe('DeleteGroomingHandler', () => {
        it('deletes session and returns success', async () => {
            const result = await commandBus.execute(new DeleteGroomingCommand('session-1', { userId: 'staff-1' } as any))
            expect(result.success).toBe(true)
            expect(mockDb.groomingSession.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } })
        })

        it('throws NotFoundException if session not found', async () => {
            mockDb.groomingSession.findFirst.mockResolvedValueOnce(null)
            await expect(
                commandBus.execute(new DeleteGroomingCommand('bad-id', undefined))
            ).rejects.toThrow(NotFoundException)
        })
    })

    // ====== QUERIES ======
    describe('FindGroomingsHandler', () => {
        it('returns list of sessions with success', async () => {
            const result = await queryBus.execute(new FindGroomingsQuery({}, undefined, undefined))
            expect(result.success).toBe(true)
            expect(Array.isArray(result.data)).toBe(true)
            expect(result.data.length).toBe(1)
        })
    })

    describe('FindGroomingHandler', () => {
        it('returns single session by id', async () => {
            mockDb.groomingSession.findFirst.mockResolvedValueOnce({ ...mockSession, timeline: [] })
            const result = await queryBus.execute(new FindGroomingQuery('session-1', undefined))
            expect(result.success).toBe(true)
            expect(result.data.id).toBe('session-1')
        })

        it('throws NotFoundException if session not found', async () => {
            mockDb.groomingSession.findFirst.mockResolvedValueOnce(null)
            await expect(
                queryBus.execute(new FindGroomingQuery('bad-id', undefined))
            ).rejects.toThrow(NotFoundException)
        })
    })

    describe('GetGroomingPackagesHandler', () => {
        it('returns unique package list', async () => {
            mockDb.spaPriceRule.findMany.mockResolvedValueOnce([
                { packageCode: 'SPA_BASIC', species: null },
                { packageCode: 'SPA_BASIC', species: 'Chó' },
                { packageCode: 'SPA_PRO', species: null },
            ])
            const result = await queryBus.execute(new GetGroomingPackagesQuery(undefined))
            expect(result.success).toBe(true)
            expect(result.data.length).toBe(2)
            expect(result.data.map((p: any) => p.code)).toContain('SPA_BASIC')
            expect(result.data.map((p: any) => p.code)).toContain('SPA_PRO')
        })
    })

    describe('CalculateGroomingPriceHandler', () => {
        it('returns price preview', async () => {
            const result = await queryBus.execute(
                new CalculateGroomingPriceQuery({ petId: 'pet-1', packageCode: 'SPA_BASIC' }, undefined)
            )
            expect(result.success).toBe(true)
            expect(result.data.price).toBe(150000)
            expect(result.data.packageCode).toBe('SPA_BASIC')
        })

        it('throws BadRequestException if pet has no weight', async () => {
            mockDb.pet.findFirst.mockResolvedValueOnce({ ...mockPet, weight: null })
            await expect(
                queryBus.execute(new CalculateGroomingPriceQuery({ petId: 'pet-1', packageCode: 'SPA_BASIC' }, undefined))
            ).rejects.toThrow(BadRequestException)
        })
    })
})
