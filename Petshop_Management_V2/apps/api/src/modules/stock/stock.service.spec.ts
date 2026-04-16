import { StockService } from './stock.service'

describe('StockService', () => {
    let service: StockService
    let db: any

    beforeEach(() => {
        db = {
            stockReceipt: {
                findFirst: jest.fn(),
            },
        }
        service = new StockService(db)
    })

    describe('createNumber', () => {
        it('should generate a formatted number with prefix', () => {
            const mockDate = new Date('2026-04-16T12:30:15Z')
            jest.useFakeTimers().setSystemTime(mockDate)

            const generated = (service as any).createNumber('TEST')

            // Should start with TEST prefix
            expect(generated.startsWith('TEST')).toBe(true)
            // Should include date part 20260416
            expect(generated).toContain('20260416')

            jest.useRealTimers()
        })
    })

    describe('createReceiptNumber', () => {
        it('should generate next sequence for receipt', async () => {
            const mockDate = new Date('2026-04-16T12:00:00Z')
            jest.useFakeTimers().setSystemTime(mockDate)

            db.stockReceipt.findFirst.mockResolvedValue({ receiptNumber: 'PN2604008' })
            const code = await (service as any).createReceiptNumber()
            expect(code).toBe('PN2604009')

            db.stockReceipt.findFirst.mockResolvedValue(null)
            const code2 = await (service as any).createReceiptNumber()
            expect(code2).toBe('PN2604001')

            jest.useRealTimers()
        })
    })
})
