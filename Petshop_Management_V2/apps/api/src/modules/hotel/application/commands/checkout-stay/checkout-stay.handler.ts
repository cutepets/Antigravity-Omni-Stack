import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { CheckoutStayCommand } from './checkout-stay.command.js'
import type { BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'

@CommandHandler(CheckoutStayCommand)
export class CheckoutStayHandler implements ICommandHandler<CheckoutStayCommand> {
    constructor(private readonly hotelService: HotelService) { }

    execute({ id, dto, actor }: CheckoutStayCommand) {
        return this.hotelService.checkoutStay(id, dto, actor as BranchScopedUser | undefined)
    }
}
