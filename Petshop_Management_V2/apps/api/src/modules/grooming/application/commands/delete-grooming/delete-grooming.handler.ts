import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../../../../database/database.service.js'
import { assertBranchAccess, type BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { DeleteGroomingCommand } from './delete-grooming.command.js'

@CommandHandler(DeleteGroomingCommand)
export class DeleteGroomingHandler implements ICommandHandler<DeleteGroomingCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ id, actor }: DeleteGroomingCommand) {
        const user = actor as BranchScopedUser | undefined

        const session = await this.db.groomingSession.findFirst({
            where: { OR: [{ id }, { sessionCode: { equals: id, mode: 'insensitive' } }] },
        })
        if (!session) throw new NotFoundException('Không tìm thấy phiên grooming')

        assertBranchAccess(session.branchId, user)
        await this.db.groomingSession.delete({ where: { id: session.id } })

        return { success: true }
    }
}
