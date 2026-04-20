import type { CreateCageDto } from '../../../dto/create-hotel.dto.js'

export class CreateCageCommand {
    constructor(public readonly dto: CreateCageDto) { }
}
