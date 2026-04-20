import type { JwtPayload } from '@petshop/shared'

export class FindGroomingQuery {
    constructor(
        /** id or sessionCode */
        public readonly id: string,
        public readonly actor: JwtPayload | undefined,
    ) { }
}
