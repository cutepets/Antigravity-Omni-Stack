import type { Pet as PrismaPet, PetGender } from '@petshop/database'
import { PetEntity, type PetProps } from '../../domain/entities/pet.entity.js'

type PetRow = PrismaPet & {
    customer?: {
        id: string
        fullName: string
        phone?: string | null
    } | null
}

/**
 * Infrastructure Mapper: converts between Prisma DB row and PetEntity.
 * This is the ONLY place Prisma types touch our domain objects.
 */
export class PetMapper {
    static toDomain(row: PetRow): PetEntity {
        return PetEntity.reconstitute({
            id: row.id,
            petCode: row.petCode,
            name: row.name,
            species: row.species,
            breed: row.breed ?? null,
            gender: row.gender ?? null,
            dateOfBirth: row.dateOfBirth ?? null,
            weight: row.weight !== null && row.weight !== undefined ? Number(row.weight) : null,
            color: row.color ?? null,
            allergies: row.allergies ?? null,
            temperament: row.temperament ?? null,
            notes: row.notes ?? null,
            avatar: row.avatar ?? null,
            microchipId: row.microchipId ?? null,
            branchId: row.branchId ?? '',
            customerId: row.customerId,
            customer: row.customer ?? null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })
    }

    /**
     * Map entity snapshot to a plain object suitable for Prisma create/update.
     * Strips relation fields; caller decides which fields to pass.
     */
    static toCreatePayload(entity: PetEntity): Omit<PetProps, 'id' | 'createdAt' | 'updatedAt'> & { id: string } {
        const snap = entity.toSnapshot()
        return {
            id: snap.id,
            petCode: snap.petCode,
            name: snap.name,
            species: snap.species,
            breed: snap.breed ?? null,
            gender: (snap.gender as PetGender) ?? null,
            dateOfBirth: snap.dateOfBirth ?? null,
            weight: snap.weight ?? null,
            color: snap.color ?? null,
            allergies: snap.allergies ?? null,
            temperament: snap.temperament ?? null,
            notes: snap.notes ?? null,
            avatar: snap.avatar ?? null,
            microchipId: snap.microchipId ?? null,
            branchId: snap.branchId || null,
            customerId: snap.customerId,
        }
    }

    static toUpdatePayload(entity: PetEntity): Partial<Omit<PetProps, 'id' | 'petCode' | 'createdAt'>> {
        const snap = entity.toSnapshot()
        return {
            name: snap.name,
            species: snap.species,
            breed: snap.breed ?? null,
            gender: (snap.gender as PetGender) ?? null,
            dateOfBirth: snap.dateOfBirth ?? null,
            weight: snap.weight ?? null,
            color: snap.color ?? null,
            allergies: snap.allergies ?? null,
            temperament: snap.temperament ?? null,
            notes: snap.notes ?? null,
            avatar: snap.avatar ?? null,
            microchipId: snap.microchipId ?? null,
            branchId: snap.branchId || null,
            customerId: snap.customerId,
            updatedAt: snap.updatedAt,
        }
    }
}
