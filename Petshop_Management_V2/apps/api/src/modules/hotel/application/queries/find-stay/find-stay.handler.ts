import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { FindStayQuery } from './find-stay.query.js'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'

@QueryHandler(FindStayQuery)
export class FindStayHandler implements IQueryHandler<FindStayQuery> {
    constructor(private readonly hotelService: HotelService) { }
    execute({ id, actor }: FindStayQuery) {
        return this.hotelService.findStayById(id, actor as BranchScopedUser | undefined)
    }
}
