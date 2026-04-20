import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { DatabaseService } from '../../../../../database/database.service.js'
import { ReorderCagesCommand } from './reorder-cages.command.js'

@CommandHandler(ReorderCagesCommand)
export class ReorderCagesHandler implements ICommandHandler<ReorderCagesCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ cageIds }: ReorderCagesCommand) {
        if (!Array.isArray(cageIds) || cageIds.length === 0) return { success: true }

        const updates = cageIds.map((id, index) =>
            this.db.cage.update({ where: { id }, data: { position: index } })
        )
        await this.db.$transaction(updates)
        return { success: true }
    }
}
