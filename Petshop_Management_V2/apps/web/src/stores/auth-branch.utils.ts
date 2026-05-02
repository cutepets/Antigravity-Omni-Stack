import type { AuthUser, BaseBranch } from '@petshop/shared'

export const ACTIVE_BRANCH_STORAGE_KEY = 'petshop-active-branch-id'

export function normalizeAllowedBranches(user: AuthUser | null): BaseBranch[] {
  return user?.authorizedBranches ?? []
}

export function resolveActiveBranchId(
  user: AuthUser | null,
  currentBranchId?: string | null,
  rememberedBranchId?: string | null,
) {
  const allowedBranches = normalizeAllowedBranches(user)

  const candidates = [currentBranchId, rememberedBranchId, user?.defaultBranchId, user?.branchId]
  for (const id of candidates) {
    if (id && allowedBranches.some((branch) => branch.id === id)) return id
  }

  return allowedBranches[0]?.id ?? null
}

export function resolveFetchMeBranchId(
  user: AuthUser | null,
  currentBranchId?: string | null,
  rememberedBranchId?: string | null,
) {
  return resolveActiveBranchId(user, currentBranchId ?? null, rememberedBranchId ?? null)
}

export function readStoredActiveBranchId() {
  if (typeof window === 'undefined') return null

  return window.localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY)
}

export function writeStoredActiveBranchId(branchId: string | null) {
  if (typeof window === 'undefined') return

  if (branchId) {
    window.localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId)
    return
  }

  window.localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY)
}
