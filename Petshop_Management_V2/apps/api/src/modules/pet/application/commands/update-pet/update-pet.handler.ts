import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, BadRequestException, NotFoundException } from '@nestjs/common'
import { UpdatePetCommand } from './update-pet.command.js'
import { PET_REPOSITORY, type IPetRepository } from '../../../domain/ports/pet.repository.js'
import { DatabaseService } from '../../../../../database/database.service.js'

/**
 * Command Handler: UpdatePetCommand
 * Phase 2 — fully implemented, controller can dispatch directly.
 */
@CommandHandler(UpdatePetCommand)
export class UpdatePetHandler implements ICommandHandler<UpdatePetCommand> {
    constructor(
        @Inject(PET_REPOSITORY)
        private readonly petRepo: IPetRepository,
        private readonly db: DatabaseService,
    ) { }

    async execute({ id, dto }: UpdatePetCommand) {
        const pet = await this.petRepo.findById(id)
        if (!pet) throw new NotFoundException('Không tìm thấy thú cưng')

        // Handle customer transfer
        if (dto.customerId !== undefined && dto.customerId !== null) {
            const customer = await this.db.customer.findUnique({
                where: { id: dto.customerId },
                select: { id: true, branchId: true },
            })
            if (!customer) throw new BadRequestException('Khách hàng không tồn tại')
            pet.moveToCustomer(customer.id, customer.branchId ?? pet.branchId ?? '')
        }

        // Apply domain mutations
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
