import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../../../../database/database.service.js'
import { resolveBranchIdentity } from '../../../../../common/utils/branch-identity.util.js'
import { assertBranchAccess, resolveWritableBranchId, type BranchScopedUser } from '../../../../../common/utils/branch-scope.util.js'
import { autoExportPaidServiceOnlyOrder } from '../../../../orders/application/order-service-auto-export.application.js'
import { UpdateGroomingCommand } from './update-grooming.command.js'

@CommandHandler(UpdateGroomingCommand)
export class UpdateGroomingHandler implements ICommandHandler<UpdateGroomingCommand> {
    constructor(private readonly db: DatabaseService) { }

    async execute({ id, dto, actor, requestedBranchId }: UpdateGroomingCommand) {
        const user = actor as BranchScopedUser | undefined

        const session = await this.db.groomingSession.findFirst({
            where: { OR: [{ id }, { sessionCode: { equals: id, mode: 'insensitive' } }] },
        })
        if (!session) throw new NotFoundException('Không tìm thấy phiên grooming')

        const resolvedId = session.id
        assertBranchAccess(session.branchId, user)

        const dataToUpdate: any = { ...dto }
        delete dataToUpdate.branchId
        delete dataToUpdate.staffIds
        delete dataToUpdate.staffId

        if (dto.staffIds !== undefined) {
            dataToUpdate.assignedStaff = { set: dto.staffIds.map((sid: string) => ({ id: sid })) }
            dataToUpdate.staffId = dto.staffIds[0] ?? null
        } else if (dto.staffId !== undefined) {
            dataToUpdate.staffId = dto.staffId
        }

        if (dto.startTime) dataToUpdate.startTime = new Date(dto.startTime)
        if (dto.endTime) dataToUpdate.endTime = new Date(dto.endTime)

        if (dto.branchId !== undefined || requestedBranchId) {
            const writableBranchId = resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
            const branch = await resolveBranchIdentity(this.db, writableBranchId)
            dataToUpdate.branchId = branch.id
        }

        if (dto.status === 'COMPLETED' && !dto.endTime && !session.endTime) dataToUpdate.endTime = new Date()
        if (dto.status === 'IN_PROGRESS' && !dto.startTime && !session.startTime) dataToUpdate.startTime = new Date()

        if (actor?.userId) {
            dataToUpdate.timeline = {
                create: {
                    action: dto.status && dto.status !== session.status ? 'Cập nhật trạng thái' : 'Cập nhật thông tin',
                    fromStatus: session.status,
                    toStatus: dto.status ?? session.status,
                    note: dto.notes?.trim() || null,
                    performedBy: actor.userId,
                }
            }
        }

        const updated = await this.db.groomingSession.update({
            where: { id: resolvedId },
            data: dataToUpdate,
            include: {
                pet: {
                    select: {
                        id: true, petCode: true, name: true, species: true, breed: true,
                        customer: { select: { id: true, fullName: true, phone: true } },
                    },
                },
                staff: { select: { id: true, fullName: true, avatar: true } },
                assignedStaff: { select: { id: true, fullName: true, avatar: true } },
                order: { select: { id: true, orderNumber: true } },
                branch: { select: { id: true, name: true, code: true } },
            },
        })

        if (dto.status === 'RETURNED' && updated.order?.id) {
            await autoExportPaidServiceOnlyOrder(this.db as any, {
                orderId: updated.order.id,
                staffId: actor?.userId ?? null,
                source: 'GROOMING_RETURNED_AUTO_EXPORT',
            })
        }

        return { success: true, data: updated }
    }
}
