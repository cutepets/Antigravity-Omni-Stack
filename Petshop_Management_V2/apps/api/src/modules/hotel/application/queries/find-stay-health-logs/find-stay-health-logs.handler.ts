import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { HotelService } from '../../../hotel.service.js'
import { FindStayHealthLogsQuery } from './find-stay-health-logs.query.js'

@QueryHandler(FindStayHealthLogsQuery)
export class FindStayHealthLogsHandler implements IQueryHandler<FindStayHealthLogsQuery> {
  constructor(private readonly hotelService: HotelService) {}

  execute({ stayId, actor }: FindStayHealthLogsQuery) {
    return this.hotelService.findStayHealthLogs(stayId, actor as BranchScopedUser | undefined)
  }
}
