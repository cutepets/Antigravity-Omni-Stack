import type { JwtPayload } from '@petshop/shared'

export class DeleteGroomingCommand {
    constructor(
        public readonly id: string,
        public readonly actor: JwtPayload | undefined,
    ) { }
}
