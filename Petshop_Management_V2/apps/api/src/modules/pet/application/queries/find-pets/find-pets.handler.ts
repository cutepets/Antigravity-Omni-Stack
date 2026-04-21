import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { FindPetsQuery } from './find-pets.query.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'
import type { PetEntity } from '../../../domain/entities/pet.entity.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'

@QueryHandler(FindPetsQuery)
export class FindPetsHandler implements IQueryHandler<FindPetsQuery> {
  constructor(
    @Inject(PET_REPOSITORY)
    private readonly petRepo: IPetRepository,
    private readonly accessPolicy: PetAccessPolicy,
  ) {}

  async execute({ filter, actor }: FindPetsQuery) {
    const result = await this.petRepo.findAll({
      q: filter.q,
      species: filter.species,
      gender: filter.gender,
      customerId: filter.customerId,
      branchIds: this.accessPolicy.getListBranchIds(actor),
      page: filter.page ?? 1,
      limit: filter.limit ?? 10,
    })

    return {
      success: true,
      data: result.data.map((pet: PetEntity) => pet.toSnapshot()),
      meta: {
        total: result.total,
        page: Number(filter.page ?? 1),
        limit: Number(filter.limit ?? 10),
        totalPages: Math.ceil(result.total / Number(filter.limit ?? 10)),
      },
    }
  }
}
