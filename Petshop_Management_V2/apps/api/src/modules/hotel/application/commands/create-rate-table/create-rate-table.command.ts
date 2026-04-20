import type { CreateHotelRateTableDto } from '../../../dto/create-hotel.dto.js'

export class CreateRateTableCommand {
    constructor(public readonly dto: CreateHotelRateTableDto) { }
}
