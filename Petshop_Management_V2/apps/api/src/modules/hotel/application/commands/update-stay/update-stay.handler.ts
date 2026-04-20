import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { UpdateStayCommand } from './update-stay.command.js'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'

@CommandHandler(UpdateStayCommand)
export class UpdateStayHandler implements ICommandHandler<UpdateStayCommand> {
    constructor(private readonly hotelService: HotelService) { }

    execute({ id, dto, actor, requestedBranchId }: UpdateStayCommand) {
        return this.hotelService.updateStay(id, dto, actor as BranchScopedUser | undefined, requestedBranchId)
    }
}
