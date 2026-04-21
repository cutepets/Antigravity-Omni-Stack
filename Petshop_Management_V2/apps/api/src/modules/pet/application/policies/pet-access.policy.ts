import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { resolvePermissions } from '@petshop/auth'
import {
  PET_REFERENCE_LOOKUP,
  type IPetReferenceLookup,
  type PetCustomerRef,
  type PetIdentityRef,
} from '../ports/pet-reference-lookup.port.js'

export interface PetActor {
  userId?: string
  role?: string
  permissions?: string[]
  branchId?: string | null
  authorizedBranchIds?: string[]
}

export interface PetAccessScope {
  restricted: boolean
  authorizedBranchIds: string[]
}

@Injectable()
export class PetAccessPolicy {
  constructor(
    @Inject(PET_REFERENCE_LOOKUP)
    private readonly referenceLookup: IPetReferenceLookup,
  ) {}

  resolvePermissions(actor?: PetActor): Set<string> {
    return new Set(resolvePermissions(actor?.permissions ?? []))
  }

  getAuthorizedBranchIds(actor?: PetActor): string[] {
    return [...new Set([...(actor?.authorizedBranchIds ?? []), ...(actor?.branchId ? [actor.branchId] : [])])]
  }

  shouldRestrictToPetBranches(actor?: PetActor): boolean {
    if (!actor) return false
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN') return false
    return !this.resolvePermissions(actor).has('branch.access.all')
  }

  getScope(actor?: PetActor): PetAccessScope {
    return {
      restricted: this.shouldRestrictToPetBranches(actor),
      authorizedBranchIds: this.getAuthorizedBranchIds(actor),
    }
  }

  getListBranchIds(actor?: PetActor): string[] | undefined {
    const scope = this.getScope(actor)
    return scope.restricted ? scope.authorizedBranchIds : undefined
  }

  assertRequestedBranchAccess(requestedBranchId: string | null | undefined, actor?: PetActor) {
    if (!requestedBranchId) return
    const scope = this.getScope(actor)
    if (scope.restricted && !scope.authorizedBranchIds.includes(requestedBranchId)) {
      throw new ForbiddenException('Chi nhánh yêu cầu không thuộc phạm vi được phân quyền')
    }
  }

  assertCanSyncAttributes(actor?: PetActor) {
    if (!this.resolvePermissions(actor).has('settings.app.update')) {
      throw new ForbiddenException('Bạn không có quyền cập nhật hàng loạt')
    }
  }

  async getAccessiblePetOrThrow(idOrCode: string, actor?: PetActor): Promise<PetIdentityRef> {
    const pet = await this.referenceLookup.findAccessiblePetIdentity(idOrCode, this.getScope(actor))
    if (pet) return pet

    const exists = await this.referenceLookup.petExists(idOrCode)
    if (exists) {
      throw new ForbiddenException('Bạn chỉ được truy cập dữ liệu thuộc chi nhánh được phân quyền')
    }

    throw new NotFoundException('Không tìm thấy thú cưng')
  }

  async getAccessibleCustomerOrThrow(customerId: string, actor?: PetActor): Promise<PetCustomerRef> {
    const customer = await this.referenceLookup.findAccessibleCustomerById(customerId, this.getScope(actor))
    if (customer) return customer

    const exists = await this.referenceLookup.customerExists(customerId)
    if (exists) {
      throw new ForbiddenException('Khách hàng không thuộc phạm vi chi nhánh được phân quyền')
    }

    throw new BadRequestException('Khách hàng không tồn tại')
  }
}
