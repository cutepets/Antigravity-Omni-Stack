import type { PetActor } from '../../policies/pet-access.policy.js'

export class UpdatePetAvatarCommand {
  constructor(
    public readonly id: string,
    public readonly avatarUrl: string,
    public readonly actor?: PetActor,
  ) {}
}
