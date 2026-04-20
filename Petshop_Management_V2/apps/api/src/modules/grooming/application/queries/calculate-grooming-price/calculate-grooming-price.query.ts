import type { CalculateSpaPriceDto } from '../../../dto/grooming.dto.js'
import type { JwtPayload } from '@petshop/shared'

export class CalculateGroomingPriceQuery {
    constructor(
        public readonly dto: CalculateSpaPriceDto,
        public readonly actor: JwtPayload | undefined,
    ) { }
}
