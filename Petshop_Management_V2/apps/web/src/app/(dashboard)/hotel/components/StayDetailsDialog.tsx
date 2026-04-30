'use client'

import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ClipboardList,
  HeartPulse,
  LogIn,
  LogOut,
  MessageCircle,
  Pencil,
  PawPrint,
  Printer,
  Save,
  type LucideIcon,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuthorization } from '@/hooks/useAuthorization'
import { hotelApi, type HotelStay, type HotelStayHealthLog, type HotelStayOrderItem, type UpdateHotelStayDto } from '@/lib/api/hotel.api'
import { settingsApi } from '@/lib/api/settings.api'
import { printHotelStay } from '@/lib/hotel-print'
import { formatCurrency } from '@/lib/utils'
import { confirmDialog } from '@/components/ui/confirmation-provider'

interface ChargeLine {
  id?: string
  label?: string
  quantityDays?: number
  unitPrice?: number
  subtotal?: number
}

interface DisplayPriceLine {
  id?: string
  label: string
  quantityDays: number
  unitPrice: number
  discount: number
  subtotal: number
}

interface BreakdownSnapshot {
  chargeLines?: ChargeLine[]
  totalDays?: number
}

interface StayDetailsDialogProps {
  stay?: HotelStay | null
  actionSlotIndex?: number | null
  isOpen: boolean
  onClose: () => void
}

type ActivityEntry = {
  id: string
  action?: string | null
  createdAt?: string | null
  note?: string | null
  fromStatus?: string | null
  toStatus?: string | null
  details?: Record<string, unknown> | null
  user?: { fullName?: string | null; staffCode?: string | null } | null
  performedByUser?: { fullName?: string | null; staffCode?: string | null } | null
}

type NoteDraft = {
  notes: string
  petNotes: string
  accessories: string
}

type HealthDraft = {
  content: string
}

type CareLogEntry = {
  id: string
  content: string
  createdAt?: string | null
  actor: string
}

type StayDateDraft = {
  scheduledCheckIn: string
  estimatedCheckOut: string
  checkedInAt: string
  checkOutActual: string
}

const EMPTY_NOTE_DRAFT: NoteDraft = {
  notes: '',
  petNotes: '',
  accessories: '',
}

const EMPTY_HEALTH_DRAFT: HealthDraft = {
  content: '',
}

const EMPTY_STAY_DATE_DRAFT: StayDateDraft = {
  scheduledCheckIn: '',
  estimatedCheckOut: '',
  checkedInAt: '',
  checkOutActual: '',
}

const HOTEL_STATUS_META: Record<string, { label: string; className: string; dotClassName: string }> = {
  BOOKED: {
    label: 'Đã đặt',
    className: 'border-blue-500/20 bg-blue-500/10 text-blue-600',
    dotClassName: 'bg-blue-500',
  },
  CHECKED_IN: {
    label: 'Đang ở',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
    dotClassName: 'bg-amber-500',
  },
  CHECKED_OUT: {
    label: 'Đã trả',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
    dotClassName: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Đã hủy',
    className: 'border-error/20 bg-error/10 text-error',
    dotClassName: 'bg-error',
  },
}

