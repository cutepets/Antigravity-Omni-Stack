import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { CreatePetCommand } from './create-pet.command.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'
import { PetEntity } from '../../../domain/entities/pet.entity.js'
import {
  PET_REFERENCE_LOOKUP,
  type IPetReferenceLookup,
} from '../../ports/pet-reference-lookup.port.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'

@CommandHandler(CreatePetCommand)
export class CreatePetHandler implements ICommandHandler<CreatePetCommand> {
  constructor(
    @Inject(PET_REPOSITORY)
    private readonly petRepo: IPetRepository,
    @Inject(PET_REFERENCE_LOOKUP)
    private readonly referenceLookup: IPetReferenceLookup,
    private readonly accessPolicy: PetAccessPolicy,
  ) {}

  async execute({ dto, actor, requestedBranchId }: CreatePetCommand) {
    this.accessPolicy.assertRequestedBranchAccess(requestedBranchId, actor)

    const branch = await this.referenceLookup.resolveBranchIdentity(requestedBranchId ?? actor.branchId ?? null)
    const customer = await this.accessPolicy.getAccessibleCustomerOrThrow(dto.customerId, actor)
    const petCode = await this.petRepo.nextCode()

    const entity = PetEntity.create({
      petCode,
      name: dto.name,
      species: dto.species,
      breed: dto.breed ?? null,
      gender: dto.gender ?? null,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      weight: dto.weight ?? null,
      branchId: customer.branchId ?? branch.id,
      customerId: customer.id,
    })

    const saved = await this.petRepo.save(entity)
    return { success: true, data: saved.toSnapshot() }
  }
}
