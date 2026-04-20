import { Injectable } from '@nestjs/common'
import type { PetGender } from '@petshop/database'
import { DatabaseService } from '../../../../database/database.service.js'
import type { IPetRepository, PetFilter, PetFindResult } from '../../domain/ports/pet.repository.js'
import { PetEntity } from '../../domain/entities/pet.entity.js'
import { PetMapper } from '../mappers/pet.mapper.js'
import { getNextSequentialCode } from '../../../../common/utils/sequential-code.util.js'

/**
 * Infrastructure Adapter: Prisma implementation of IPetRepository.
 * This is the ONLY class that knows about Prisma for the Pet domain.
 * Swap this out for MongoDB, raw SQL, or in-memory without touching domain/app layers.
 */
@Injectable()
export class PrismaPetRepository implements IPetRepository {
    constructor(private readonly db: DatabaseService) { }

    async findById(idOrCode: string): Promise<PetEntity | null> {
        const row = await this.db.pet.findFirst({
            where: { OR: [{ id: idOrCode }, { petCode: idOrCode }] },
        })
        return row ? PetMapper.toDomain(row) : null
    }

    async findAll(filter: PetFilter): Promise<PetFindResult> {
        const { q, species, gender, customerId, branchIds, page = 1, limit = 10 } = filter
        const skip = (Number(page) - 1) * Number(limit)

        const where = {
            ...(species && { species }),
            ...(gender && { gender: gender as PetGender }),
            ...(customerId && { customerId }),
            ...(branchIds?.length && { branchId: { in: branchIds } }),
            ...(q && {
                OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { petCode: { contains: q, mode: 'insensitive' as const } },
                    { microchipId: { contains: q, mode: 'insensitive' as const } },
                ],
            }),
        }

        const [total, rows] = await Promise.all([
            this.db.pet.count({ where }),
            this.db.pet.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
            }),
        ])

        return { data: rows.map(PetMapper.toDomain), total }
    }

    async save(pet: PetEntity): Promise<PetEntity> {
        const payload = PetMapper.toCreatePayload(pet)
        const row = await this.db.pet.create({
            data: {
                id: payload.id,
                petCode: payload.petCode,
                name: payload.name,
                species: payload.species,
                breed: payload.breed,
                gender: (payload.gender as PetGender) ?? undefined,
                dateOfBirth: payload.dateOfBirth,
                weight: payload.weight,
                color: payload.color,
                allergies: payload.allergies,
                temperament: payload.temperament,
                notes: payload.notes,
                avatar: payload.avatar,
                microchipId: payload.microchipId,
                branchId: payload.branchId,
                customerId: payload.customerId,
            },
        })
        return PetMapper.toDomain(row)
    }

    async update(pet: PetEntity): Promise<PetEntity> {
        const payload = PetMapper.toUpdatePayload(pet)
        const row = await this.db.pet.update({
            where: { id: pet.id },
            data: {
                name: payload.name,
                species: payload.species,
                breed: payload.breed,
                gender: (payload.gender as PetGender) ?? undefined,
                dateOfBirth: payload.dateOfBirth,
                weight: payload.weight,
                color: payload.color,
                allergies: payload.allergies,
                temperament: payload.temperament,
                notes: payload.notes,
                avatar: payload.avatar,
                microchipId: payload.microchipId,
                branchId: payload.branchId,
                customerId: payload.customerId,
            },
        })
        return PetMapper.toDomain(row)
    }

    async delete(id: string): Promise<void> {
        await this.db.pet.delete({ where: { id } })
    }

    async nextCode(): Promise<string> {
        return getNextSequentialCode(this.db, {
            table: 'pets',
            column: 'petCode',
            prefix: 'PET',
        })
    }
}
