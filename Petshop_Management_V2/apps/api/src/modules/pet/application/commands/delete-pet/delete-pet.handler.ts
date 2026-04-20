import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, NotFoundException } from '@nestjs/common'
import { DeletePetCommand } from './delete-pet.command.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'

/**
 * Command Handler: DeletePetCommand (Phase 1 stub — used in Phase 2 migration)
 */
@CommandHandler(DeletePetCommand)
export class DeletePetHandler implements ICommandHandler<DeletePetCommand> {
    constructor(
        @Inject(PET_REPOSITORY)
        private readonly petRepo: IPetRepository,
    ) { }

    async execute({ id }: DeletePetCommand) {
        const pet = await this.petRepo.findById(id)
        if (!pet) throw new NotFoundException('Không tìm thấy thú cưng')
        await this.petRepo.delete(pet.id)
        return { success: true }
    }
}
