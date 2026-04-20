import type { JwtPayload } from '@petshop/shared'

export class CreatePetCommand {
    constructor(
        public readonly dto: {
            customerId: string
            name: string
            species: string
            breed?: string | null
            gender?: string | null
            dateOfBirth?: string | null
            weight?: number | null
        },
        public readonly actor: Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>,
        public readonly requestedBranchId?: string | null,
    ) { }
}
