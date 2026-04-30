import dayjs from 'dayjs'

export function normalizeShiftTime(value?: string | null, fallback = '') {
  if (!value) return fallback

  const timeMatch = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/)
  if (timeMatch) {
    return `${timeMatch[1]!.padStart(2, '0')}:${timeMatch[2]}`
  }

  const parsed = dayjs(value)
  if (parsed.isValid()) return parsed.format('HH:mm')

  return fallback
}

export function formatShiftTimeRange(start?: string | null, end?: string | null) {
  return `${normalizeShiftTime(start, '08:00')} → ${normalizeShiftTime(end, '17:00')}`
}
