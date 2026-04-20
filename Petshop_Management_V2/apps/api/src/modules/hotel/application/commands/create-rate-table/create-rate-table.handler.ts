import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../../../../database/database.service.js'
import { CreateRateTableCommand } from './create-rate-table.command.js'

@CommandHandler(CreateRateTableCommand)
export class CreateRateTableHandler implements ICommandHandler<CreateRateTableCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ dto }: CreateRateTableCommand) {
        return this.db.hotelRateTable.create({
            data: {
                name: dto.name,
                year: dto.year,
                ...(dto.species ? { species: dto.species } : {}),
                ...(dto.minWeight !== undefined ? { minWeight: dto.minWeight } : {}),
                ...(dto.maxWeight !== undefined ? { maxWeight: dto.maxWeight } : {}),
                ...(dto.lineType ? { lineType: dto.lineType } : {}),
                ratePerNight: dto.ratePerNight,
            },
        })
    }
}
