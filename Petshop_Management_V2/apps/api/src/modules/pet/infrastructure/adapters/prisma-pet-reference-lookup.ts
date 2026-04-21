import { Injectable } from '@nestjs/common'
import { Prisma } from '@petshop/database'
import { resolveBranchIdentity } from '../../../../common/utils/branch-identity.util.js'
import { DatabaseService } from '../../../../database/database.service.js'
import type {
  IPetReferenceLookup,
  PetCustomerRef,
  PetIdentityRef,
} from '../../application/ports/pet-reference-lookup.port.js'
import type { PetAccessScope } from '../../application/policies/pet-access.policy.js'

@Injectable()
export class PrismaPetReferenceLookup implements IPetReferenceLookup {
  constructor(private readonly db: DatabaseService) {}

  resolveBranchIdentity(branchId?: string | null) {
    return resolveBranchIdentity(this.db, branchId)
  }

  async findAccessiblePetIdentity(idOrCode: string, scope: PetAccessScope): Promise<PetIdentityRef | null> {
    return this.db.pet.findFirst({
      where: this.mergePetScope(this.buildPetIdentityWhere(idOrCode), scope),
      select: { id: true, petCode: true, branchId: true, customerId: true },
    })
  }

  async findAccessibleCustomerById(customerId: string, scope: PetAccessScope): Promise<PetCustomerRef | null> {
    const customerScope = this.buildCustomerScope(scope)
    const where = customerScope ? { AND: [{ id: customerId }, customerScope] } : { id: customerId }
    return this.db.customer.findFirst({
      where,
      select: { id: true, branchId: true },
    })
  }

  async petExists(idOrCode: string): Promise<boolean> {
    const pet = await this.db.pet.findFirst({
      where: this.buildPetIdentityWhere(idOrCode),
      select: { id: true },
    })
    return Boolean(pet)
  }

  async customerExists(customerId: string): Promise<boolean> {
    const customer = await this.db.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    })
    return Boolean(customer)
  }

  private buildPetIdentityWhere(idOrCode: string): Prisma.PetWhereInput {
    return { OR: [{ id: idOrCode }, { petCode: idOrCode }] }
  }

  private mergePetScope(where: Prisma.PetWhereInput, scope: PetAccessScope): Prisma.PetWhereInput {
    const petScope = this.buildPetScope(scope)
    if (!petScope) return where
    if (Object.keys(where).length === 0) return petScope
    return { AND: [where, petScope] }
  }

  private buildPetScope(scope: PetAccessScope): Prisma.PetWhereInput | null {
    if (!scope.restricted) return null

    const customerScope = this.buildCustomerScope(scope)
    return {
      OR: [
        { branchId: { in: scope.authorizedBranchIds } },
        {
          AND: [
            { branchId: null },
            ...(customerScope ? [{ customer: { is: customerScope } }] : []),
          ],
        },
      ],
    }
  }

  private buildCustomerScope(scope: PetAccessScope): Prisma.CustomerWhereInput | null {
    if (!scope.restricted) return null

    return {
      OR: [
        { branchId: { in: scope.authorizedBranchIds } },
        {
          AND: [
            { branchId: null },
            {
              OR: [
                { orders: { some: { branchId: { in: scope.authorizedBranchIds } } } },
                { hotelStays: { some: { branchId: { in: scope.authorizedBranchIds } } } },
                { pets: { some: { branchId: { in: scope.authorizedBranchIds } } } },
              ],
            },
          ],
        },
      ],
    }
  }
}
