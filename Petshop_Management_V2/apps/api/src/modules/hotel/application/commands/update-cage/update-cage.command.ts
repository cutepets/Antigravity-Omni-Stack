import type { UpdateCageDto } from '../../../dto/update-hotel.dto.js'

export class UpdateCageCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateCageDto,
    ) { }
}
