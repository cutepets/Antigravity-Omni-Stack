/**
 * Format number as Vietnamese currency: 150000 → "150.000 ₫"
 */
export const formatVND = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(amount)

/**
 * Parse Vietnamese currency string to number: "150.000" → 150000
 */
export const parseCurrency = (str: string): number =>
  Number(str.replace(/[^\d-]/g, '')) || 0