const PAYMENT_STATUS_META: Record<string, { label: string; className: string }> = {
  UNPAID: { label: 'Chưa thanh toán', className: 'border-rose-500/20 bg-rose-500/10 text-rose-600' },
  PARTIAL: { label: 'Thanh toán một phần', className: 'border-amber-500/20 bg-amber-500/10 text-amber-600' },
  PAID: { label: 'Đã thanh toán', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' },
  COMPLETED: { label: 'Hoàn tất', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' },
}

const ACTIVITY_LABELS: Record<string, string> = {
  HOTEL_STAY_CREATED: 'Tạo lưu trú',
  HOTEL_STAY_UPDATED: 'Cập nhật lưu trú',
  HOTEL_STAY_CHECKED_IN: 'Nhận phòng',
  HOTEL_STAY_CHECKED_OUT: 'Trả phòng',
  HOTEL_STAY_CANCELLED: 'Hủy lưu trú',
  HOTEL_STAY_HEALTH_LOG_CREATED: 'Ghi nhận sức khỏe',
  HOTEL_STAY_NOTE_CREATED: 'Cập nhật ghi chú & sức khỏe',
}

function getBreakdownChargeLines(stay: { chargeLines?: ChargeLine[]; breakdownSnapshot?: BreakdownSnapshot | null }): ChargeLine[] {
  if (Array.isArray(stay?.chargeLines) && stay.chargeLines.length > 0) {
    return stay.chargeLines
  }

  const snapshot = stay?.breakdownSnapshot
  return Array.isArray(snapshot?.chargeLines) ? snapshot.chargeLines : []
}

function getStayOrderItems(stay: HotelStay | null): HotelStayOrderItem[] {
  return Array.isArray(stay?.orderItems) ? stay.orderItems : []
}

function getDisplayPriceLines(stay: HotelStay | null): DisplayPriceLine[] {
  if (!stay) return []

  // Prefer chargeLines — they have accurate quantityDays and per-day unitPrice.
  // orderItems from POS store quantity=1 and unitPrice=line total, which is wrong for display.
  const chargeLines = getBreakdownChargeLines(stay)
  if (chargeLines.length > 0) {
    return chargeLines.map((line, index) => ({
      id: line.id ?? `${line.label ?? 'hotel'}-${index}`,
      label: String(line.label ?? 'Hotel'),
      quantityDays: Number(line.quantityDays ?? 0),
      unitPrice: Number(line.unitPrice ?? 0),
      discount: 0,
      subtotal: Number(line.subtotal ?? 0),
    }))
  }

  // Fallback to orderItems only when no chargeLines exist
  const orderItems = getStayOrderItems(stay)
  if (orderItems.length > 0) {
    return orderItems.map((item) => ({
      id: item.id,
      label: item.description || 'Hotel',
      quantityDays: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      discount: Number(item.discountItem ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    }))
  }

  return []
}

function getSnapshotNumber(source: BreakdownSnapshot | null | undefined, key: keyof BreakdownSnapshot): number | null {
  if (!source) return null

  const value = source[key]
  return typeof value === 'number' ? value : null
}

function toMoney(value: number | null | undefined) {
  return formatCurrency(Number(value ?? 0))
}

function normalizeZaloPhone(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('84')) return digits
  if (digits.startsWith('0')) return `84${digits.slice(1)}`
  return digits
}

function formatStayDate(value?: string | null) {
  if (!value) return '---'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '---'

  return format(date, 'dd/MM/yyyy HH:mm')
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function fromDateTimeLocalValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function getStatusLabel(status?: string | null) {
  if (!status) return '---'
  return HOTEL_STATUS_META[status]?.label ?? status
}

function getPaymentStatusLabel(status?: string | null) {
  if (!status) return '---'
  return PAYMENT_STATUS_META[status]?.label ?? status
}

function getCareModeLabel(stay: HotelStay | null) {
  return stay ? 'Lưu trú' : '---'
}

function getActionLabel(action?: string | null) {
  if (!action) return 'Thao tác'
  return ACTIVITY_LABELS[action] ?? action
}

function buildHistorySummary(entry: ActivityEntry) {
  const actorName =
    entry.user?.fullName ??
    entry.user?.staffCode ??
    entry.performedByUser?.fullName ??
    entry.performedByUser?.staffCode ??
    'Chưa xác định'
  const statusLabel =
    entry.fromStatus || entry.toStatus
      ? [
        entry.fromStatus ? getStatusLabel(entry.fromStatus) : null,
        entry.toStatus ? `→ ${getStatusLabel(entry.toStatus)}` : null,
      ]
        .filter(Boolean)
        .join(' ')
      : null
  const details = entry.details ?? null
  const detailSummary = details
    ? [
      typeof details.previousStatus === 'string' ? getStatusLabel(details.previousStatus) : null,
      typeof details.nextStatus === 'string' ? `→ ${getStatusLabel(details.nextStatus)}` : null,
      typeof details.totalPrice === 'number' ? `Tổng ${toMoney(details.totalPrice)}` : null,
      typeof details.note === 'string' ? details.note : null,
    ]
      .filter(Boolean)
      .join(' • ')
    : null

  return [actorName, statusLabel, entry.note, detailSummary].filter(Boolean).join(' • ')
}

function getFallbackTimeline(stay: HotelStay | null): ActivityEntry[] {
  const timeline = (stay as (HotelStay & { timeline?: ActivityEntry[] }) | null)?.timeline
  return Array.isArray(timeline) ? timeline : []
}

function autoResizeTextArea(element: HTMLTextAreaElement) {
  element.style.height = 'auto'
  element.style.height = `${Math.max(40, element.scrollHeight)}px`
}

function getActivityActor(entry: ActivityEntry) {
  return (
    entry.user?.fullName ??
    entry.user?.staffCode ??
    entry.performedByUser?.fullName ??
    entry.performedByUser?.staffCode ??
    'Nhân viên'
  )
}

function getStayCareEntries(stay: HotelStay | null, healthLogs: HotelStayHealthLog[], fallbackNote: string): CareLogEntry[] {
  if (!stay) return []

  const timeline = getFallbackTimeline(stay)
  const noteEntries: CareLogEntry[] = timeline
    .filter((entry) => {
      const action = String(entry.action ?? '').toLowerCase()
      return Boolean(entry.note?.trim()) && (action.includes('ghi chú') || action.includes('ghi chu') || action.includes('note'))
    })
    .map((entry) => ({
      id: entry.id,
      content: entry.note?.trim() ?? '',
      createdAt: entry.createdAt,
      actor: getActivityActor(entry),
    }))

  const healthEntries: CareLogEntry[] = healthLogs.map((log) => ({
    id: log.id,
    content: log.content,
    createdAt: log.createdAt,
    actor: log.performedByUser?.fullName ?? log.performedByUser?.staffCode ?? 'Nhân viên',
  }))

  const entries = [...noteEntries, ...healthEntries].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bTime - aTime
  })

  if (entries.length > 0) return entries
  if (!fallbackNote.trim()) return []

  return [{
    id: `${stay.id}-current-note`,
    content: fallbackNote,
    createdAt: stay.updatedAt ?? stay.createdAt,
    actor: stay.createdBy?.fullName ?? stay.createdBy?.staffCode ?? 'Nhân viên',
  }]
}

function getActualCheckIn(stay: HotelStay | null) {
  if (!stay || stay.status === 'BOOKED') return null
  return stay.checkedInAt ?? stay.checkIn ?? null
}

function getActualCheckOut(stay: HotelStay | null) {
  if (!stay || stay.status !== 'CHECKED_OUT') return null
  return stay.checkOutActual ?? stay.checkOut ?? null
}

function getStayDateDraft(stay: HotelStay | null): StayDateDraft {
  if (!stay) return EMPTY_STAY_DATE_DRAFT

  return {
    scheduledCheckIn: toDateTimeLocalValue(stay.checkIn),
    estimatedCheckOut: toDateTimeLocalValue(stay.estimatedCheckOut),
    checkedInAt: toDateTimeLocalValue(getActualCheckIn(stay)),
    checkOutActual: toDateTimeLocalValue(getActualCheckOut(stay)),
  }
}

function getStayDateSource(stay: HotelStay | null, draft = getStayDateDraft(stay)) {
  if (!stay) return ''
  return `${stay.id}:${stay.updatedAt}:${draft.scheduledCheckIn}:${draft.estimatedCheckOut}:${draft.checkedInAt}:${draft.checkOutActual}`
}

function buildStayDatePayload(stay: HotelStay, draft: StayDateDraft): UpdateHotelStayDto {
  const payload: UpdateHotelStayDto = {}
  const scheduledCheckIn = fromDateTimeLocalValue(draft.scheduledCheckIn)
  const estimatedCheckOut = fromDateTimeLocalValue(draft.estimatedCheckOut)
  const checkedInAt = fromDateTimeLocalValue(draft.checkedInAt)
  const checkOutActual = fromDateTimeLocalValue(draft.checkOutActual)

  if (scheduledCheckIn) payload.checkIn = scheduledCheckIn
  if (estimatedCheckOut) payload.estimatedCheckOut = estimatedCheckOut

  if (stay.status !== 'BOOKED' && checkedInAt) {
    payload.checkedInAt = checkedInAt
  }

  if (stay.status === 'CHECKED_OUT' && checkOutActual) {
    payload.checkOutActual = checkOutActual
  }

  return payload
}

function HotelStatusBadge({ status }: { status?: string | null }) {
  const meta = status ? HOTEL_STATUS_META[status] : null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta?.className ?? 'border-border bg-background-secondary text-foreground-muted'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta?.dotClassName ?? 'bg-foreground-muted'}`} />
      {getStatusLabel(status)}
    </span>
  )
}

function PaymentStatusBadge({ status }: { status?: string | null }) {
  const meta = status ? PAYMENT_STATUS_META[status] : null

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta?.className ?? 'border-border bg-background-secondary text-foreground-muted'}`}
    >
      {getPaymentStatusLabel(status)}
    </span>
  )
}

