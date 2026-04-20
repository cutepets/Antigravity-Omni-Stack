import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, BadRequestException } from '@nestjs/common'
import { CreatePetCommand } from './create-pet.command.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'
import { PetEntity } from '../../../domain/entities/pet.entity.js'
import { DatabaseService } from '../../../../../database/database.service.js'
import { resolveBranchIdentity } from '../../../../../common/utils/branch-identity.util.js'

/**
 * Command Handler: CreatePetCommand
 * Application layer — orchestrates domain objects and infrastructure.
 * No Prisma imports here; depends only on IPetRepository interface.
 */
@CommandHandler(CreatePetCommand)
export class CreatePetHandler implements ICommandHandler<CreatePetCommand> {
    constructor(
        @Inject(PET_REPOSITORY)
        private readonly petRepo: IPetRepository,
        // DatabaseService used only for branch resolution and customer lookup utilities
        // These will be extracted to their own ports in a future iteration
        private readonly db: DatabaseService,
    ) { }

    async execute({ dto, actor, requestedBranchId }: CreatePetCommand) {
        // Resolve branch
        const branch = await resolveBranchIdentity(this.db, requestedBranchId ?? actor.branchId ?? null)

        // Validate customer exists
        const customer = await this.db.customer.findUnique({
            where: { id: dto.customerId },
            select: { id: true, branchId: true },
        })
        if (!customer) throw new BadRequestException('Khách hàng không tồn tại')

        // Generate next pet code via repository
        const petCode = await this.petRepo.nextCode()

        // Create domain entity (validates invariants)
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

        // Persist via repository (returns enriched entity)
        const saved = await this.petRepo.save(entity)

        return { success: true, data: saved.toSnapshot() }
    }
}
