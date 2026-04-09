import type { Request } from 'express'

export function getRequestedBranchId(req?: Request): string | undefined {
  const rawBranchId = req?.headers['x-branch-id']

  if (Array.isArray(rawBranchId)) {
    const branchId = rawBranchId.find((value) => typeof value === 'string' && value.trim().length > 0)
    return branchId?.trim()
  }

  if (typeof rawBranchId === 'string' && rawBranchId.trim().length > 0) {
    return rawBranchId.trim()
  }

  return undefined
}
