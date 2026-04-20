import type { CheckoutHotelStayDto } from '../../../dto/update-hotel.dto.js'
import type { JwtPayload } from '@petshop/shared'

export class CheckoutStayCommand {
    constructor(
        public readonly id: string,
        public readonly dto: CheckoutHotelStayDto,
        public readonly actor: JwtPayload | undefined,
    ) { }
}
