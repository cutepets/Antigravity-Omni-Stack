import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { HotelService } from '../../../hotel.service.js'
import { CreateStayHealthLogCommand } from './create-stay-health-log.command.js'

@CommandHandler(CreateStayHealthLogCommand)
export class CreateStayHealthLogHandler implements ICommandHandler<CreateStayHealthLogCommand> {
  constructor(private readonly hotelService: HotelService) {}

  execute({ stayId, dto, actor }: CreateStayHealthLogCommand) {
    return this.hotelService.createStayHealthLog(stayId, dto, actor as BranchScopedUser | undefined)
  }
}
