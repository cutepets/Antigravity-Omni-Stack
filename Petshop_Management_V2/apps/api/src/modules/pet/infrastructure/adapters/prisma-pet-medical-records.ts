import { Injectable } from '@nestjs/common'
import { Prisma } from '@petshop/database'
import { DatabaseService } from '../../../../database/database.service.js'
import type {
  AppendPetTimelineEntryInput,
  CreateVaccinationInput,
  CreateWeightLogInput,
  IPetMedicalRecords,
} from '../../application/ports/pet-medical-records.port.js'
import { SyncAttributeType } from '../../dto/sync-attribute.dto.js'

@Injectable()
export class PrismaPetMedicalRecords implements IPetMedicalRecords {
  constructor(private readonly db: DatabaseService) {}

  async createWeightLog(input: CreateWeightLogInput): Promise<Record<string, unknown>> {
    return this.db.petWeightLog.create({
      data: {
        petId: input.petId,
        weight: input.weight,
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.date ? { date: input.date } : {}),
      },
    }) as Promise<Record<string, unknown>>
  }

  async updatePetWeight(petId: string, weight: number): Promise<void> {
    await this.db.pet.update({
      where: { id: petId },
      data: { weight },
    })
  }

  async createVaccination(input: CreateVaccinationInput): Promise<Record<string, unknown>> {
    return this.db.petVaccination.create({
      data: {
        petId: input.petId,
        vaccineName: input.vaccineName,
        date: input.date,
        ...(input.nextDueDate ? { nextDueDate: input.nextDueDate } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        ...(input.photoUrl ? { photoUrl: input.photoUrl } : {}),
      },
    }) as Promise<Record<string, unknown>>
  }

  async updateAvatar(petId: string, avatarUrl: string): Promise<Record<string, unknown>> {
    return this.db.pet.update({
      where: { id: petId },
      data: { avatar: avatarUrl },
    }) as Promise<Record<string, unknown>>
  }

  async appendTimelineEntry(input: AppendPetTimelineEntryInput): Promise<void> {
    await this.db.petTimeline.create({
      data: {
        petId: input.petId,
        action: input.action,
        ...(input.metadata
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    })
  }

  async syncAttribute(attribute: SyncAttributeType, oldValue: string, newValue: string): Promise<number> {
    if (attribute === SyncAttributeType.BREED) {
      const result = await this.db.pet.updateMany({
        where: { breed: oldValue },
        data: { breed: newValue },
      })
      return result.count
    }

    if (attribute === SyncAttributeType.TEMPERAMENT) {
      const result = await this.db.pet.updateMany({
        where: { temperament: oldValue },
        data: { temperament: newValue },
      })
      return result.count
    }

    return 0
  }
}
