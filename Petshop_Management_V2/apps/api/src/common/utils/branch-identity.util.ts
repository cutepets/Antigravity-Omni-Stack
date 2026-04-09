type BranchReader = {
  branch: {
    findUnique(args: {
      where: { id: string }
      select: { id: true; code: true; name: true; isMain?: true }
    }): Promise<{ id: string; code: string; name: string; isMain?: boolean } | null>
    findFirst(args: {
      where?: { isMain?: boolean; isActive?: boolean }
      orderBy?: { createdAt: 'asc' | 'desc' }
      select: { id: true; code: true; name: true; isMain?: true }
    }): Promise<{ id: string; code: string; name: string; isMain?: boolean } | null>
  }
}

export type BranchIdentity = {
  id: string
  code: string
  name: string
}

export async function resolveBranchIdentity(
  db: BranchReader,
  branchId?: string | null,
): Promise<BranchIdentity> {
  if (branchId) {
    const branch = await db.branch.findUnique({
      where: { id: branchId },
      select: { id: true, code: true, name: true, isMain: true },
    })

    if (branch) {
      return { id: branch.id, code: branch.code, name: branch.name }
    }
  }

  const mainBranch =
    (await db.branch.findFirst({
      where: { isMain: true, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true, name: true, isMain: true },
    })) ??
    (await db.branch.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true, name: true, isMain: true },
    })) ??
    (await db.branch.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true, name: true, isMain: true },
    }))

  if (!mainBranch) {
    throw new Error('No branch available for business code generation')
  }

  return { id: mainBranch.id, code: mainBranch.code, name: mainBranch.name }
}
