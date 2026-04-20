import type { JwtPayload } from '@petshop/shared'

export class FindAllStaysQuery {
    constructor(
        public readonly query: Record<string, any>,
        public readonly actor: JwtPayload | undefined,
        public readonly requestedBranchId: string | undefined,
    ) { }
}
