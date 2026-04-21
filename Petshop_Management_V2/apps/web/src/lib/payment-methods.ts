import type { PaymentMethod, PaymentMethodColorKey, PaymentMethodType } from '@/lib/api/settings.api'

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  CASH: 'Tien mat',
  BANK: 'Chuyen khoan',
  EWALLET: 'Vi dien tu',
  CARD: 'Quet the',
  POINTS: 'Diem tich luy',
}

export const PAYMENT_METHOD_TYPE_OPTIONS: Array<{ value: PaymentMethodType; label: string }> = [
  { value: 'CASH', label: 'Tien mat' },
  { value: 'BANK', label: 'Chuyen khoan' },
  { value: 'EWALLET', label: 'Vi dien tu' },
  { value: 'CARD', label: 'Quet the' },
]

export const PAYMENT_METHOD_COLOR_OPTIONS: Array<{ value: PaymentMethodColorKey; label: string }> = [
  { value: 'emerald', label: 'Xanh la' },
  { value: 'sky', label: 'Xanh duong' },
  { value: 'amber', label: 'Vang cam' },
  { value: 'orange', label: 'Cam' },
  { value: 'violet', label: 'Tim' },
  { value: 'rose', label: 'Hong do' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'slate', label: 'Slate' },
]

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
]

const DEFAULT_PAYMENT_METHOD_COLORS: Record<PaymentMethodType, PaymentMethodColorKey> = {
  CASH: 'emerald',
  BANK: 'sky',
  EWALLET: 'orange',
  CARD: 'violet',
  POINTS: 'amber',
}

const PAYMENT_METHOD_COLOR_CLASS_MAP: Record<
  PaymentMethodColorKey,
  {
    chip: string
    chipSubtle: string
    text: string
    accent: string
    softSurface: string
    iconSurface: string
    ring: string
  }
> = {
  emerald: {
    chip: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    chipSubtle: 'bg-emerald-500/12 text-emerald-300',
    text: 'text-emerald-400',
    accent: 'bg-emerald-500',
    softSurface: 'border-emerald-500/20 bg-emerald-500/8',
    iconSurface: 'bg-emerald-500/12 text-emerald-300',
    ring: 'ring-emerald-300/70',
  },
  sky: {
    chip: 'border-sky-300 bg-sky-50 text-sky-700',
    chipSubtle: 'bg-sky-500/12 text-sky-300',
    text: 'text-sky-400',
    accent: 'bg-sky-500',
    softSurface: 'border-sky-500/20 bg-sky-500/8',
    iconSurface: 'bg-sky-500/12 text-sky-300',
    ring: 'ring-sky-300/70',
  },
  amber: {
    chip: 'border-amber-300 bg-amber-50 text-amber-700',
    chipSubtle: 'bg-amber-500/12 text-amber-300',
    text: 'text-amber-400',
    accent: 'bg-amber-500',
    softSurface: 'border-amber-500/20 bg-amber-500/8',
    iconSurface: 'bg-amber-500/12 text-amber-300',
    ring: 'ring-amber-300/70',
  },
  orange: {
    chip: 'border-orange-300 bg-orange-50 text-orange-700',
    chipSubtle: 'bg-orange-500/12 text-orange-300',
    text: 'text-orange-400',
    accent: 'bg-orange-500',
    softSurface: 'border-orange-500/20 bg-orange-500/8',
    iconSurface: 'bg-orange-500/12 text-orange-300',
    ring: 'ring-orange-300/70',
  },
  violet: {
    chip: 'border-violet-300 bg-violet-50 text-violet-700',
    chipSubtle: 'bg-violet-500/12 text-violet-300',
    text: 'text-violet-400',
    accent: 'bg-violet-500',
    softSurface: 'border-violet-500/20 bg-violet-500/8',
    iconSurface: 'bg-violet-500/12 text-violet-300',
    ring: 'ring-violet-300/70',
  },
  rose: {
    chip: 'border-rose-300 bg-rose-50 text-rose-700',
    chipSubtle: 'bg-rose-500/12 text-rose-300',
    text: 'text-rose-400',
    accent: 'bg-rose-500',
    softSurface: 'border-rose-500/20 bg-rose-500/8',
    iconSurface: 'bg-rose-500/12 text-rose-300',
    ring: 'ring-rose-300/70',
  },
  cyan: {
    chip: 'border-cyan-300 bg-cyan-50 text-cyan-700',
    chipSubtle: 'bg-cyan-500/12 text-cyan-300',
    text: 'text-cyan-400',
    accent: 'bg-cyan-500',
    softSurface: 'border-cyan-500/20 bg-cyan-500/8',
    iconSurface: 'bg-cyan-500/12 text-cyan-300',
    ring: 'ring-cyan-300/70',
  },
  slate: {
    chip: 'border-slate-300 bg-slate-100 text-slate-700',
    chipSubtle: 'bg-slate-500/12 text-slate-300',
    text: 'text-slate-300',
    accent: 'bg-slate-500',
    softSurface: 'border-slate-500/20 bg-slate-500/8',
    iconSurface: 'bg-slate-500/12 text-slate-300',
    ring: 'ring-slate-300/70',
  },
}

