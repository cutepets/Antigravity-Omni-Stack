import type { CreateGroomingDto } from '../../../dto/grooming.dto.js'
import type { JwtPayload } from '@petshop/shared'

export class CreateGroomingCommand {
    constructor(
        public readonly dto: CreateGroomingDto,
        public readonly actor: JwtPayload | undefined,
        public readonly requestedBranchId: string | undefined,
    ) { }
}
