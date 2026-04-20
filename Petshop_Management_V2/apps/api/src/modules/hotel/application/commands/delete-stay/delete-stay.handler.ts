import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../../../../database/database.service.js'
import { assertBranchAccess, type BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { DeleteStayCommand } from './delete-stay.command.js'

@CommandHandler(DeleteStayCommand)
export class DeleteStayHandler implements ICommandHandler<DeleteStayCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ id, actor }: DeleteStayCommand) {
        const user = actor as BranchScopedUser | undefined

        const stay = await this.db.hotelStay.findFirst({
            where: { OR: [{ id }, { stayCode: { equals: id, mode: 'insensitive' } }] },
            select: { id: true, branchId: true },
        })
        if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú')

        assertBranchAccess(stay.branchId, user)
        await this.db.hotelStay.delete({ where: { id: stay.id } })

        return { success: true }
    }
}
