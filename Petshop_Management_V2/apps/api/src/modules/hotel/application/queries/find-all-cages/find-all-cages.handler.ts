import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { HotelService } from '../../../hotel.service.js'
import { FindAllCagesQuery } from './find-all-cages.query.js'

@QueryHandler(FindAllCagesQuery)
export class FindAllCagesHandler implements IQueryHandler<FindAllCagesQuery> {
    constructor(private readonly hotelService: HotelService) { }
    execute(_query: FindAllCagesQuery) { return this.hotelService.findAllCages() }
}
