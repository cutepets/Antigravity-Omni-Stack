import type { CalculateHotelPriceDto } from '../../../dto/update-hotel.dto.js'

export class CalculateHotelPriceQuery {
    constructor(public readonly dto: CalculateHotelPriceDto) { }
}
