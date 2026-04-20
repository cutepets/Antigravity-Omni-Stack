import type { CreateHotelStayDto } from '../../../dto/create-hotel.dto.js'
import type { JwtPayload } from '@petshop/shared'

export class CreateStayCommand {
    constructor(
        public readonly dto: CreateHotelStayDto,
        public readonly actor: JwtPayload | undefined,
        public readonly requestedBranchId: string | undefined,
    ) { }
}
