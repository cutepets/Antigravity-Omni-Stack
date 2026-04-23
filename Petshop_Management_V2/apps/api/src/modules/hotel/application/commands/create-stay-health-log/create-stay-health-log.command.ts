import type { JwtPayload } from '@petshop/shared'
import type { CreateHotelStayHealthLogDto } from '../../../dto/create-hotel.dto.js'

export class CreateStayHealthLogCommand {
  constructor(
    public readonly stayId: string,
    public readonly dto: CreateHotelStayHealthLogDto,
    public readonly actor: JwtPayload | undefined,
  ) {}
}
