import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../../../../database/database.service.js'
import { assertBranchAccess, type BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { FindGroomingQuery } from './find-grooming.query.js'

const fullSessionInclude = {
    pet: {
        select: {
            id: true, petCode: true, name: true, species: true, breed: true,
            customer: { select: { id: true, fullName: true, phone: true } },
        },
    },
    staff: { select: { id: true, fullName: true, avatar: true } },
    assignedStaff: { select: { id: true, fullName: true, avatar: true } },
    order: {
        select: {
            id: true, orderNumber: true, status: true, paymentStatus: true,
            total: true, paidAmount: true, remainingAmount: true,
        },
    },
    branch: { select: { id: true, name: true, code: true } },
    timeline: {
        include: { performedByUser: { select: { id: true, fullName: true, staffCode: true } } },
        orderBy: { createdAt: 'desc' as const },
    },
} as const

@QueryHandler(FindGroomingQuery)
export class FindGroomingHandler implements IQueryHandler<FindGroomingQuery> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ id, actor }: FindGroomingQuery) {
        const user = actor as BranchScopedUser | undefined

        const session = await this.db.groomingSession.findFirst({
            where: {
                OR: [
                    { id },
                    { sessionCode: { equals: id, mode: 'insensitive' } },
                ],
            },
            include: fullSessionInclude,
        })

        if (!session) throw new NotFoundException('Không tìm thấy phiên grooming')
        assertBranchAccess(session.branchId, user)

        return { success: true, data: session }
    }
}
