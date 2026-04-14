import { PrismaClient, StockCountShift } from '@prisma/client'

const prisma = new PrismaClient()

const SHIFT_SEQUENCE = [
  'MON_A',
  'MON_B',
  'MON_C',
  'MON_D',
  'TUE_A',
  'TUE_B',
  'TUE_C',
  'TUE_D',
  'WED_A',
  'WED_B',
  'WED_C',
  'WED_D',
  'THU_A',
  'THU_B',
  'THU_C',
  'THU_D',
  'FRI_A',
  'FRI_B',
  'FRI_C',
  'FRI_D',
  'SAT_A',
  'SAT_B',
  'SAT_C',
  'SAT_D',
] as const

type ShiftKey = (typeof SHIFT_SEQUENCE)[number]
type SeedScenario = 'draft-mixed' | 'submitted-all' | 'fresh'

const DAY_SHIFT_GROUPS: Record<string, ShiftKey[]> = {
  MON: ['MON_A', 'MON_B', 'MON_C', 'MON_D'],
  TUE: ['TUE_A', 'TUE_B', 'TUE_C', 'TUE_D'],
  WED: ['WED_A', 'WED_B', 'WED_C', 'WED_D'],
  THU: ['THU_A', 'THU_B', 'THU_C', 'THU_D'],
  FRI: ['FRI_A', 'FRI_B', 'FRI_C', 'FRI_D'],
  SAT: ['SAT_A', 'SAT_B', 'SAT_C', 'SAT_D'],
}

const CATEGORY_DAY_PREFERENCES: Array<{ keywords: string[]; days: string[] }> = [
  { keywords: ['thuc an', 'food', 'treat', 'snack'], days: ['MON', 'TUE'] },
  { keywords: ['ve sinh', 'litter', 'bath', 'shampoo'], days: ['WED', 'THU'] },
  { keywords: ['cham soc', 'care', 'supplement'], days: ['THU', 'FRI'] },
  { keywords: ['phu kien', 'accessory', 'toy'], days: ['FRI', 'SAT'] },
  { keywords: ['thuoc', 'medicine', 'med'], days: ['SAT', 'FRI'] },
]

const COUNT_PERMISSIONS = [
  'stock_count.create',
  'stock_count.read',
  'stock_count.update',
  'stock_count.count',
  'stock_count.approve',
]

type BranchRow = {
  id: string
  code: string
  name: string
}

type BranchStockRow = {
  productId: string
  productVariantId: string | null
  stock: number
  product: {
    id: string
    name: string
    category: string | null
    lastCountShift: ShiftKey | null
  }
}

function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getWeekWindow(date: Date) {
  const base = new Date(date)
  base.setHours(0, 0, 0, 0)
  const day = base.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(base)
  monday.setDate(base.getDate() + diffToMonday)
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() + 5)
  return { monday, saturday }
}

function getShiftDate(startDate: Date, shift: ShiftKey) {
  const dayOffset = SHIFT_SEQUENCE.indexOf(shift) >= 0 ? Math.floor(SHIFT_SEQUENCE.indexOf(shift) / 4) : 0
  const date = new Date(startDate)
  date.setDate(date.getDate() + dayOffset)
  date.setHours(0, 0, 0, 0)
  return date
}

function normalizeCategory(value: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .trim()
}

function getPreferredDaysForCategory(category: string | null) {
  const normalized = normalizeCategory(category)
  const rule = CATEGORY_DAY_PREFERENCES.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  )
  return rule?.days ?? []
}

function pickLeastLoadedShift(loadByShift: Map<ShiftKey, number>, shifts = SHIFT_SEQUENCE as readonly ShiftKey[]) {
  return shifts.reduce((bestShift, shift) => {
    const bestLoad = loadByShift.get(bestShift) ?? 0
    const currentLoad = loadByShift.get(shift) ?? 0
    return currentLoad < bestLoad ? shift : bestShift
  }, shifts[0]!)
}

