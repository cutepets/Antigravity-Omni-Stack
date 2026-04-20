import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { FindAllStaysQuery } from './find-all-stays.query.js'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'

@QueryHandler(FindAllStaysQuery)
export class FindAllStaysHandler implements IQueryHandler<FindAllStaysQuery> {
    constructor(private readonly hotelService: HotelService) { }
    execute({ query, actor, requestedBranchId }: FindAllStaysQuery) {
        return this.hotelService.findAllStays(query, actor as BranchScopedUser | undefined, requestedBranchId)
    }
}
