import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { DatabaseService } from '../../../../../database/database.service.js'
import { getScopedBranchIds, type BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { FindGroomingsQuery } from './find-groomings.query.js'

@QueryHandler(FindGroomingsQuery)
export class FindGroomingsHandler implements IQueryHandler<FindGroomingsQuery> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ query, actor, requestedBranchId }: FindGroomingsQuery) {
        const user = actor as BranchScopedUser | undefined
        const scopedBranchIds = getScopedBranchIds(user, requestedBranchId)

        const where: Record<string, any> = scopedBranchIds ? { branchId: { in: scopedBranchIds } } : {}

        if (query?.status) where.status = query.status
        if (query?.staffId) where.staffId = query.staffId
        if (query?.startDate || query?.endDate) {
            where.createdAt = {}
            if (query.startDate) where.createdAt.gte = new Date(query.startDate)
            if (query.endDate) where.createdAt.lte = new Date(query.endDate)
        }

        const sessions = await this.db.groomingSession.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                pet: {
                    select: {
                        id: true, petCode: true, name: true, species: true, breed: true,
                        customer: { select: { id: true, fullName: true, phone: true } },
                    },
                },
                staff: { select: { id: true, fullName: true, avatar: true } },
                assignedStaff: { select: { id: true, fullName: true, avatar: true } },
                order: { select: { id: true, orderNumber: true } },
                branch: { select: { id: true, name: true, code: true } },
            },
        })

        return { success: true, data: sessions }
    }
}