export function getPaymentMethodColorKey(type: PaymentMethodType, colorKey?: string | null): PaymentMethodColorKey {
  const normalized = String(colorKey ?? '').trim().toLowerCase() as PaymentMethodColorKey
  if (normalized && normalized in PAYMENT_METHOD_COLOR_CLASS_MAP) {
    return normalized
  }

  return DEFAULT_PAYMENT_METHOD_COLORS[type] ?? 'emerald'
}

export function getPaymentMethodColorClasses(type: PaymentMethodType, colorKey?: string | null) {
  return PAYMENT_METHOD_COLOR_CLASS_MAP[getPaymentMethodColorKey(type, colorKey)]
}

type PaymentMethodVisibilityParams = {
  amount?: number | null
  branchId?: string | null
  now?: Date
  selectedId?: string | null
}

function normalizeTimeValue(value?: string | null) {
  return String(value ?? '').trim()
}

function getMinutesFromTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  return hours * 60 + minutes
}

function matchesTimeWindow(method: PaymentMethod, date: Date) {
  const from = normalizeTimeValue(method.timeFrom)
  const to = normalizeTimeValue(method.timeTo)
  if (!from || !to) return true

  const fromMinutes = getMinutesFromTime(from)
  const toMinutes = getMinutesFromTime(to)
  if (fromMinutes === null || toMinutes === null) return true

  const currentMinutes = date.getHours() * 60 + date.getMinutes()
  if (fromMinutes <= toMinutes) {
    return currentMinutes >= fromMinutes && currentMinutes <= toMinutes
  }

  return currentMinutes >= fromMinutes || currentMinutes <= toMinutes
}

function matchesWeekdays(method: PaymentMethod, date: Date) {
  if (!method.weekdays || method.weekdays.length === 0) return true
  return method.weekdays.includes(date.getDay())
}

function matchesAmount(method: PaymentMethod, amount?: number | null) {
  if (!Number.isFinite(Number(amount))) return true
  const normalizedAmount = Number(amount)
  if (method.minAmount !== null && method.minAmount !== undefined && normalizedAmount < method.minAmount) return false
  if (method.maxAmount !== null && method.maxAmount !== undefined && normalizedAmount > method.maxAmount) return false
  return true
}

function matchesBranch(method: PaymentMethod, branchId?: string | null) {
  if (!method.branchIds || method.branchIds.length === 0) return true
  if (!branchId) return false
  return method.branchIds.includes(branchId)
}

export function isPaymentMethodVisible(method: PaymentMethod, params: PaymentMethodVisibilityParams = {}) {
  if (params.selectedId && method.id === params.selectedId) return true
  if (!method.isActive) return false

  const now = params.now ?? new Date()
  return (
    matchesAmount(method, params.amount) &&
    matchesBranch(method, params.branchId) &&
    matchesWeekdays(method, now) &&
    matchesTimeWindow(method, now)
  )
}

export function filterVisiblePaymentMethods(methods: PaymentMethod[], params: PaymentMethodVisibilityParams = {}) {
  return methods
    .filter((method) => isPaymentMethodVisible(method, params))
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
      return (left.name || '').localeCompare(right.name || '', 'vi')
    })
}

export function summarizePaymentMethodConditions(method: PaymentMethod, branches: Array<{ id: string; name: string }> = []) {
  const parts: string[] = []

  if (method.branchIds.length > 0) {
    const branchLookup = new Map(branches.map((branch) => [branch.id, branch.name]))
    parts.push(
      `CN: ${method.branchIds.map((branchId) => branchLookup.get(branchId) ?? branchId).join(', ')}`,
    )
  }

  if (method.minAmount !== null || method.maxAmount !== null) {
    const min = method.minAmount !== null && method.minAmount !== undefined ? new Intl.NumberFormat('vi-VN').format(method.minAmount) : '0'
    const max = method.maxAmount !== null && method.maxAmount !== undefined ? new Intl.NumberFormat('vi-VN').format(method.maxAmount) : 'khong gioi han'
    parts.push(`Tien: ${min} - ${max}`)
  }

  if (method.timeFrom || method.timeTo) {
    parts.push(`Gio: ${method.timeFrom ?? '--:--'} - ${method.timeTo ?? '--:--'}`)
  }

  if (method.weekdays.length > 0) {
    const weekdayLookup = new Map(WEEKDAY_OPTIONS.map((item) => [item.value, item.label]))
    parts.push(`Ngay: ${method.weekdays.map((day) => weekdayLookup.get(day) ?? String(day)).join(', ')}`)
  }

  return parts
}
