import type { JwtPayload } from '@petshop/shared'
import type { CreateHotelStayNoteDto } from '../../../dto/create-hotel.dto.js'

export class CreateStayNoteCommand {
  constructor(
    public readonly stayId: string,
    public readonly dto: CreateHotelStayNoteDto,
    public readonly actor: JwtPayload | undefined,
  ) {}
}
