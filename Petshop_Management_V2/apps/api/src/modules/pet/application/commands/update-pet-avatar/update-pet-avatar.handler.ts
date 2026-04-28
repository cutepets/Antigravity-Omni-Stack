import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { UpdatePetAvatarCommand } from './update-pet-avatar.command.js'
import { PetAccessPolicy } from '../../policies/pet-access.policy.js'
import {
  PET_MEDICAL_RECORDS,
  type IPetMedicalRecords,
} from '../../ports/pet-medical-records.port.js'
import { StorageService } from '../../../../storage/storage.service.js'

@CommandHandler(UpdatePetAvatarCommand)
export class UpdatePetAvatarHandler implements ICommandHandler<UpdatePetAvatarCommand> {
  constructor(
    private readonly accessPolicy: PetAccessPolicy,
    @Inject(PET_MEDICAL_RECORDS)
    private readonly medicalRecords: IPetMedicalRecords,
    private readonly storageService: StorageService,
  ) {}

  async execute({ id, avatarUrl, actor }: UpdatePetAvatarCommand) {
    const pet = await this.accessPolicy.getAccessiblePetOrThrow(id, actor)
    const previousAvatar = String((pet as any).avatar ?? '').trim()
    if (previousAvatar && previousAvatar !== avatarUrl && this.storageService.isStoredAssetUrl(previousAvatar)) {
      await this.storageService.unbindAssetReference({
        assetUrl: previousAvatar,
        entityType: 'PET',
        entityId: pet.id,
        fieldName: 'avatar',
      })
    }
    const updated = await this.medicalRecords.updateAvatar(pet.id, avatarUrl)
    return { success: true, data: updated }
  }
}
