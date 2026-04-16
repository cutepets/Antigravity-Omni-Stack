import { HotelService } from './hotel.service'

describe('HotelService', () => {
    let service: HotelService
    let db: any

    beforeEach(() => {
        db = {
            hotelStay: {
                findFirst: jest.fn(),
                count: jest.fn(),
            },
        }
        service = new HotelService(db)
    })

    describe('Static utility methods', () => {
        it('should calculate deriveHalfDayPrice correctly', () => {
            expect((service as any).deriveHalfDayPrice(1000)).toBe(500)
        })

        it('should calculate roundCurrency correctly', () => {
            expect((service as any).roundCurrency(100.123)).toBe(100.12)
            expect((service as any).roundCurrency(100.125)).toBe(100.13)
        })
    })

    describe('generateStayCode', () => {
        it('should generate code using YYMM branch prefix and sequence', async () => {
            const mockDate = new Date('2026-04-16T12:00:00Z')
            db.hotelStay.count.mockResolvedValue(4)

            const code = await (service as any).generateStayCode(mockDate, 'TH')
            expect(code).toBe('H2604TH005')

            db.hotelStay.count.mockResolvedValue(0)
            const code2 = await (service as any).generateStayCode(mockDate, 'TH')
            expect(code2).toBe('H2604TH001')
        })
    })
})