function CareModeBadge({ stay }: { stay: HotelStay | null }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-border bg-background-secondary px-2.5 py-1 text-xs font-semibold text-foreground-muted"
    >
      {getCareModeLabel(stay)}
    </span>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
      <Icon size={14} />
      {title}
    </div>
  )
}

function InfoPanel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card/80 p-4 ${className}`}>
      {children}
    </section>
  )
}

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background-secondary/60 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</div>
      <div className={`mt-1 text-sm font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value || '---'}</div>
    </div>
  )
}

function InlineInfoLine({
  label,
  value,
  action,
}: {
  label: string
  value: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="min-w-0 text-foreground-muted">
        <span className="font-semibold text-foreground-muted">{label}: </span>
        <span className="font-semibold text-foreground">{value || '---'}</span>
      </p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function PhoneLine({ label, phone }: { label: string; phone?: string | null }) {
  const zaloPhone = normalizeZaloPhone(phone)

  return (
    <p className="mt-1 flex items-center gap-2 text-sm text-foreground-muted">
      <span>{label}:</span>
      <span className="font-medium text-foreground">{phone || 'Không có SĐT'}</span>
      {zaloPhone ? (
        <a
          href={`https://zalo.me/${zaloPhone}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Mở Zalo ${phone}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-500 transition-colors hover:bg-primary-500/15"
        >
          <MessageCircle size={13} />
        </a>
      ) : null}
    </p>
  )
}

function CareLogList({
  entries,
  isLoading,
}: {
  entries: CareLogEntry[]
  isLoading?: boolean
}) {
  if (isLoading) {
    return <div className="rounded-xl border border-border/60 px-4 py-5 text-center text-sm text-foreground-muted">Đang tải ghi chú & sức khỏe...</div>
  }

  if (!entries.length) {
    return <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-foreground-muted">Chưa có ghi chú hoặc cập nhật sức khỏe.</div>
  }

  return (
    <div className="rounded-xl border border-border/60">
      <div className="grid grid-cols-[1fr_120px_130px] gap-3 border-b border-border/60 bg-background-secondary/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">
        <div>Nội dung</div>
        <div>NV cập nhật</div>
        <div>Thời gian</div>
      </div>
      <div className="divide-y divide-border/60">
        {entries.map((entry) => (
          <div key={entry.id} className="grid grid-cols-[1fr_120px_130px] gap-3 px-4 py-3 text-sm">
            <div className="whitespace-pre-wrap leading-6 text-foreground">{entry.content}</div>
            <div className="min-w-0 truncate font-medium text-foreground">{entry.actor}</div>
            <div className="text-foreground-muted">{formatStayDate(entry.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HistorySection({
  activities,
  isLoading,
}: {
  activities: ActivityEntry[]
  isLoading?: boolean
}) {
  return (
    <div className="custom-scrollbar space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
      <InfoPanel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <SectionTitle icon={ClipboardList} title="Lịch sử thao tác" />
          {isLoading ? <span className="text-xs text-foreground-muted">Đang tải...</span> : null}
        </div>

        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-[16px_1fr] gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary-500 ring-4 ring-primary-500/10" />
                  {index < activities.length - 1 ? <span className="mt-2 h-full w-px bg-border/60" /> : null}
                </div>
                <div className="rounded-xl border border-border/40 bg-background-base px-3.5 py-3 transition-colors duration-150 hover:bg-primary-500/4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-primary-400">
                      {getActionLabel(entry.action)}
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-[11px] text-foreground-muted">
                      {formatStayDate(entry.createdAt)}
                    </div>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-muted">
                    {buildHistorySummary(entry) || 'Không có thêm thông tin'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-foreground-muted">
            Chưa có lịch sử thao tác cho lưu trú này.
          </div>
        )}
      </InfoPanel>
    </div>
  )
}

export default function StayDetailsDialog({
  stay: currentStay,
  actionSlotIndex,
  isOpen,
  onClose,
}: StayDetailsDialogProps) {
  const queryClient = useQueryClient()
  const { hasPermission, hasAnyPermission, hasRole } = useAuthorization()
  const canCheckout = hasPermission('hotel.checkout')
  const canCheckIn = hasAnyPermission(['hotel.create', 'hotel.checkin'])
  const canCancel = hasPermission('hotel.cancel')
  const canUpdateHotel = hasPermission('hotel.update')
  const canReadOrders = hasAnyPermission(['order.read.all', 'order.read.assigned'])
  const stayId = currentStay?.id
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(EMPTY_NOTE_DRAFT)
  const [noteDraftSource, setNoteDraftSource] = useState('')
  const [careDraft, setCareDraft] = useState<HealthDraft>(EMPTY_HEALTH_DRAFT)
  const [dateDraft, setDateDraft] = useState<StayDateDraft>(EMPTY_STAY_DATE_DRAFT)
  const [dateDraftSource, setDateDraftSource] = useState('')
  const [isEditingStayDates, setIsEditingStayDates] = useState(false)
  const [isEditingAccessories, setIsEditingAccessories] = useState(false)
  const [isAddingCareLog, setIsAddingCareLog] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['hotel-stay', stayId],
    queryFn: () => hotelApi.getStay(stayId as string),
    enabled: isOpen && Boolean(stayId),
    retry: false,
    placeholderData: currentStay ?? undefined,
  })

  const timelineQuery = useQuery({
    queryKey: ['hotel-stay-timeline', stayId],
    queryFn: () => hotelApi.getStayTimeline(stayId as string),
    enabled: isOpen && Boolean(stayId),
    retry: false,
  })

  const healthLogsQuery = useQuery({
    queryKey: ['hotel-stay-health-logs', stayId],
    queryFn: () => hotelApi.getStayHealthLogs(stayId as string),
    enabled: isOpen && Boolean(stayId),
    retry: false,
  })

  const printTemplateQuery = useQuery({
    queryKey: ['settings.print-templates', 'hotel_receipt_k80'],
    queryFn: () => settingsApi.getPrintTemplateByType('hotel_receipt_k80'),
    enabled: isOpen && Boolean(stayId),
    retry: false,
  })

  const printConfigQuery = useQuery({
    queryKey: ['settings', 'configs', 'print-shop'],
    queryFn: () => settingsApi.getConfigs(['shopName', 'shopAddress', 'shopPhone']),
    enabled: isOpen && Boolean(stayId),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const stay = detailQuery.data ?? currentStay ?? null
  const currentPricingSpecies = stay?.pet?.species
  const currentPricingWeight = stay?.pet?.weight ?? stay?.weightAtBooking
  const canFetchCurrentPreview =
    isOpen &&
    stay?.status === 'CHECKED_IN' &&
    Boolean(stay.checkIn && currentPricingSpecies && Number(currentPricingWeight) > 0)
  const currentPriceQuery = useQuery({
    queryKey: [
      'hotel-current-price',
      stay?.id,
      stay?.checkIn,
      currentPricingSpecies,
      currentPricingWeight,
      stay?.branchId,
      stay?.rateTableId,
    ],
    queryFn: () =>
      hotelApi.calculatePrice({
        checkIn: stay?.checkIn as string,
        checkOut: new Date().toISOString(),
        species: currentPricingSpecies as string,
        weight: Number(currentPricingWeight),
        ...(stay?.branchId ? { branchId: stay.branchId } : {}),
        ...(stay?.rateTableId ? { rateTableId: stay.rateTableId } : {}),
      }),
    enabled: canFetchCurrentPreview,
    retry: false,
    refetchInterval: canFetchCurrentPreview ? 60_000 : false,
  })
  const priceLines = getDisplayPriceLines(stay)
  const snapshotTotalDays = stay
    ? getSnapshotNumber(stay.breakdownSnapshot as BreakdownSnapshot | null, 'totalDays')
    : null
  const totalDays =
    snapshotTotalDays ??
    priceLines.reduce((sum: number, line: DisplayPriceLine) => sum + Number(line.quantityDays ?? 0), 0)
  const customer = stay?.customer ?? stay?.pet?.customer ?? stay?.receiver ?? null
  const primaryPhone = customer?.phone ?? null
  // Prioritize stay-level secondaryPhone (stored directly on hotel stay)
  const staySecondaryPhone = stay?.secondaryPhone ?? null
  const rawCustomerSecondaryPhone =
    customer && 'representativePhone' in customer ? customer.representativePhone : null
  const customerSecondaryPhone = typeof rawCustomerSecondaryPhone === 'string' ? rawCustomerSecondaryPhone : null
  const secondaryPhone =
    staySecondaryPhone
      ? staySecondaryPhone
      : customerSecondaryPhone && customerSecondaryPhone !== primaryPhone
        ? customerSecondaryPhone
        : stay?.receiver?.phone && stay.receiver.phone !== primaryPhone
          ? stay.receiver.phone
          : null

  // Inline edit state for secondary phone
  const [isEditingSecondaryPhone, setIsEditingSecondaryPhone] = useState(false)
  const [secondaryPhoneDraft, setSecondaryPhoneDraft] = useState(secondaryPhone ?? '')
  const secondaryPhoneInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditingSecondaryPhone) {
      setSecondaryPhoneDraft(secondaryPhone ?? '')
    }
  }, [secondaryPhone, isEditingSecondaryPhone])

  useEffect(() => {
    if (isEditingSecondaryPhone && secondaryPhoneInputRef.current) {
      secondaryPhoneInputRef.current.focus()
    }
  }, [isEditingSecondaryPhone])

  const saveSecondaryPhoneMutation = useMutation({
    mutationFn: (phone: string) =>
      hotelApi.updateStay(stay?.id as string, {
        secondaryPhone: phone.trim() || '',
      }),
    onSuccess: (updatedStay) => {
      setIsEditingSecondaryPhone(false)
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay', updatedStay.id] })
      toast.success('Đã lưu SĐT phụ')
    },
    onError: () => {
      toast.error('Không lưu được SĐT phụ')
    },
  })

  const handleSaveSecondaryPhone = useCallback(() => {
    if (!stay?.id) return
    saveSecondaryPhoneMutation.mutate(secondaryPhoneDraft)
  }, [stay?.id, secondaryPhoneDraft, saveSecondaryPhoneMutation])
  const petName = stay?.petName || stay?.pet?.name || 'Chi tiết lưu trú'
  const petCode = stay?.pet?.petCode || stay?.pet?.id || stay?.petId || '---'
  const petDescription = [stay?.pet?.breed, stay?.pet?.species].filter(Boolean).join(' • ')
  const paymentStatus = stay?.order?.paymentStatus ?? stay?.paymentStatus
  const activities = timelineQuery.data?.activities ?? getFallbackTimeline(stay)
  const customerId = customer?.id ?? stay?.customerId ?? stay?.pet?.customer?.id
  const petId = stay?.pet?.id ?? stay?.petId
  const actualCheckIn = getActualCheckIn(stay)
  const actualCheckOut = getActualCheckOut(stay)
  const currentDateDraft = getStayDateDraft(stay)
  const dateSource = getStayDateSource(stay, currentDateDraft)
  const stayDatesChanged = Boolean(stay) && (
    dateDraft.scheduledCheckIn !== currentDateDraft.scheduledCheckIn ||
    dateDraft.estimatedCheckOut !== currentDateDraft.estimatedCheckOut ||
    dateDraft.checkedInAt !== currentDateDraft.checkedInAt ||
    dateDraft.checkOutActual !== currentDateDraft.checkOutActual
  )
  const canEditStayDates = Boolean(stay) && canUpdateHotel && hasRole(['SUPER_ADMIN', 'ADMIN']) && stay?.status !== 'CANCELLED'
  const canShowCheckIn = stay?.status === 'BOOKED' && actionSlotIndex != null
  const canShowCancel = stay ? !['CHECKED_OUT', 'CANCELLED'].includes(stay.status) : false
  const displayTotalDays = stay?.status === 'CHECKED_IN' && currentPriceQuery.data
    ? currentPriceQuery.data.totalDays
    : totalDays
  const accessoryText = stay?.accessories ?? ''
  const careEntries = getStayCareEntries(stay, healthLogsQuery.data ?? [], stay?.notes ?? '')
  const noteSource = stay ? `${stay.id}:${stay.updatedAt}:${accessoryText}` : ''
  const notesChanged = Boolean(stay) && (
    noteDraft.accessories !== accessoryText
  )

  useEffect(() => {
    if (!stay || noteDraftSource === noteSource || (noteDraftSource && notesChanged)) return

    setNoteDraft({
      notes: '',
      petNotes: '',
      accessories: accessoryText,
    })
    setNoteDraftSource(noteSource)
  }, [accessoryText, noteDraftSource, noteSource, notesChanged, stay])

  useEffect(() => {
    if (!stay || dateDraftSource === dateSource || (dateDraftSource && stayDatesChanged)) return

    setDateDraft(currentDateDraft)
    setDateDraftSource(dateSource)
  }, [currentDateDraft, dateDraftSource, dateSource, stay, stayDatesChanged])

  const saveAccessoriesMutation = useMutation({
    mutationFn: () =>
      hotelApi.updateStay(stay?.id as string, {
        accessories: noteDraft.accessories,
      }),
    onSuccess: (updatedStay) => {
      setNoteDraft({
        notes: '',
        petNotes: '',
        accessories: updatedStay.accessories ?? '',
      })
      setNoteDraftSource(`${updatedStay.id}:${updatedStay.updatedAt}:${updatedStay.accessories ?? ''}`)
      setIsEditingAccessories(false)
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay', updatedStay.id] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-timeline', updatedStay.id] })
      toast.success('Đã lưu đồ đi kèm')
    },
    onError: () => {
      toast.error('Không lưu được đồ đi kèm')
    },
  })

  const saveStayDatesMutation = useMutation({
    mutationFn: () => {
      if (!stay) throw new Error('Không tìm thấy lưu trú')
      return hotelApi.updateStay(stay.id, buildStayDatePayload(stay, dateDraft))
    },
    onSuccess: (updatedStay) => {
      const nextDateDraft = getStayDateDraft(updatedStay)
      setDateDraft(nextDateDraft)
      setDateDraftSource(getStayDateSource(updatedStay, nextDateDraft))
      setIsEditingStayDates(false)
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay', updatedStay.id] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-timeline', updatedStay.id] })
      toast.success('Đã lưu mốc thời gian lưu trú')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu mốc thời gian')
    },
  })

  const createStayNoteMutation = useMutation({
    mutationFn: () =>
      hotelApi.createStayNote(stay?.id as string, {
        content: careDraft.content.trim(),
      }),
    onSuccess: () => {
      setCareDraft(EMPTY_HEALTH_DRAFT)
      setIsAddingCareLog(false)
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay', stay?.id] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-health-logs', stay?.id] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-timeline', stay?.id] })
      toast.success('Đã lưu ghi chú & sức khỏe')
    },
    onError: () => {
      toast.error('Không lưu được ghi chú & sức khỏe')
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: (nextStayId: string) =>
      hotelApi.checkoutStay(nextStayId, {
        checkOutActual: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-timeline'] })
      onClose()
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (nextStayId: string) =>
      hotelApi.updateStay(nextStayId, {
        status: 'CANCELLED',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-timeline'] })
      onClose()
    },
  })

  const checkinMutation = useMutation({
    mutationFn: (nextStayId: string) =>
      hotelApi.updateStay(nextStayId, {
        status: 'CHECKED_IN',
        slotIndex: actionSlotIndex ?? stay?.slotIndex ?? currentStay?.slotIndex ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cages'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-timeline'] })
      onClose()
    },
  })

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 app-modal-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-2xl border border-border bg-background-base shadow-xl duration-200 sm:max-h-[85vh]">
          <Tabs.Root defaultValue="info" className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <Dialog.Title className="min-w-0 truncate text-xl font-bold text-foreground">
                    {petName}
                  </Dialog.Title>
                  <HotelStatusBadge status={stay?.status} />
                  <CareModeBadge stay={stay} />
                  <span className="rounded-full border border-border bg-background-secondary px-2 py-1 font-mono text-[11px] text-foreground-muted">
                    {stay?.stayCode || (stay?.id ? `#${stay.id.slice(-6).toUpperCase()}` : '---')}
                  </span>
                </div>
                <Dialog.Description className="text-sm text-foreground-muted">
                  {petDescription || `Mã thú cưng: ${petCode}`}
                </Dialog.Description>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {stay ? (
                  <Tabs.List className="flex items-center gap-1 rounded-xl bg-background-secondary/50 p-1">
                    <Tabs.Trigger
                      value="info"
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted outline-none transition-all duration-150 hover:text-foreground data-[state=active]:bg-background-base data-[state=active]:text-primary-600 data-[state=active]:shadow-sm"
                    >
                      Thông tin
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="history"
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted outline-none transition-all duration-150 hover:text-foreground data-[state=active]:bg-background-base data-[state=active]:text-primary-600 data-[state=active]:shadow-sm"
                    >
                      Lịch sử
                    </Tabs.Trigger>
                  </Tabs.List>
                ) : null}
                {canEditStayDates ? (
                  isEditingStayDates ? (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          setDateDraft(currentDateDraft)
                          setIsEditingStayDates(false)
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background-secondary px-3 text-sm font-medium text-foreground-muted transition-all duration-150 hover:bg-background-tertiary hover:text-foreground active:scale-[0.98]"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => saveStayDatesMutation.mutate()}
                        disabled={!stayDatesChanged || saveStayDatesMutation.isPending}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-500 px-3 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Save size={14} />
                        {saveStayDatesMutation.isPending ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setDateDraft(currentDateDraft)
                        setIsEditingStayDates(true)
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-primary-500/30 bg-primary-500/10 px-3 text-sm font-medium text-primary-500 transition-all duration-150 hover:bg-primary-500/15 active:scale-[0.98]"
                    >
                      Sửa
                    </button>
                  )
                ) : null}
                {stay ? (
                  <button
                    type="button"
                    title="In phiếu hotel"
                    onClick={() =>
                      printHotelStay(
                        {
                          stay,
                          shopName: printConfigQuery.data?.shopName,
                          shopAddress: printConfigQuery.data?.shopAddress,
                          shopPhone: printConfigQuery.data?.shopPhone,
                          branchName: stay.branch?.name,
                        },
                        printTemplateQuery.data ?? null,
                      )
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background-secondary text-foreground-muted transition-all duration-150 hover:border-primary-500/40 hover:bg-primary-500/10 hover:text-primary-500 active:scale-95"
                  >
                    <Printer size={18} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background-secondary text-foreground-muted transition-all duration-150 hover:bg-background-tertiary hover:text-foreground active:scale-95"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {!stay ? (
              <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-medium text-foreground">Không tìm thấy dữ liệu</p>
                <p className="mt-1 text-xs text-foreground-muted">Có thể đã xảy ra lỗi đồng bộ.</p>
              </div>
            ) : (
              <>
                <Tabs.Content value="info" className="min-h-0 flex-1 overflow-y-auto outline-none">
                  <div className="custom-scrollbar space-y-5 px-4 py-5 sm:px-6">
                    {detailQuery.isFetching ? (
                      <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 px-4 py-2 text-xs text-primary-500">
                        Đang đồng bộ dữ liệu chi tiết mới nhất...
                      </div>
                    ) : null}

                    <section className="grid gap-3 lg:grid-cols-3">
                      <InfoPanel className="relative group min-h-[126px] space-y-2">
                        <InlineInfoLine
                          label="Khách hàng"
                          value={customer?.fullName || 'Khách lẻ (Khách vãng lai)'}
                          action={customerId ? (
                            <Link href={`/customers/${customerId}`} className="text-xs font-medium text-primary-500 hover:text-primary-400">
                              Chi tiết
                            </Link>
                          ) : null}
                        />
                        <PhoneLine label="SĐT chính" phone={primaryPhone} />
                        <div className="flex items-center justify-between gap-2">
                          {isEditingSecondaryPhone ? (
                            <div className="flex flex-1 items-center gap-1.5">
                              <span className="shrink-0 text-xs text-foreground-muted">SĐT phụ:</span>
                              <input
                                ref={secondaryPhoneInputRef}
                                type="tel"
                                value={secondaryPhoneDraft}
                                onChange={(e) => setSecondaryPhoneDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveSecondaryPhone()
                                  if (e.key === 'Escape') setIsEditingSecondaryPhone(false)
                                }}
                                placeholder="Nhập SĐT phụ..."
                                maxLength={11}
                                className="h-7 w-28 rounded-lg border border-primary-500/40 bg-background-base px-2 text-sm text-foreground outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
                              />
                              <button
                                type="button"
                                onClick={handleSaveSecondaryPhone}
                                disabled={saveSecondaryPhoneMutation.isPending}
                                className="shrink-0 inline-flex h-7 items-center gap-1 rounded-lg bg-primary-500 px-2.5 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                              >
                                <Save size={11} />
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingSecondaryPhone(false)}
                                className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 text-foreground-muted transition-colors hover:bg-background-secondary"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <PhoneLine label="SĐT phụ" phone={secondaryPhone} />
                              <button
                                type="button"
                                onClick={async () => {
                                  setSecondaryPhoneDraft(secondaryPhone ?? '')
                                  setIsEditingSecondaryPhone(true)
                                }}
                                title="Sửa SĐT phụ"
                                className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border/60 text-foreground-muted transition-colors hover:border-primary-500/40 hover:bg-primary-500/10 hover:text-primary-500"
                              >
                                <Pencil size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </InfoPanel>

                      <InfoPanel className="relative group min-h-[126px] space-y-2">
                        <InlineInfoLine
                          label="Thú cưng"
                          value={petName}
                          action={petId ? (
                            <Link href={`/pets/${petId}`} className="text-xs font-medium text-primary-500 hover:text-primary-400">
                              Chi tiết
                            </Link>
                          ) : null}
                        />
                        <InlineInfoLine label="Mã" value={<span className="font-mono">{petCode}</span>} />
                        <InlineInfoLine label="Hạng cân" value={stay.weightBand?.label || 'Chưa xác định'} />
                      </InfoPanel>

                      <InfoPanel className="min-h-[126px] space-y-2">
                        <InlineInfoLine
                          label="Đơn hàng"
                          value={stay.order ? (
                            canReadOrders ? (
                              <Link href={`/orders/${stay.order.id}`} className="font-mono font-semibold text-primary-500 hover:text-primary-400 hover:underline">
                                {stay.order.orderNumber}
                              </Link>
                            ) : (
                              <span className="font-mono font-semibold">{stay.order.orderNumber}</span>
                            )
                          ) : 'Chưa liên kết đơn POS'}
                          action={<PaymentStatusBadge status={paymentStatus} />}
                        />
                        <InlineInfoLine label="Đã thu" value={toMoney(stay.order?.paidAmount ?? 0)} />
                        <InlineInfoLine label="Tổng đơn" value={toMoney(stay.order?.total ?? 0)} />
                      </InfoPanel>
                    </section>

                    <section className="grid gap-3 sm:grid-cols-4">
                      {isEditingStayDates && canEditStayDates ? (
                        stay.status === 'BOOKED' ? (
                          <label className="rounded-xl border border-border/60 bg-background-secondary/60 px-3 py-2.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Dự kiến nhận</span>
                            <input
                              type="datetime-local"
                              value={dateDraft.scheduledCheckIn}
                              onChange={(event) => setDateDraft((draft) => ({ ...draft, scheduledCheckIn: event.target.value }))}
                              className="mt-1 h-8 w-full rounded-lg border border-border bg-background-base px-2 text-sm font-medium text-foreground outline-none focus:border-primary-500"
                            />
                          </label>
                        ) : (
                          <label className="rounded-xl border border-border/60 bg-background-secondary/60 px-3 py-2.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Check-in thực tế</span>
                            <input
                              type="datetime-local"
                              value={dateDraft.checkedInAt}
                              onChange={(event) => setDateDraft((draft) => ({ ...draft, checkedInAt: event.target.value }))}
                              className="mt-1 h-8 w-full rounded-lg border border-border bg-background-base px-2 text-sm font-medium text-foreground outline-none focus:border-primary-500"
                            />
                          </label>
                        )
                      ) : (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600">
                            <LogIn size={12} />
                            {stay.status === 'BOOKED' ? 'Dự kiến nhận' : 'Check-in'}
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {formatStayDate(stay.status === 'BOOKED' ? stay.checkIn : actualCheckIn) || '---'}
                          </div>
                        </div>
                      )}
                      {isEditingStayDates && canEditStayDates ? (
                        stay.status === 'CHECKED_OUT' ? (
                          <label className="rounded-xl border border-border/60 bg-background-secondary/60 px-3 py-2.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Check-out thực tế</span>
                            <input
                              type="datetime-local"
                              value={dateDraft.checkOutActual}
                              onChange={(event) => setDateDraft((draft) => ({ ...draft, checkOutActual: event.target.value }))}
                              className="mt-1 h-8 w-full rounded-lg border border-border bg-background-base px-2 text-sm font-medium text-foreground outline-none focus:border-primary-500"
                            />
                          </label>
                        ) : (
                          <label className="rounded-xl border border-border/60 bg-background-secondary/60 px-3 py-2.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Dự kiến trả</span>
                            <input
                              type="datetime-local"
                              value={dateDraft.estimatedCheckOut}
                              onChange={(event) => setDateDraft((draft) => ({ ...draft, estimatedCheckOut: event.target.value }))}
                              className="mt-1 h-8 w-full rounded-lg border border-border bg-background-base px-2 text-sm font-medium text-foreground outline-none focus:border-primary-500"
                            />
                          </label>
                        )
                      ) : (
                        <div className="rounded-xl border border-border/60 bg-background-secondary/60 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-1">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Dự kiến trả</div>
                            {canEditStayDates ? (
                              <button
                                type="button"
                                title="Sửa dự kiến trả"
                                onClick={async () => {
                                  setDateDraft(currentDateDraft)
                                  setIsEditingStayDates(true)
                                }}
                                className="inline-flex h-5 w-5 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-primary-500/10 hover:text-primary-500"
                              >
                                <Pencil size={11} />
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {formatStayDate(stay.estimatedCheckOut) || '---'}
                          </div>
                        </div>
                      )}
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-600">
                          <LogOut size={12} />
                          Check-out
                        </div>
                        <div className="mt-1 text-sm font-medium text-foreground">
                          {formatStayDate(actualCheckOut) || '---'}
                        </div>
                      </div>
                      <InfoItem label="Số ngày" value={displayTotalDays || 0} />
                    </section>

                    <div>

                      {priceLines.length > 0 ? (
                        <div className="rounded-xl border border-border/60">
                          <div>
                            <div className="grid grid-cols-[1fr_60px_1fr_1fr_1fr] gap-2 border-b border-border/60 bg-background-secondary/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">
                              <div>Tên dịch vụ</div>
                              <div className="text-right">Ngày</div>
                              <div className="text-right">Đơn giá</div>
                              <div className="text-right">Chiết khấu</div>
                              <div className="text-right">Thành tiền</div>
                            </div>
                            <div className="divide-y divide-border/60">
                              {priceLines.map((line, index) => (
                                <div
                                  key={`${line.id ?? line.label}-${index}`}
                                  className="grid grid-cols-[1fr_60px_1fr_1fr_1fr] gap-2 px-4 py-3 text-sm"
                                >
                                  <div className="min-w-0 truncate font-semibold text-foreground">{line.label}</div>
                                  <div className="text-right text-foreground-muted">{line.quantityDays}</div>
                                  <div className="text-right font-medium text-foreground">{toMoney(line.unitPrice)}</div>
                                  <div className="text-right font-medium text-foreground">{toMoney(line.discount)}</div>
                                  <div className="text-right font-semibold text-foreground">{toMoney(line.subtotal)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-foreground-muted">
                          Chưa có dòng tính giá chi tiết.
                        </div>
                      )}
                    </div>

                    <section className="grid gap-4 lg:grid-cols-[230px_1fr]">
                      <InfoPanel>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <SectionTitle icon={PawPrint} title="Đồ đi kèm" />
                          {canUpdateHotel ? (
                            isEditingAccessories ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setNoteDraft((draft) => ({ ...draft, accessories: accessoryText }))
                                    setIsEditingAccessories(false)
                                  }}
                                  className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-background-secondary"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveAccessoriesMutation.mutate()}
                                  disabled={saveAccessoriesMutation.isPending || noteDraft.accessories === accessoryText}
                                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary-500 px-3 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Save size={14} />
                                  {saveAccessoriesMutation.isPending ? 'Đang lưu...' : 'Lưu'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  setNoteDraft((draft) => ({ ...draft, accessories: accessoryText }))
                                  setIsEditingAccessories(true)
                                }}
                                className="inline-flex h-9 items-center rounded-xl border border-primary-500/30 bg-primary-500/10 px-3 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-500/15"
                              >
                                Sửa
                              </button>
                            )
                          ) : null}
                        </div>
                        {isEditingAccessories ? (
                          <textarea
                            value={noteDraft.accessories}
                            onChange={(event) => {
                              setNoteDraft((draft) => ({ ...draft, accessories: event.target.value }))
                              autoResizeTextArea(event.currentTarget)
                            }}
                            rows={1}
                            disabled={!canUpdateHotel}
                            className="min-h-10 w-full resize-none overflow-hidden rounded-xl border border-border bg-background-secondary/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Nhập đồ đi kèm..."
                          />
                        ) : (
                          <div className="min-h-10 whitespace-pre-wrap rounded-xl border border-border/60 bg-background-secondary/40 px-3 py-2 text-sm leading-6 text-foreground">
                            {accessoryText || 'Chưa có đồ đi kèm.'}
                          </div>
                        )}
                      </InfoPanel>

                      <InfoPanel>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <SectionTitle icon={HeartPulse} title="Ghi chú & Sức khỏe" />
                          {canUpdateHotel ? (
                            isAddingCareLog ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setCareDraft(EMPTY_HEALTH_DRAFT)
                                    setIsAddingCareLog(false)
                                  }}
                                  className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-background-secondary"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => createStayNoteMutation.mutate()}
                                  disabled={!careDraft.content.trim() || createStayNoteMutation.isPending}
                                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary-500 px-3 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Save size={14} />
                                  {createStayNoteMutation.isPending ? 'Đang lưu...' : 'Lưu'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  setCareDraft(EMPTY_HEALTH_DRAFT)
                                  setIsAddingCareLog(true)
                                }}
                                className="inline-flex h-9 items-center rounded-xl border border-primary-500/30 bg-primary-500/10 px-3 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-500/15"
                              >
                                Thêm
                              </button>
                            )
                          ) : null}
                        </div>

                        {isAddingCareLog ? (
                          <div className="mb-4">
                            <textarea
                              value={careDraft.content}
                              onChange={(event) => {
                                setCareDraft({ content: event.target.value })
                                autoResizeTextArea(event.currentTarget)
                              }}
                              disabled={!canUpdateHotel}
                              rows={1}
                              className="min-h-10 w-full resize-none overflow-hidden rounded-xl border border-border bg-background-secondary/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                              placeholder="Nhập ghi chú hoặc tình trạng sức khỏe..."
                            />
                          </div>
                        ) : null}

                        <CareLogList entries={careEntries} isLoading={healthLogsQuery.isFetching} />
                      </InfoPanel>
                    </section>
                  </div>
                </Tabs.Content>

                <Tabs.Content value="history" className="min-h-0 flex-1 overflow-y-auto outline-none">
                  <HistorySection
                    activities={activities}
                    isLoading={timelineQuery.isFetching}
                  />
                </Tabs.Content>
              </>
            )}

            <footer className="border-t border-border bg-background-base px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  {stay && canShowCancel ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (await confirmDialog('Bạn có chắc muốn hủy phiếu lưu trú này?')) {
                          cancelMutation.mutate(stay.id)
                        }
                      }}
                      disabled={!canCancel || cancelMutation.isPending}
                      className="inline-flex h-11 min-w-[110px] items-center justify-center rounded-xl px-4 text-sm font-medium text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cancelMutation.isPending ? 'Đang hủy...' : 'Hủy phiếu'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-11 min-w-[100px] items-center justify-center rounded-xl bg-background-secondary px-4 text-sm font-medium text-foreground transition-all duration-150 hover:bg-background-tertiary active:scale-[0.98]"
                  >
                    Đóng
                  </button>
                  {canShowCheckIn ? (
                    <button
                      type="button"
                      onClick={() => checkinMutation.mutate(stay.id)}
                      disabled={!canCheckIn || checkinMutation.isPending}
                      className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-xl bg-primary-500 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {checkinMutation.isPending ? 'Đang xử lý...' : 'Check-in ngay'}
                    </button>
                  ) : stay?.status === 'CHECKED_IN' ? (
                    <button
                      type="button"
                      onClick={() => checkoutMutation.mutate(stay.id)}
                      disabled={!canCheckout || checkoutMutation.isPending}
                      className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-xl bg-primary-500 px-4 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {checkoutMutation.isPending ? 'Đang xử lý...' : 'Checkout ngay'}
                    </button>
                  ) : null}
                </div>
              </div>
            </footer>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
