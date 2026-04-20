import type { UpdateHotelStayDto } from '../../../dto/update-hotel.dto.js'
import type { JwtPayload } from '@petshop/shared'

export class UpdateStayCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateHotelStayDto,
        public readonly actor: JwtPayload | undefined,
        public readonly requestedBranchId: string | undefined,
    ) { }
}
