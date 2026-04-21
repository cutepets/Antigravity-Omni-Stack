import type { PetActor } from '../../policies/pet-access.policy.js'

export class GetActivePetServicesQuery {
  constructor(
    public readonly petId: string,
    public readonly actor?: PetActor,
  ) {}
}
