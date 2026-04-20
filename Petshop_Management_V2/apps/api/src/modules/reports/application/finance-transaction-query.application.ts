type QueryOptions = {
  branchIdFilter?: unknown
  where: any
  openingWhere: any
  includeMeta: boolean
  transactionSources: string[]
  normalizeTransaction: (tx: any) => any
}

export async function runFinanceTransactionQuery(
  db: any,
  pagination: { page: number; limit: number; includeMeta: boolean },
  options: QueryOptions,
) {
  const skip = (pagination.page - 1) * pagination.limit

  const listPromise = Promise.all([
    db.transaction.findMany({
      where: options.where,
      skip,
      take: pagination.limit,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        staff: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
      },
    }),
    db.transaction.count({ where: options.where }),
    db.transaction.aggregate({
      where: { ...options.where, type: 'INCOME' },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { ...options.where, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
    options.openingWhere
      ? db.transaction.aggregate({
          where: { ...options.openingWhere, type: 'INCOME' },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
    options.openingWhere
      ? db.transaction.aggregate({
          where: { ...options.openingWhere, type: 'EXPENSE' },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
  ])

  const metaPromise = options.includeMeta
    ? Promise.all([
        db.branch.findMany({
          where: {
            isActive: true,
            ...(options.branchIdFilter !== undefined ? { id: options.branchIdFilter } : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        db.user.findMany({
          where: {
            transactions: {
              some: options.branchIdFilter !== undefined ? { branchId: options.branchIdFilter } : {},
            },
          },
          select: { id: true, fullName: true },
          orderBy: { fullName: 'asc' },
        }),
        db.transaction.findMany({
          where: {
            ...(options.branchIdFilter !== undefined ? { branchId: options.branchIdFilter } : {}),
            OR: [{ paymentAccountId: { not: null } }, { paymentMethod: { not: null } }],
          },
          select: {
            paymentMethod: true,
            paymentAccountId: true,
            paymentAccountLabel: true,
          },
          orderBy: [{ paymentAccountLabel: 'asc' }, { paymentMethod: 'asc' }],
        }),
        db.transaction.findMany({
          where: {
            ...(options.branchIdFilter !== undefined ? { branchId: options.branchIdFilter } : {}),
          },
          select: { source: true },
          distinct: ['source'],
        }),
      ])
    : Promise.resolve(null)

  const [[rows, total, incomeAgg, expenseAgg, openingIncomeAgg, openingExpenseAgg], metaResult] =
    await Promise.all([listPromise, metaPromise])

  const openingBalance = (openingIncomeAgg._sum.amount ?? 0) - (openingExpenseAgg._sum.amount ?? 0)
  const totalIncome = incomeAgg._sum.amount ?? 0
  const totalExpense = expenseAgg._sum.amount ?? 0
  const closingBalance = openingBalance + totalIncome - totalExpense

  const data: any = {
    transactions: rows.map((tx: any) => options.normalizeTransaction(tx)),
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
    openingBalance,
    totalIncome,
    totalExpense,
    closingBalance,
  }

  if (metaResult) {
    const [branches, creators, paymentMethods, sources] = metaResult
    const paymentMethodEntries = Array.from(
      paymentMethods.reduce((map: Map<string, string>, item: any) => {
        const value = item.paymentAccountId ?? item.paymentMethod
        const label = item.paymentAccountLabel ?? item.paymentMethod
        if (value && label && !map.has(value)) {
          map.set(value, label)
        }
        return map
      }, new Map<string, string>()),
    ) as Array<[string, string]>

    const paymentMethodOptions = paymentMethodEntries
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'vi'))

    data.meta = {
      branches,
      paymentMethods: paymentMethodOptions,
      creators: creators.map((item: any) => ({ id: item.id, name: item.fullName })),
      sources: Array.from(new Set([...options.transactionSources, ...sources.map((item: any) => item.source).filter(Boolean)])).sort(),
    }
  }

  return { success: true, data }
}
