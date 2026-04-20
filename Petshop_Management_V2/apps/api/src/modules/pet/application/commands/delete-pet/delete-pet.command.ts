import type { JwtPayload } from '@petshop/shared'

export class DeletePetCommand {
    constructor(
        public readonly id: string,
        public readonly actor: Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>,
    ) { }
}
