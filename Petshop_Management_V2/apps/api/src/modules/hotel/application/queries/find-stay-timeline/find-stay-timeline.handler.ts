import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { FindStayTimelineQuery } from './find-stay-timeline.query.js'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'

@QueryHandler(FindStayTimelineQuery)
export class FindStayTimelineHandler implements IQueryHandler<FindStayTimelineQuery> {
    constructor(private readonly hotelService: HotelService) { }
    execute({ id, actor }: FindStayTimelineQuery) {
        return this.hotelService.findStayTimeline(id, actor as BranchScopedUser | undefined)
    }
}