function pickShiftByCategory(category: string | null, loadByShift: Map<ShiftKey, number>) {
  const preferredDays = getPreferredDaysForCategory(category)
  if (preferredDays.length > 0) {
    const preferredShifts = preferredDays.flatMap((dayKey) => DAY_SHIFT_GROUPS[dayKey] ?? [])
    if (preferredShifts.length > 0) {
      return pickLeastLoadedShift(loadByShift, preferredShifts)
    }
  }

  return pickLeastLoadedShift(loadByShift)
}

function buildVariance(seed: number) {
  const mod = seed % 6
  if (mod === 0) return -2
  if (mod === 1) return -1
  if (mod === 2) return 0
  if (mod === 3) return 1
  if (mod === 4) return 2
  return 0
}

async function ensureRolePermissions() {
  const roles = await prisma.role.findMany()
  for (const role of roles) {
    const currentPermissions = Array.isArray(role.permissions) ? (role.permissions as string[]) : []
    let nextPermissions = currentPermissions

    if (role.code === 'STAFF') {
      nextPermissions = Array.from(new Set([...currentPermissions, 'stock_count.read', 'stock_count.count']))
    } else if (['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role.code)) {
      nextPermissions = Array.from(new Set([...currentPermissions, ...COUNT_PERMISSIONS]))
    }

    if (nextPermissions.length !== currentPermissions.length) {
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permissions: nextPermissions as any,
        },
      })
    }
  }
}

async function clearSomeProductShiftsForSuggestionDemo() {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      category: true,
      name: true,
      createdAt: true,
    },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  })

  const selectedIds: string[] = []
  const seenCategories = new Map<string, number>()

  for (const product of products) {
    const categoryKey = normalizeCategory(product.category)
    const usedCount = seenCategories.get(categoryKey) ?? 0
    if (usedCount >= 2) {
      continue
    }

    seenCategories.set(categoryKey, usedCount + 1)
    selectedIds.push(product.id)
  }

  if (selectedIds.length > 0) {
    await prisma.product.updateMany({
      where: { id: { in: selectedIds } },
      data: { lastCountShift: null },
    })
  }
}

async function loadBranchRows(branchId: string) {
  const rows = await prisma.branchStock.findMany({
    where: {
      branchId,
      productId: { not: null },
      product: {
        isActive: true,
        deletedAt: null,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          category: true,
          lastCountShift: true,
        },
      },
    },
    orderBy: [{ product: { category: 'asc' } }, { product: { name: 'asc' } }],
  })

  return rows as BranchStockRow[]
}

async function ensureProductAssignments(rows: BranchStockRow[]) {
  const loadByShift = new Map<ShiftKey, number>()
  for (const shift of SHIFT_SEQUENCE) {
    loadByShift.set(shift, 0)
  }

  const products = new Map<
    string,
    { id: string; category: string | null; lastCountShift: ShiftKey | null; rowCount: number }
  >()

  for (const row of rows) {
    const current = products.get(row.productId)
    if (current) {
      current.rowCount += 1
    } else {
      products.set(row.productId, {
        id: row.product.id,
        category: row.product.category,
        lastCountShift: row.product.lastCountShift,
        rowCount: 1,
      })
    }

    if (row.product.lastCountShift) {
      loadByShift.set(
        row.product.lastCountShift,
        (loadByShift.get(row.product.lastCountShift) ?? 0) + 1,
      )
    }
  }

  const missing = Array.from(products.values()).filter((product) => !product.lastCountShift)
  const updatesByShift = new Map<ShiftKey, string[]>()
  for (const shift of SHIFT_SEQUENCE) {
    updatesByShift.set(shift, [])
  }

  for (const product of missing) {
    const shift = pickShiftByCategory(product.category, loadByShift)
    loadByShift.set(shift, (loadByShift.get(shift) ?? 0) + product.rowCount)
    updatesByShift.get(shift)!.push(product.id)
  }

  for (const shift of SHIFT_SEQUENCE) {
    const productIds = updatesByShift.get(shift)!
    if (productIds.length === 0) continue
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { lastCountShift: shift },
    })
  }
}

