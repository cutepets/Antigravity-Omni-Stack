import type { JwtPayload } from '@petshop/shared'

export class FindStayHealthLogsQuery {
  constructor(
    public readonly stayId: string,
    public readonly actor: JwtPayload | undefined,
  ) {}
}
