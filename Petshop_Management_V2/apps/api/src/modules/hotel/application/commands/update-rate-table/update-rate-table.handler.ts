import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../../../../database/database.service.js'
import { UpdateRateTableCommand } from './update-rate-table.command.js'

@CommandHandler(UpdateRateTableCommand)
export class UpdateRateTableHandler implements ICommandHandler<UpdateRateTableCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ id, dto }: UpdateRateTableCommand) {
        const existing = await this.db.hotelRateTable.findUnique({ where: { id } })
        if (!existing) throw new NotFoundException('Không tìm thấy bảng giá hotel')

        return this.db.hotelRateTable.update({ where: { id }, data: dto })
    }
}
