import { ForbiddenException } from '@nestjs/common'
import { resolvePermissions } from '@petshop/auth'
import type { JwtPayload } from '@petshop/shared'

export type BranchScopedUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>

function normalizeBranchId(branchId?: string | null): string | null {
  const normalized = branchId?.trim()
  return normalized ? normalized : null
}

export function getAuthorizedBranchIds(user?: BranchScopedUser): string[] {
  return [...new Set([...(user?.authorizedBranchIds ?? []), ...(user?.branchId ? [user.branchId] : [])])]
}

export function hasGlobalBranchAccess(user?: BranchScopedUser): boolean {
  if (!user) return true
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true

  const permissions = new Set(resolvePermissions(user.permissions ?? []))
  return permissions.has('branch.access.all')
}

export function getScopedBranchIds(
  user?: BranchScopedUser,
  requestedBranchId?: string | null,
): string[] | null {
  const normalizedRequestedBranchId = normalizeBranchId(requestedBranchId)

  if (hasGlobalBranchAccess(user)) {
    return normalizedRequestedBranchId ? [normalizedRequestedBranchId] : null
  }

  const authorizedBranchIds = getAuthorizedBranchIds(user)

  if (normalizedRequestedBranchId) {
    if (!authorizedBranchIds.includes(normalizedRequestedBranchId)) {
      throw new ForbiddenException('Bạn chỉ được truy cập dữ liệu thuộc chi nhánh được phân quyền')
    }

    return [normalizedRequestedBranchId]
  }

  return authorizedBranchIds
}

export function assertBranchAccess(branchId: string | null | undefined, user?: BranchScopedUser) {
  if (hasGlobalBranchAccess(user)) return

  const authorizedBranchIds = getAuthorizedBranchIds(user)
  if (!branchId || !authorizedBranchIds.includes(branchId)) {
    throw new ForbiddenException('Bạn chỉ được truy cập dữ liệu thuộc chi nhánh được phân quyền')
  }
}

export function resolveWritableBranchId(
  user?: BranchScopedUser,
  requestedBranchId?: string | null,
): string | null {
  const normalizedRequestedBranchId = normalizeBranchId(requestedBranchId)

  if (hasGlobalBranchAccess(user)) {
    return normalizedRequestedBranchId ?? normalizeBranchId(user?.branchId) ?? null
  }

  const authorizedBranchIds = getAuthorizedBranchIds(user)
  const targetBranchId =
    normalizedRequestedBranchId ?? normalizeBranchId(user?.branchId) ?? authorizedBranchIds[0] ?? null

  if (!targetBranchId || !authorizedBranchIds.includes(targetBranchId)) {
    throw new ForbiddenException('Bạn chỉ được thao tác dữ liệu thuộc chi nhánh được phân quyền')
  }

  return targetBranchId
}
