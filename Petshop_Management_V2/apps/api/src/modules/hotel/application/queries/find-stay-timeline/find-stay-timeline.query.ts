import type { JwtPayload } from '@petshop/shared'

export class FindStayTimelineQuery {
    constructor(
        public readonly id: string,
        public readonly actor: JwtPayload | undefined,
    ) { }
}
