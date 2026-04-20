export class FindPetsQuery {
    constructor(
        public readonly filter: {
            q?: string
            species?: string
            gender?: string
            customerId?: string
            page?: number
            limit?: number
        },
        public readonly actor?: {
            role?: string
            permissions?: string[]
            branchId?: string | null
            authorizedBranchIds?: string[]
        },
    ) { }
}