async function markShiftStarted(
  shiftId: string,
  counterId: string,
  ratio = 0.5,
) {
  const shift = await prisma.stockCountShiftSession.findUnique({
    where: { id: shiftId },
    include: { items: { orderBy: { id: 'asc' } } },
  })

  if (!shift) return

  const itemCount = Math.max(1, Math.ceil(shift.items.length * ratio))
  let countedItems = 0
  for (let index = 0; index < itemCount; index += 1) {
    const item = shift.items[index]
    if (!item) continue
    const variance = buildVariance(index)
    await prisma.stockCountItem.update({
      where: { id: item.id },
      data: {
        variance,
        countedQuantity: Math.max(0, item.systemQuantity + variance),
        notes: variance === 0 ? 'Khop he thong' : 'Demo kiem dang do doi chieu',
      },
    })
    countedItems += 1
  }

  const startedAt = new Date(shift.countDate)
  startedAt.setHours(9, 0, 0, 0)
  await prisma.stockCountShiftSession.update({
    where: { id: shiftId },
    data: {
      countedBy: counterId,
      startedAt,
      countedItems,
      status: 'DRAFT',
      notes: 'Demo ca dang kiem',
    } as any,
  })
}

async function markShiftSubmitted(
  shiftId: string,
  counterId: string,
  seedOffset = 0,
) {
  const shift = await prisma.stockCountShiftSession.findUnique({
    where: { id: shiftId },
    include: { items: { orderBy: { id: 'asc' } } },
  })

  if (!shift) return

  for (let index = 0; index < shift.items.length; index += 1) {
    const item = shift.items[index]!
    const variance = buildVariance(index + seedOffset)
    await prisma.stockCountItem.update({
      where: { id: item.id },
      data: {
        variance,
        countedQuantity: Math.max(0, item.systemQuantity + variance),
        notes: variance === 0 ? 'Khop he thong' : 'Demo cho manager doi chieu',
      },
    })
  }

  const startedAt = new Date(shift.countDate)
  startedAt.setHours(8, 30, 0, 0)
  const completedAt = new Date(shift.countDate)
  completedAt.setHours(11, 15, 0, 0)

  await prisma.stockCountShiftSession.update({
    where: { id: shiftId },
    data: {
      countedBy: counterId,
      startedAt,
      completedAt,
      countedItems: shift.items.length,
      status: 'SUBMITTED',
      notes: 'Demo ca da nop cho quan ly duyet',
    } as any,
  })
}

