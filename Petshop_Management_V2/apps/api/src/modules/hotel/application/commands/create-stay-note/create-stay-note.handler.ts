import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { HotelService } from '../../../hotel.service.js'
import { CreateStayNoteCommand } from './create-stay-note.command.js'

@CommandHandler(CreateStayNoteCommand)
export class CreateStayNoteHandler implements ICommandHandler<CreateStayNoteCommand> {
  constructor(private readonly hotelService: HotelService) {}

  execute({ stayId, dto, actor }: CreateStayNoteCommand) {
    return this.hotelService.createStayNote(stayId, dto, actor as BranchScopedUser | undefined)
  }
}
