const BRANCH_CODE_RE = /[^A-Z0-9]/g

const removeAccents = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')

export const normalizeBranchCode = (value: string): string =>
  removeAccents(value)
    .toUpperCase()
    .replace(BRANCH_CODE_RE, '')
    .slice(0, 4)

export const suggestBranchCodeFromName = (name: string): string => {
  const sanitized = removeAccents(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (sanitized.length === 0) return ''

  const initials = sanitized
    .map((part) => part.charAt(0))
    .join('')

  const normalizedInitials = normalizeBranchCode(initials)
  if (normalizedInitials.length >= 2) return normalizedInitials

  return normalizeBranchCode(sanitized.join('')).slice(0, 4)
}

export const isValidBranchCode = (value: string): boolean =>
  /^[A-Z0-9]{2,4}$/.test(normalizeBranchCode(value))
