import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { DatabaseService } from '../../../../../database/database.service.js'
import { CreateCageCommand } from './create-cage.command.js'

@CommandHandler(CreateCageCommand)
export class CreateCageHandler implements ICommandHandler<CreateCageCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ dto }: CreateCageCommand) {
        return this.db.cage.create({ data: dto })
    }
}
