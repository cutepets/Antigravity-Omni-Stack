import type { DatabaseService } from '../../database/database.service.js'

export type FinanceVoucherType = 'INCOME' | 'EXPENSE'

const FINANCE_VOUCHER_PREFIX: Record<FinanceVoucherType, string> = {
  INCOME: 'PT',
  EXPENSE: 'PC',
}

const FINANCE_VOUCHER_SEQUENCE_LENGTH: Record<FinanceVoucherType, number> = {
  INCOME: 3,
  EXPENSE: 4,
}

export function getFinanceVoucherBase(type: FinanceVoucherType, issuedAt: Date) {
  const yy = String(issuedAt.getFullYear()).slice(-2)
  const mm = String(issuedAt.getMonth() + 1).padStart(2, '0')
  const dd = String(issuedAt.getDate()).padStart(2, '0')
  return `${FINANCE_VOUCHER_PREFIX[type]}${yy}${mm}${dd}`
}

export function formatFinanceVoucherNumber(type: FinanceVoucherType, issuedAt: Date, sequence: number) {
  return `${getFinanceVoucherBase(type, issuedAt)}${String(sequence).padStart(FINANCE_VOUCHER_SEQUENCE_LENGTH[type], '0')}`
}

export async function generateFinanceVoucherNumber(
  db: Pick<DatabaseService, 'transaction'>,
  type: FinanceVoucherType,
  issuedAt: Date = new Date(),
) {
  const voucherBase = getFinanceVoucherBase(type, issuedAt)
  const latest = await db.transaction.findFirst({
    where: {
      voucherNumber: {
        startsWith: voucherBase,
      },
    } as any,
    orderBy: {
      voucherNumber: 'desc',
    },
    select: {
      voucherNumber: true,
    },
  })

  const latestSequence = latest?.voucherNumber?.slice(voucherBase.length) ?? ''
  const nextSequence = /^\d+$/.test(latestSequence) ? Number(latestSequence) + 1 : 1

  return formatFinanceVoucherNumber(type, issuedAt, nextSequence)
}
