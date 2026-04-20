import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { DatabaseService } from '../../../../../database/database.service.js'
import { DeleteCageCommand } from './delete-cage.command.js'

@CommandHandler(DeleteCageCommand)
export class DeleteCageHandler implements ICommandHandler<DeleteCageCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ id }: DeleteCageCommand) {
        return this.db.cage.update({ where: { id }, data: { isActive: false } })
    }
}
