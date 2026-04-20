import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { FindPetsQuery } from './find-pets.query.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'
import type { PetEntity } from '../../../domain/entities/pet.entity.js'

/**
 * Query Handler: FindPetsQuery
 * Phase 2 — applies branch-scope filtering based on actor role.
 * SUPER_ADMIN / ADMIN see all branches; others see only authorized branches.
 */
@QueryHandler(FindPetsQuery)
export class FindPetsHandler implements IQueryHandler<FindPetsQuery> {
    constructor(
        @Inject(PET_REPOSITORY)
        private readonly petRepo: IPetRepository,
    ) { }

    async execute({ filter, actor }: FindPetsQuery) {
        // Resolve branch scope from actor
        let branchIds: string[] | undefined
        if (actor && actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
            const authorized = [...(actor.authorizedBranchIds ?? [])]
            if (actor.branchId) authorized.push(actor.branchId)
            branchIds = [...new Set(authorized)].filter(Boolean) as string[]
        }

        const result = await this.petRepo.findAll({
            q: filter.q,
            species: filter.species,
            gender: filter.gender,
            customerId: filter.customerId,
            branchIds,
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
