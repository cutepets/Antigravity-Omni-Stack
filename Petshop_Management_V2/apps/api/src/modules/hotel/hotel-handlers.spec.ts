import { Test, TestingModule } from '@nestjs/testing'
import { CommandBus, CqrsModule } from '@nestjs/cqrs'
import { DatabaseService } from '../../database/database.service.js'
import { HotelService } from './hotel.service.js'
import { CreateStayHandler } from './application/commands/create-stay/create-stay.handler.js'
import { CheckoutStayHandler } from './application/commands/checkout-stay/checkout-stay.handler.js'
import { CreateStayCommand } from './application/commands/create-stay/create-stay.command.js'
import { CheckoutStayCommand } from './application/commands/checkout-stay/checkout-stay.command.js'

const mockHotelService = {
    createStay: jest.fn().mockResolvedValue({ success: true, data: { id: 'stay-1' } }),
    checkoutStay: jest.fn().mockResolvedValue({ success: true, data: { status: 'COMPLETED' } }),
}

describe('Hotel CQRS Handlers & Concurrency Tests', () => {
    let commandBus: CommandBus
    let module: TestingModule

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [CqrsModule],
            providers: [
                { provide: DatabaseService, useValue: {} },
                { provide: HotelService, useValue: mockHotelService },
                CreateStayHandler,
                CheckoutStayHandler,
            ],
        }).compile()

        await module.init()
        commandBus = module.get(CommandBus)
    })

    afterEach(async () => {
        await module.close()
        // Must clear mock history manually since instances persist across test execution within the file
        jest.clearAllMocks()
    })

    describe('CreateStayHandler', () => {
        it('delegates to HotelService and returns stay success', async () => {
            const command = new CreateStayCommand({ petId: 'pet-1', cageId: 'cage-1', startTime: new Date() } as any, { userId: 'staff-1' } as any, 'branch-1')
            const result = await commandBus.execute(command)
            expect(result.success).toBe(true)
            expect(mockHotelService.createStay).toHaveBeenCalledTimes(1)
        })
    })

    describe('Concurrency & Load Tests', () => {
        it('should process 100 concurrent CreateStayCommands smoothly without bottlenecks', async () => {
            const commands = Array.from({ length: 100 }, (_, i) =>
                new CreateStayCommand({ petId: `pet-${i}`, cageId: `cage-${i}`, startTime: new Date() } as any, { userId: 'tester' } as any, 'branch-1')
            )

            const start = Date.now()
            // Send requests at the same time to mimic rapid event firing and ensure no message bus deadlock
            const results = await Promise.all(commands.map(cmd => commandBus.execute(cmd)))
            const duration = Date.now() - start

            expect(results).toHaveLength(100)
            expect(results.every(r => r.success === true)).toBe(true)
            expect(mockHotelService.createStay).toHaveBeenCalledTimes(100)
            expect(duration).toBeLessThan(1000)
        })

        it('should process 100 concurrent CheckoutStayCommands smoothly', async () => {
            const commands = Array.from({ length: 100 }, (_, i) =>
                new CheckoutStayCommand(`stay-${i}`, { status: 'COMPLETED' } as any, { userId: 'tester' } as any)
            )

            const start = Date.now()
            const results = await Promise.all(commands.map(cmd => commandBus.execute(cmd)))
            const duration = Date.now() - start

            expect(results).toHaveLength(100)
            expect(results.every(r => r.success === true)).toBe(true)
            expect(mockHotelService.checkoutStay).toHaveBeenCalledTimes(100)
            expect(duration).toBeLessThan(1000)
        })
    })
})
