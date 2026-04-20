import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { CalculateHotelPriceQuery } from './calculate-hotel-price.query.js'

@QueryHandler(CalculateHotelPriceQuery)
export class CalculateHotelPriceHandler implements IQueryHandler<CalculateHotelPriceQuery> {
    constructor(private readonly hotelService: HotelService) { }
    execute({ dto }: CalculateHotelPriceQuery) { return this.hotelService.calculatePrice(dto) }
}
