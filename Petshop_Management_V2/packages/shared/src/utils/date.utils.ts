/**
 * Format date to Vietnamese display format: dd/MM/yyyy HH:mm
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d)
}

/**
 * Format date only: dd/MM/yyyy
 */
export const formatDateOnly = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d)
}

/**
 * Get ms until midnight (for daily job scheduling)
 */
export const msUntilMidnight = (): number => {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}

/**
 * Calculate difference in days between two dates
 */
export const diffDays = (from: Date, to: Date): number => {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay)
}
