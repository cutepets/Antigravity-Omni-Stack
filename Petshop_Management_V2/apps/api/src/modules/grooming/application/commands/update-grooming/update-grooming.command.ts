import type { UpdateGroomingDto } from '../../../dto/grooming.dto.js'
import type { JwtPayload } from '@petshop/shared'

export class UpdateGroomingCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateGroomingDto,
        public readonly actor: JwtPayload | undefined,
        public readonly requestedBranchId: string | undefined,
    ) { }
}
