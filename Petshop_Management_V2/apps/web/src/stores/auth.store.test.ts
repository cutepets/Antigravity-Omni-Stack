import assert from 'node:assert/strict'
import { resolveFetchMeBranchId } from './auth-branch.utils'

const user = {
  id: 'user-1',
  username: 'admin',
  role: 'SUPER_ADMIN',
  permissions: [],
  branchId: 'branch-a',
  defaultBranchId: 'branch-a',
  authorizedBranches: [
    { id: 'branch-a', name: 'Khâm Thiên', code: 'KT', isActive: true },
    { id: 'branch-b', name: 'Chiến Thắng', code: 'CT', isActive: true },
  ],
}

assert.equal(resolveFetchMeBranchId(user as any, 'branch-b'), 'branch-b')
assert.equal(resolveFetchMeBranchId(user as any, null), 'branch-a')
assert.equal((resolveFetchMeBranchId as any)(user as any, null, 'branch-b'), 'branch-b')
