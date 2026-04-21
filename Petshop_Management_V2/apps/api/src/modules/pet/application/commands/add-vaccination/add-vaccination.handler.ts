import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { AddVaccinationCommand } from './add-vaccination.command.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'
import {
  PET_MEDICAL_RECORDS,
  type IPetMedicalRecords,
} from '../../ports/pet-medical-records.port.js'

@CommandHandler(AddVaccinationCommand)
export class AddVaccinationHandler implements ICommandHandler<AddVaccinationCommand> {
  constructor(
    private readonly accessPolicy: PetAccessPolicy,
    @Inject(PET_MEDICAL_RECORDS)
    private readonly medicalRecords: IPetMedicalRecords,
  ) {}

  async execute({ id, dto, actor }: AddVaccinationCommand) {
    const pet = await this.accessPolicy.getAccessiblePetOrThrow(id, actor)
    const vaccination = await this.medicalRecords.createVaccination({
      petId: pet.id,
      vaccineName: dto.vaccineName,
      date: new Date(dto.date),
      ...(dto.nextDueDate ? { nextDueDate: new Date(dto.nextDueDate) } : {}),
      ...(dto.notes ? { notes: dto.notes } : {}),
      ...(dto.photoUrl ? { photoUrl: dto.photoUrl } : {}),
    })

    await this.medicalRecords.appendTimelineEntry({
      petId: pet.id,
      action: 'VACCINATION_ADDED',
      metadata: {
        vaccineName: dto.vaccineName,
        date: dto.date,
        notes: dto.notes ?? null,
      },
    })

    return { success: true, data: vaccination }
  }
}
