export function formatWeightInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

export function formatCurrencyInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(value))
}

export function formatIntegerInput(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? '' : String(Math.round(value))
}
