import type { JwtPayload } from '@petshop/shared'

export class FindStayQuery {
    constructor(
        public readonly id: string,
        public readonly actor: JwtPayload | undefined,
    ) { }
}
