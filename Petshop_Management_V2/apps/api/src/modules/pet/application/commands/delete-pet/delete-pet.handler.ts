import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { DeletePetCommand } from './delete-pet.command.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'

@CommandHandler(DeletePetCommand)
export class DeletePetHandler implements ICommandHandler<DeletePetCommand> {
  constructor(
    @Inject(PET_REPOSITORY)
    private readonly petRepo: IPetRepository,
    private readonly accessPolicy: PetAccessPolicy,
  ) {}

  async execute({ id, actor }: DeletePetCommand) {
    const pet = await this.accessPolicy.getAccessiblePetOrThrow(id, actor)
    await this.petRepo.delete(pet.id)
    return { success: true }
  }
}
