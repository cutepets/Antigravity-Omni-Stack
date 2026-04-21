import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { SyncPetAttributeCommand } from './sync-pet-attribute.command.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'
import {
  PET_MEDICAL_RECORDS,
  type IPetMedicalRecords,
} from '../../ports/pet-medical-records.port.js'

@CommandHandler(SyncPetAttributeCommand)
export class SyncPetAttributeHandler implements ICommandHandler<SyncPetAttributeCommand> {
  constructor(
    private readonly accessPolicy: PetAccessPolicy,
    @Inject(PET_MEDICAL_RECORDS)
    private readonly medicalRecords: IPetMedicalRecords,
  ) {}

  async execute({ dto, actor }: SyncPetAttributeCommand) {
    this.accessPolicy.assertCanSyncAttributes(actor)
    const count = await this.medicalRecords.syncAttribute(dto.attribute, dto.oldValue, dto.newValue)
    return { success: true, count }
  }
}
