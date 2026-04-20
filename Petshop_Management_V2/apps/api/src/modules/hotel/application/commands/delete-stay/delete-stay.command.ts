import type { JwtPayload } from '@petshop/shared'

export class DeleteStayCommand {
    constructor(
        public readonly id: string,
        public readonly actor: JwtPayload | undefined,
    ) { }
}
