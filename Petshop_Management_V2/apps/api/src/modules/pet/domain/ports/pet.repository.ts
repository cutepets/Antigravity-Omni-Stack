import type { PetEntity } from '../entities/pet.entity.js'

export interface PetFilter {
    q?: string
    species?: string
    gender?: string
    customerId?: string
    branchIds?: string[]
    page?: number
    limit?: number
}

export interface PetFindResult {
    data: PetEntity[]
    total: number
}

/**
 * Port (Output): Repository contract for the Pet domain.
 * Infrastructure layer MUST implement this interface.
 * Domain/Application layers depend ONLY on this interface — never on Prisma directly.
 */
export interface IPetRepository {
    findById(idOrCode: string): Promise<PetEntity | null>
    findAll(filter: PetFilter): Promise<PetFindResult>
    save(pet: PetEntity): Promise<PetEntity>
    update(pet: PetEntity): Promise<PetEntity>
    delete(id: string): Promise<void>
    nextCode(): Promise<string>
}

/** NestJS DI injection token (Symbol to avoid string collisions) */
export const PET_REPOSITORY = Symbol('IPetRepository')
