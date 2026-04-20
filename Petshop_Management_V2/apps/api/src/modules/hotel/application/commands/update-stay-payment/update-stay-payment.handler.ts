import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { UpdateStayPaymentCommand } from './update-stay-payment.command.js'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'

@CommandHandler(UpdateStayPaymentCommand)
export class UpdateStayPaymentHandler implements ICommandHandler<UpdateStayPaymentCommand> {
    constructor(private readonly hotelService: HotelService) { }

    execute({ id, paymentStatus, actor }: UpdateStayPaymentCommand) {
        return this.hotelService.updateStayPayment(id, paymentStatus, actor as BranchScopedUser | undefined)
    }
}
