import { BadRequestException } from '@nestjs/common'

export interface CountProgressShift {
  status: string
  countedItems: number | null
}

export interface CountProgressSession {
  status: string
  shifts: CountProgressShift[]
}

export function resolveCountedQuantity(systemQuantity: number, variance: number) {
  const countedQuantity = systemQuantity + variance
  if (countedQuantity < 0) {
    throw new BadRequestException('Count variance cannot make counted quantity negative')
  }

  return countedQuantity
}

export function buildSessionProgressUpdate(session: CountProgressSession) {
  const countedProducts = session.shifts.reduce(
    (sum, shift) => sum + (shift.countedItems ?? 0),
    0,
  )
  const allSubmitted =
    session.shifts.length > 0 &&
    session.shifts.every((shift) => ['SUBMITTED', 'APPROVED'].includes(shift.status))

  const status =
    session.status === 'APPROVED' || session.status === 'REJECTED'
      ? session.status
      : allSubmitted
        ? 'SUBMITTED'
        : 'DRAFT'

  return {
    countedProducts,
    status,
  }
}
