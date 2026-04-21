import type { SyncAttributeDto } from '../../../dto/sync-attribute.dto.js'
import type { PetActor } from '../../policies/pet-access.policy.js'

export class SyncPetAttributeCommand {
  constructor(
    public readonly dto: SyncAttributeDto,
    public readonly actor?: PetActor,
  ) {}
}
