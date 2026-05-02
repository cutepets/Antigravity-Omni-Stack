export type ChangeLogEntry = {
  version: string
  date: string
  changes: string[]
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

export function getCurrentAboutVersion(
  changelog: ChangeLogEntry[],
  _metadataVersion?: string | null,
) {
  return changelog[0]?.version ?? 'runtime'
}

export function getRecentChangelog(
  changelog: ChangeLogEntry[],
  _metadataVersion?: string | null,
) {
  return changelog.slice(0, 3)
}

export function formatAboutDate(value?: string | null) {
  if (!value) return '--'

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const localParts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(date)

  const part = (type: string) => localParts.find((item) => item.type === type)?.value ?? '00'
  const hour = part('hour') === '24' ? '00' : part('hour')

  return `${part('day')}/${part('month')}/${part('year')}, ${padDatePart(Number(hour))}:${part('minute')}`
}
