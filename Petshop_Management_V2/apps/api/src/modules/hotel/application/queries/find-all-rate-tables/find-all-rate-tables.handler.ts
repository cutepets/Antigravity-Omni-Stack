import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { FindAllRateTablesQuery } from './find-all-rate-tables.query.js'

@QueryHandler(FindAllRateTablesQuery)
export class FindAllRateTablesHandler implements IQueryHandler<FindAllRateTablesQuery> {
    constructor(private readonly hotelService: HotelService) { }
    execute({ query }: FindAllRateTablesQuery) { return this.hotelService.findAllRateTables(query) }
}
