/**
 * Generate pet code: P1B2C3 (P + 6 hex chars)
 */
export const generatePetCode = (): string => {
  const chars = '0123456789ABCDEF'
  let res = 'P'
  for (let i = 0; i < 6; i++) res += chars[Math.floor(Math.random() * 16)]
  return res
}

/**
 * Generate staff code: NV00001
 */
export const generateStaffCode = (sequence: number): string =>
  `NV${String(sequence).padStart(5, '0')}`

/**
 * Generate order number: DH260303S0001 (DHYYMMDDSXXXX, reset per day)
 */
export const generateOrderNumber = (date: Date, sequence: number): string => {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const seq = String(sequence).padStart(4, '0')
  return `DH${yy}${mm}${dd}S${seq}`
}

/**
 * Generate voucher number for transactions
 */
export const generateVoucherNumber = (type: 'INCOME' | 'EXPENSE', date: Date, seq: number): string => {
  const prefix = type === 'INCOME' ? 'PT' : 'PC'
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `${prefix}${dateStr}${String(seq).padStart(4, '0')}`
}
