import type { AddWeightLogDto } from '../../../dto/add-weight-log.dto.js'
import type { PetActor } from '../../policies/pet-access.policy.js'

export class AddWeightLogCommand {
  constructor(
    public readonly id: string,
    public readonly dto: AddWeightLogDto,
    public readonly actor?: PetActor,
  ) {}
}
