import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { AddWeightLogCommand } from './add-weight-log.command.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'
import {
  PET_MEDICAL_RECORDS,
  type IPetMedicalRecords,
} from '../../ports/pet-medical-records.port.js'

@CommandHandler(AddWeightLogCommand)
export class AddWeightLogHandler implements ICommandHandler<AddWeightLogCommand> {
  constructor(
    private readonly accessPolicy: PetAccessPolicy,
    @Inject(PET_MEDICAL_RECORDS)
    private readonly medicalRecords: IPetMedicalRecords,
  ) {}

  async execute({ id, dto, actor }: AddWeightLogCommand) {
    const pet = await this.accessPolicy.getAccessiblePetOrThrow(id, actor)
    const weightLog = await this.medicalRecords.createWeightLog({
      petId: pet.id,
      weight: dto.weight,
      notes: dto.notes,
      ...(dto.date ? { date: new Date(dto.date) } : {}),
    })

    await Promise.all([
      this.medicalRecords.updatePetWeight(pet.id, dto.weight),
      this.medicalRecords.appendTimelineEntry({
        petId: pet.id,
        action: 'WEIGHT_UPDATED',
        metadata: { weight: dto.weight, notes: dto.notes ?? null },
      }),
    ])

    return { success: true, data: weightLog }
  }
}
