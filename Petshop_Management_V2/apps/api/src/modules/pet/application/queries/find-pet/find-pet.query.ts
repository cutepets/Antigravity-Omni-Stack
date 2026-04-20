import type { JwtPayload } from '@petshop/shared'

export class FindPetQuery {
    constructor(
        public readonly id: string,
        public readonly actor?: Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>,
    ) { }
}
