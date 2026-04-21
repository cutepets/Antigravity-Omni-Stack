import type { BranchIdentity } from '../../../../common/utils/branch-identity.util.js'
import type { PetAccessScope } from '../policies/pet-access.policy.js'

export interface PetIdentityRef {
  id: string
  petCode: string
  branchId: string | null
  customerId: string
}

export interface PetCustomerRef {
  id: string
  branchId: string | null
}

export interface IPetReferenceLookup {
  resolveBranchIdentity(branchId?: string | null): Promise<BranchIdentity>
  findAccessiblePetIdentity(idOrCode: string, scope: PetAccessScope): Promise<PetIdentityRef | null>
  findAccessibleCustomerById(customerId: string, scope: PetAccessScope): Promise<PetCustomerRef | null>
  petExists(idOrCode: string): Promise<boolean>
  customerExists(customerId: string): Promise<boolean>
}

export const PET_REFERENCE_LOOKUP = Symbol('PET_REFERENCE_LOOKUP')
