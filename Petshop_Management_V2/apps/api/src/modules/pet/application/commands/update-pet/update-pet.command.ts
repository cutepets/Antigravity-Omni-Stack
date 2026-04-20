import type { JwtPayload } from '@petshop/shared'

export class UpdatePetCommand {
    constructor(
        public readonly id: string,
        public readonly dto: {
            name?: string
            species?: string
            breed?: string | null
            gender?: string | null
            dateOfBirth?: string | null
            weight?: number | null
            color?: string | null
            allergies?: string | null
            temperament?: string | null
            notes?: string | null
            microchipId?: string | null
            customerId?: string | null
        },
        public readonly actor: Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>,
        public readonly requestedBranchId?: string | null,
    ) { }
}
