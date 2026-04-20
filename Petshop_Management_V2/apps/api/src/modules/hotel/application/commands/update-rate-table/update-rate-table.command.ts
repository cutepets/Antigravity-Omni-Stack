import type { UpdateHotelRateTableDto } from '../../../dto/update-hotel.dto.js'

export class UpdateRateTableCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateHotelRateTableDto,
    ) { }
}