async function createSessionForBranch(
  branch: BranchRow,
  startDate: Date,
  endDate: Date,
  weekNumber: number,
  year: number,
  scenario: SeedScenario,
) {
  const manager =
    (await prisma.user.findFirst({
      where: {
        branchId: branch.id,
        role: { code: 'MANAGER' },
      },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.user.findFirst({
      where: {
        branchId: branch.id,
      },
      orderBy: { createdAt: 'asc' },
    }))

  if (!manager) {
    throw new Error(`Branch ${branch.code} does not have a demo user.`)
  }

  const counters = await prisma.user.findMany({
    where: {
      branchId: branch.id,
    },
    orderBy: { createdAt: 'asc' },
    take: 3,
  })

  if (counters.length === 0) {
    throw new Error(`Branch ${branch.code} does not have counter users.`)
  }

  const existing = await prisma.stockCountSession.findUnique({
    where: {
      branchId_weekNumber_year: {
        branchId: branch.id,
        weekNumber,
        year,
      },
    },
  })

  if (existing) {
    await prisma.stockCountSession.delete({
      where: { id: existing.id },
    })
  }

  let rows = await loadBranchRows(branch.id)
  await ensureProductAssignments(rows)
  rows = await loadBranchRows(branch.id)

  const assignments = new Map<ShiftKey, BranchStockRow[]>()
  for (const shift of SHIFT_SEQUENCE) {
    assignments.set(shift, [])
  }

  for (const row of rows) {
    const shift = row.product.lastCountShift as ShiftKey | null
    if (!shift) continue
    assignments.get(shift)!.push(row)
  }

  const session = await prisma.stockCountSession.create({
    data: {
      branchId: branch.id,
      weekNumber,
      year,
      startDate,
      endDate,
      createdBy: manager.id,
      totalProducts: rows.length,
      countedProducts: 0,
      status: 'DRAFT',
    } as any,
  })

  for (const shift of SHIFT_SEQUENCE) {
    const items = assignments.get(shift)!
    if (items.length === 0) continue

    await prisma.stockCountShiftSession.create({
      data: {
        sessionId: session.id,
        shift: shift as StockCountShift,
        countDate: getShiftDate(startDate, shift),
        countedBy: null,
        totalItems: items.length,
        countedItems: 0,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId ?? null,
            categoryId: 'PRODUCT',
            systemQuantity: item.stock,
          })),
        },
      } as any,
    })
  }

  const createdShifts = await prisma.stockCountShiftSession.findMany({
    where: { sessionId: session.id },
    include: { items: true },
    orderBy: [{ countDate: 'asc' }, { shift: 'asc' }],
  })

  if (scenario === 'draft-mixed') {
    if (createdShifts[0]) await markShiftStarted(createdShifts[0].id, counters[0]!.id, 0.5)
    if (createdShifts[1]) await markShiftSubmitted(createdShifts[1].id, counters[1 % counters.length]!.id, 3)
    if (createdShifts[2]) await markShiftSubmitted(createdShifts[2].id, counters[2 % counters.length]!.id, 6)
  }

  if (scenario === 'submitted-all') {
    for (let index = 0; index < createdShifts.length; index += 1) {
      const shift = createdShifts[index]!
      await markShiftSubmitted(shift.id, counters[index % counters.length]!.id, index)
    }
  }

  const refreshedShifts = await prisma.stockCountShiftSession.findMany({
    where: { sessionId: session.id },
    select: {
      id: true,
      status: true,
      countedItems: true,
      totalItems: true,
    },
  })

  const countedProducts = refreshedShifts.reduce((sum, shift) => sum + (shift.countedItems ?? 0), 0)
  const allSubmitted =
    refreshedShifts.length > 0 &&
    refreshedShifts.every((shift) => shift.status === 'SUBMITTED')

  await prisma.stockCountSession.update({
    where: { id: session.id },
    data: {
      countedProducts,
      status: allSubmitted ? 'SUBMITTED' : 'DRAFT',
      rejectionReason: null,
      approvedBy: null,
      approvedAt: null,
    },
  })

  return {
    sessionId: session.id,
    totalProducts: rows.length,
    countedProducts,
    shiftCount: createdShifts.length,
    status: allSubmitted ? 'SUBMITTED' : 'DRAFT',
  }
}

async function main() {
  console.log('Seeding stock count demo data...')

  await ensureRolePermissions()
  await clearSomeProductShiftsForSuggestionDemo()

  const branches = await prisma.branch.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
    },
  })

  if (branches.length === 0) {
    throw new Error('No branches found. Run the main seed first.')
  }

  const today = new Date()
  const { monday, saturday } = getWeekWindow(today)
  const weekNumber = getWeekNumber(today)
  const year = today.getFullYear()

  const scenarios: SeedScenario[] = ['draft-mixed', 'submitted-all', 'fresh']
  for (let index = 0; index < branches.length; index += 1) {
    const branch = branches[index]!
    const scenario = scenarios[index] ?? 'fresh'
    const summary = await createSessionForBranch(branch, monday, saturday, weekNumber, year, scenario)
    console.log(
      `- ${branch.code}: session=${summary.sessionId} status=${summary.status} shifts=${summary.shiftCount} counted=${summary.countedProducts}/${summary.totalProducts}`,
    )
  }

  console.log(`Stock count demo ready for week ${weekNumber}/${year}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
