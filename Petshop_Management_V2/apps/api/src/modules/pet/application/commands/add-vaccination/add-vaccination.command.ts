import type { AddVaccinationDto } from '../../../dto/add-vaccination.dto.js'
import type { PetActor } from '../../policies/pet-access.policy.js'

export class AddVaccinationCommand {
  constructor(
    public readonly id: string,
    public readonly dto: AddVaccinationDto,
    public readonly actor?: PetActor,
  ) {}
}
