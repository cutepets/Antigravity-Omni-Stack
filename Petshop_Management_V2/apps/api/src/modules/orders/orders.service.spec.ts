import { OrdersService } from './orders.service'
import { BadRequestException } from '@nestjs/common'

describe('OrdersService', () => {
    let service: OrdersService
    let db: any

    beforeEach(() => {
        db = {
            $queryRawUnsafe: jest.fn(),
            order: {
                findFirst: jest.fn(),
                count: jest.fn(),
            },
        }
        service = new OrdersService(db)
    })

    describe('Static utility methods', () => {
        it('should calculate remaining amount correctly', () => {
            expect((service as any).calculateRemainingAmount(1000, 400)).toBe(600)
            expect((service as any).calculateRemainingAmount(1000, 1500)).toBe(0)
        })

        it('should calculate payment status correctly', () => {
            expect((service as any).calculatePaymentStatus(1000, 1000)).toBe('PAID')
            expect((service as any).calculatePaymentStatus(1000, 1500)).toBe('PAID')
            expect((service as any).calculatePaymentStatus(1000, 400)).toBe('PARTIAL')
            expect((service as any).calculatePaymentStatus(1000, 0)).toBe('UNPAID')
        })

        it('should get correct payment label', () => {
            expect((service as any).getPaymentLabel('CASH')).toBe('Tiền mặt')
            expect((service as any).getPaymentLabel('UNKNOWN')).toBe('UNKNOWN')
        })
    })

    describe('generateOrderNumber', () => {
        it('should generate an order number using YYMMDD prefix and latest sequence', async () => {
            const mockDate = new Date('2026-04-16T12:00:00Z')
            jest.useFakeTimers().setSystemTime(mockDate)

            db.order.count.mockResolvedValue(4)
            const orderNumber = await (service as any).generateOrderNumber()
            expect(orderNumber).toBe('DH260416005')

            db.order.count.mockResolvedValue(0)
            const orderNumber2 = await (service as any).generateOrderNumber()
            expect(orderNumber2).toBe('DH260416001')

            jest.useRealTimers()
        })
    })
})
