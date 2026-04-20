import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { FindRateTableQuery } from './find-rate-table.query.js'

@QueryHandler(FindRateTableQuery)
export class FindRateTableHandler implements IQueryHandler<FindRateTableQuery> {
    constructor(private readonly hotelService: HotelService) { }
    execute({ id }: FindRateTableQuery) { return this.hotelService.findRateTableById(id) }
}
