import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { DatabaseService } from '../../../../../database/database.service.js'
import { HotelService } from '../../../hotel.service.js'
import { CreateStayCommand } from './create-stay.command.js'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'

/**
 * CreateStayHandler — delegates to HotelService.createStay()
 * HotelService encapsulates the complex pricing engine (~800 LOC).
 * Controller remains a thin dispatcher; this is the CQRS application boundary.
 */
@CommandHandler(CreateStayCommand)
export class CreateStayHandler implements ICommandHandler<CreateStayCommand> {
    constructor(
        private readonly db: DatabaseService,
        private readonly hotelService: HotelService,
    ) { }

    execute({ dto, actor, requestedBranchId }: CreateStayCommand) {
        return this.hotelService.createStay(dto, actor as BranchScopedUser | undefined, requestedBranchId)
    }
}
