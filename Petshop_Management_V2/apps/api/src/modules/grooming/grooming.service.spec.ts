import { GroomingService } from './grooming.service'

describe('GroomingService', () => {
    let service: GroomingService
    let db: any

    beforeEach(() => {
        db = {
            groomingSession: {
                count: jest.fn(),
            },
        }
        service = new GroomingService(db)
    })

    describe('mergeBranchScope', () => {
        it('should properly merge branch scope', () => {
            const scope = (service as any).mergeBranchScope({ someCondition: true }, { isGlobalAdmin: true })
            expect(scope).toEqual({ "branchId": { "in": [] }, "someCondition": true })
        })
    })

    describe('generateSessionCode', () => {
        it('should generate code using YYMM branch prefix and sequence', async () => {
            const mockDate = new Date('2026-04-16T12:00:00Z')
            db.groomingSession.count.mockResolvedValue(4)

            const code = await (service as any).generateSessionCode(mockDate, 'TH')
            expect(code).toBe('S2604TH005')

            db.groomingSession.count.mockResolvedValue(0)
            const code2 = await (service as any).generateSessionCode(mockDate, 'TH')
            expect(code2).toBe('S2604TH001')
        })
    })
})
