import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { DatabaseService } from '../../../../../database/database.service.js'
import { UpdateCageCommand } from './update-cage.command.js'

@CommandHandler(UpdateCageCommand)
export class UpdateCageHandler implements ICommandHandler<UpdateCageCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ id, dto }: UpdateCageCommand) {
        return this.db.cage.update({ where: { id }, data: dto })
    }
}
