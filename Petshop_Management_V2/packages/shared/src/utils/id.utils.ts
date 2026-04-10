export const formatSequentialCode = (
  prefix: string,
  sequence: number,
  padLength = 6,
): string => `${prefix}${String(sequence).padStart(padLength, '0')}`

const formatCompactDate = (date: Date, mode: 'yyMMdd' | 'yyyyMMdd'): string => {
  const year = mode === 'yyyyMMdd'
    ? String(date.getFullYear())
    : String(date.getFullYear()).slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export const formatDatedSequenceCode = (
  prefix: string,
  date: Date,
  sequence: number,
  options?: {
    dateMode?: 'yyMMdd' | 'yyyyMMdd'
    sequencePadLength?: number
  },
): string => {
  const dateMode = options?.dateMode ?? 'yyMMdd'
  const sequencePadLength = options?.sequencePadLength ?? 3
  return `${prefix}${formatCompactDate(date, dateMode)}${String(sequence).padStart(sequencePadLength, '0')}`
}

/**
 * Generate customer code: KH000001
 */
export const generateCustomerCode = (sequence: number): string =>
  formatSequentialCode('KH', sequence)

/**
 * Generate pet code: PET000001
 */
export const generatePetCode = (sequence: number): string =>
  formatSequentialCode('PET', sequence)

/**
 * Generate staff code: NV00001
 */
export const generateStaffCode = (sequence: number): string =>
  `NV${String(sequence).padStart(5, '0')}`

/**
 * Generate order number: DH260406001
 */
export const generateOrderNumber = (date: Date, sequence: number): string => {
  return formatDatedSequenceCode('DH', date, sequence, {
    dateMode: 'yyMMdd',
    sequencePadLength: 3,
  })
}

/**
 * Generate hotel stay code: H2604TH001
 */
export const generateHotelStayCode = (
  date: Date,
  branchCode: string,
  sequence: number,
): string => {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `H${yy}${mm}${branchCode}${String(sequence).padStart(3, '0')}`
}

/**
 * Generate grooming session code: S2604TH001
 */
export const generateGroomingSessionCode = (
  date: Date,
  branchCode: string,
  sequence: number,
): string => {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `S${yy}${mm}${branchCode}${String(sequence).padStart(3, '0')}`
}

/**
 * Generate voucher number for transactions
 */
export const generateVoucherNumber = (type: 'INCOME' | 'EXPENSE', date: Date, seq: number): string => {
  const prefix = type === 'INCOME' ? 'PT' : 'PC'
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `${prefix}${dateStr}${String(seq).padStart(4, '0')}`
}
