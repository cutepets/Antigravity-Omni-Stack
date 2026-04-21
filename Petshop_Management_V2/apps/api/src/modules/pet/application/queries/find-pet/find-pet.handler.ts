import { Inject, NotFoundException } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { FindPetQuery } from './find-pet.query.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'
import {
  PET_READ_MODEL,
  type IPetReadModel,
} from '../../ports/pet-read-model.port.js'

@QueryHandler(FindPetQuery)
export class FindPetHandler implements IQueryHandler<FindPetQuery> {
  constructor(
    private readonly accessPolicy: PetAccessPolicy,
    @Inject(PET_READ_MODEL)
    private readonly petReadModel: IPetReadModel,
  ) {}

  async execute({ id, actor }: FindPetQuery) {
    const petIdentity = await this.accessPolicy.getAccessiblePetOrThrow(id, actor)
    const pet = await this.petReadModel.getPetDetail(petIdentity.id)
    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng')
    return { success: true, data: pet }
  }
}
