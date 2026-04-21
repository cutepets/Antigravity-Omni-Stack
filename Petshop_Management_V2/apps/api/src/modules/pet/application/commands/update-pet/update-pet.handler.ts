import { Inject, NotFoundException } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { UpdatePetCommand } from './update-pet.command.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'

@CommandHandler(UpdatePetCommand)
export class UpdatePetHandler implements ICommandHandler<UpdatePetCommand> {
  constructor(
    @Inject(PET_REPOSITORY)
    private readonly petRepo: IPetRepository,
    private readonly accessPolicy: PetAccessPolicy,
  ) {}

  async execute({ id, dto, actor }: UpdatePetCommand) {
    const petIdentity = await this.accessPolicy.getAccessiblePetOrThrow(id, actor)
    const pet = await this.petRepo.findById(petIdentity.id)
    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng')

    if (dto.customerId !== undefined && dto.customerId !== null) {
      const customer = await this.accessPolicy.getAccessibleCustomerOrThrow(dto.customerId, actor)
      pet.moveToCustomer(customer.id, customer.branchId ?? pet.branchId ?? '')
    }

    pet.updateInfo({
      name: dto.name,
      breed: dto.breed,
      gender: dto.gender,
      dateOfBirth: dto.dateOfBirth !== undefined
        ? (dto.dateOfBirth ? new Date(dto.dateOfBirth) : null)
        : undefined,
      weight: dto.weight,
      color: dto.color,
      allergies: dto.allergies,
      temperament: dto.temperament,
      notes: dto.notes,
      microchipId: dto.microchipId,
    })

    const updated = await this.petRepo.update(pet)
    return { success: true, data: updated.toSnapshot() }
  }
}
