import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../../../../database/database.service.js'
import { DeleteRateTableCommand } from './delete-rate-table.command.js'

@CommandHandler(DeleteRateTableCommand)
export class DeleteRateTableHandler implements ICommandHandler<DeleteRateTableCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ id }: DeleteRateTableCommand) {
        const existing = await this.db.hotelRateTable.findUnique({ where: { id } })
        if (!existing) throw new NotFoundException('Không tìm thấy bảng giá hotel')

        const linkedCount = await this.db.hotelStay.count({ where: { rateTableId: id } })
        if (linkedCount > 0) {
            return this.db.hotelRateTable.update({ where: { id }, data: { isActive: false } })
        }
        return this.db.hotelRateTable.delete({ where: { id } })
    }
}
