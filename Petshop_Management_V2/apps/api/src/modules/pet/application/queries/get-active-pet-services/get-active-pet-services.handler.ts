import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { GetActivePetServicesQuery } from './get-active-pet-services.query.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'
import {
  PET_READ_MODEL,
  type IPetReadModel,
} from '../../ports/pet-read-model.port.js'

@QueryHandler(GetActivePetServicesQuery)
export class GetActivePetServicesHandler implements IQueryHandler<GetActivePetServicesQuery> {
  constructor(
    private readonly accessPolicy: PetAccessPolicy,
    @Inject(PET_READ_MODEL)
    private readonly petReadModel: IPetReadModel,
  ) {}

  async execute({ petId, actor }: GetActivePetServicesQuery) {
    const pet = await this.accessPolicy.getAccessiblePetOrThrow(petId, actor)
    return this.petReadModel.getActivePetServices(pet.id)
  }
}
