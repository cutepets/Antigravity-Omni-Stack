'use client'

import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  CalendarClock,
  ClipboardList,
  CreditCard,
  HeartPulse,
  MessageCircle,
  PawPrint,
  Printer,
  ReceiptText,
  Save,
  Tag,
  type LucideIcon,
  UserRound,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuthorization } from '@/hooks/useAuthorization'
import { hotelApi, type HotelStay, type HotelStayHealthLog, type HotelStayTimeline } from '@/lib/api/hotel.api'
import { settingsApi } from '@/lib/api/settings.api'
import { printHotelStay } from '@/lib/hotel-print'
import { formatCurrency } from '@/lib/utils'

interface ChargeLine {
  id?: string
  label?: string
  quantityDays?: number
  unitPrice?: number
  subtotal?: number
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
  condition: string
  content: string
  temperature: string
  weight: string
  appetite: string
  stool: string
}

const EMPTY_NOTE_DRAFT: NoteDraft = {
  notes: '',
  petNotes: '',
  accessories: '',
}

const EMPTY_HEALTH_DRAFT: HealthDraft = {
  condition: 'Theo dõi',
  content: '',
  temperature: '',
  weight: '',
  appetite: '',
  stool: '',
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
}

function getBreakdownChargeLines(stay: { chargeLines?: ChargeLine[]; breakdownSnapshot?: BreakdownSnapshot | null }): ChargeLine[] {
  if (Array.isArray(stay?.chargeLines) && stay.chargeLines.length > 0) {
    return stay.chargeLines
  }

  const snapshot = stay?.breakdownSnapshot
  return Array.isArray(snapshot?.chargeLines) ? snapshot.chargeLines : []
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

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const normalized = Number(trimmed.replace(',', '.'))
  return Number.isFinite(normalized) ? normalized : undefined
}

function getCurrentTotal(basePrice?: number | null, surcharge?: number | null, promotion?: number | null) {
  return Number(basePrice ?? 0) + Number(surcharge ?? 0) - Number(promotion ?? 0)
}

function formatStayDate(value?: string | null) {
  if (!value) return '---'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '---'

  return format(date, 'dd/MM/yyyy HH:mm')
}

function formatShortDate(value?: string | null) {
  if (!value) return '---'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '---'

  return format(date, 'dd/MM/yyyy')
}

function getStatusLabel(status?: string | null) {
  if (!status) return '---'
  return HOTEL_STATUS_META[status]?.label ?? status
}

function getPaymentStatusLabel(status?: string | null) {
  if (!status) return '---'
  return PAYMENT_STATUS_META[status]?.label ?? status
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
      typeof details.surcharge === 'number' ? `Phụ thu ${toMoney(details.surcharge)}` : null,
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

function HealthLogList({
  logs,
  isLoading,
}: {
  logs: HotelStayHealthLog[]
  isLoading?: boolean
}) {
  if (isLoading) {
    return <div className="rounded-xl border border-border/60 px-4 py-5 text-center text-sm text-foreground-muted">Đang tải lịch sử sức khỏe...</div>
  }

  if (!logs.length) {
    return <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-foreground-muted">Chưa có ghi nhận sức khỏe cho lượt lưu trú này.</div>
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="rounded-xl border border-border/60 bg-background-secondary/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">{log.condition}</span>
            <span className="text-xs text-foreground-muted">{formatStayDate(log.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{log.content}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground-muted">
            {log.temperature != null ? <span className="rounded-full bg-background-base px-2 py-1">Nhiệt độ {log.temperature}°C</span> : null}
            {log.weight != null ? <span className="rounded-full bg-background-base px-2 py-1">Cân nặng {log.weight}kg</span> : null}
            {log.appetite ? <span className="rounded-full bg-background-base px-2 py-1">Ăn uống: {log.appetite}</span> : null}
            {log.stool ? <span className="rounded-full bg-background-base px-2 py-1">Đi vệ sinh: {log.stool}</span> : null}
            <span className="rounded-full bg-background-base px-2 py-1">
              {log.performedByUser?.fullName ?? log.performedByUser?.staffCode ?? 'Nhân viên'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function HistorySection({
  activities,
  checkpoints,
  isLoading,
}: {
  activities: ActivityEntry[]
  checkpoints?: HotelStayTimeline['checkpoints']
  isLoading?: boolean
}) {
  return (
    <div className="custom-scrollbar space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
      {checkpoints && checkpoints.length > 0 ? (
        <InfoPanel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <SectionTitle icon={CalendarClock} title="Mốc lưu trú" />
            {isLoading ? <span className="text-xs text-foreground-muted">Đang đồng bộ...</span> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            {checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.key}
                className={`rounded-xl border px-3 py-3 ${checkpoint.at
                  ? 'border-primary-500/20 bg-primary-500/5'
                  : 'border-border/60 bg-background-secondary/40'
                  }`}
              >
                <div className="text-xs font-semibold text-foreground">{checkpoint.label}</div>
                <div className="mt-1 text-[11px] leading-4 text-foreground-muted">
                  {formatShortDate(checkpoint.at)}
                </div>
                {checkpoint.user ? (
                  <div className="mt-2 truncate text-[11px] text-foreground-muted">
                    {checkpoint.user.fullName ?? checkpoint.user.staffCode}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </InfoPanel>
      ) : null}

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
  const { hasPermission, hasAnyPermission } = useAuthorization()
  const canCheckout = hasPermission('hotel.checkout')
  const canCheckIn = hasAnyPermission(['hotel.create', 'hotel.checkin'])
  const canCancel = hasPermission('hotel.cancel')
  const canUpdateHotel = hasPermission('hotel.update')
  const canReadOrders = hasAnyPermission(['order.read.all', 'order.read.assigned'])
  const stayId = currentStay?.id
  const [noteDraft, setNoteDraft] = useState<NoteDraft>(EMPTY_NOTE_DRAFT)
  const [noteDraftSource, setNoteDraftSource] = useState('')
  const [healthDraft, setHealthDraft] = useState<HealthDraft>(EMPTY_HEALTH_DRAFT)

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
  const chargeLines = stay ? getBreakdownChargeLines(stay) : []
  const snapshotTotalDays = stay
    ? getSnapshotNumber(stay.breakdownSnapshot as BreakdownSnapshot | null, 'totalDays')
    : null
  const totalDays =
    snapshotTotalDays ??
    chargeLines.reduce((sum: number, line: ChargeLine) => sum + Number(line.quantityDays ?? 0), 0)
  const customer = stay?.customer ?? stay?.pet?.customer ?? stay?.receiver ?? null
  const primaryPhone = customer?.phone ?? null
  const rawCustomerSecondaryPhone =
    customer && 'representativePhone' in customer ? customer.representativePhone : null
  const customerSecondaryPhone = typeof rawCustomerSecondaryPhone === 'string' ? rawCustomerSecondaryPhone : null
  const secondaryPhone =
    customerSecondaryPhone && customerSecondaryPhone !== primaryPhone
      ? customerSecondaryPhone
      : stay?.receiver?.phone && stay.receiver.phone !== primaryPhone
        ? stay.receiver.phone
        : null
  const petName = stay?.petName || stay?.pet?.name || 'Chi tiết lưu trú'
  const petCode = stay?.pet?.petCode || stay?.pet?.id || stay?.petId || '---'
  const petDescription = [stay?.pet?.breed, stay?.pet?.species].filter(Boolean).join(' • ')
  const paymentStatus = stay?.order?.paymentStatus ?? stay?.paymentStatus
  const activities = timelineQuery.data?.activities ?? getFallbackTimeline(stay)
  const checkpoints = timelineQuery.data?.checkpoints
  const adjustments = stay?.adjustments ?? []
  const customerId = customer?.id ?? stay?.customerId ?? stay?.pet?.customer?.id
  const petId = stay?.pet?.id ?? stay?.petId
  const canShowCheckIn = stay?.status === 'BOOKED' && actionSlotIndex != null
  const canShowCancel = stay ? !['CHECKED_OUT', 'CANCELLED'].includes(stay.status) : false
  const displayTotalDays = stay?.status === 'CHECKED_IN' && currentPriceQuery.data
    ? currentPriceQuery.data.totalDays
    : totalDays
  const currentPreviewTotal = currentPriceQuery.data
    ? getCurrentTotal(currentPriceQuery.data.totalPrice, stay?.surcharge, stay?.promotion)
    : null
  const noteSource = stay ? `${stay.id}:${stay.updatedAt}:${stay.notes ?? ''}:${stay.petNotes ?? ''}:${stay.accessories ?? ''}` : ''
  const notesChanged = Boolean(stay) && (
    noteDraft.notes !== (stay?.notes ?? '') ||
    noteDraft.petNotes !== (stay?.petNotes ?? '') ||
    noteDraft.accessories !== (stay?.accessories ?? '')
  )
  const canShowHealthSection = stay ? ['CHECKED_IN', 'CHECKED_OUT'].includes(stay.status) : false

  useEffect(() => {
    if (!stay || noteDraftSource === noteSource || (noteDraftSource && notesChanged)) return

    setNoteDraft({
      notes: stay.notes ?? '',
      petNotes: stay.petNotes ?? '',
      accessories: stay.accessories ?? '',
    })
    setNoteDraftSource(noteSource)
  }, [noteDraftSource, noteSource, notesChanged, stay])

  const saveNotesMutation = useMutation({
    mutationFn: () =>
      hotelApi.updateStay(stay?.id as string, {
        notes: noteDraft.notes,
        petNotes: noteDraft.petNotes,
        accessories: noteDraft.accessories,
      }),
    onSuccess: (updatedStay) => {
      setNoteDraft({
        notes: updatedStay.notes ?? '',
        petNotes: updatedStay.petNotes ?? '',
        accessories: updatedStay.accessories ?? '',
      })
      setNoteDraftSource(`${updatedStay.id}:${updatedStay.updatedAt}:${updatedStay.notes ?? ''}:${updatedStay.petNotes ?? ''}:${updatedStay.accessories ?? ''}`)
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay', updatedStay.id] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-timeline', updatedStay.id] })
      toast.success('Đã lưu ghi chú lưu trú')
    },
    onError: () => {
      toast.error('Không lưu được ghi chú lưu trú')
    },
  })

  const createHealthLogMutation = useMutation({
    mutationFn: () =>
      hotelApi.createStayHealthLog(stay?.id as string, {
        condition: healthDraft.condition.trim() || 'Theo dõi',
        content: healthDraft.content.trim(),
        ...(parseOptionalNumber(healthDraft.temperature) !== undefined
          ? { temperature: parseOptionalNumber(healthDraft.temperature) }
          : {}),
        ...(parseOptionalNumber(healthDraft.weight) !== undefined
          ? { weight: parseOptionalNumber(healthDraft.weight) }
          : {}),
        ...(healthDraft.appetite.trim() ? { appetite: healthDraft.appetite.trim() } : {}),
        ...(healthDraft.stool.trim() ? { stool: healthDraft.stool.trim() } : {}),
      }),
    onSuccess: () => {
      setHealthDraft(EMPTY_HEALTH_DRAFT)
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-health-logs', stay?.id] })
      queryClient.invalidateQueries({ queryKey: ['hotel-stay-timeline', stay?.id] })
      toast.success('Đã ghi nhận sức khỏe')
    },
    onError: () => {
      toast.error('Không ghi nhận được sức khỏe')
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-2xl border border-border bg-background-base shadow-xl duration-200 sm:max-h-[85vh]">
          <Tabs.Root defaultValue="info" className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <Dialog.Title className="min-w-0 truncate text-xl font-bold text-foreground">
                    {petName}
                  </Dialog.Title>
                  <HotelStatusBadge status={stay?.status} />
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
                      <InfoPanel className="relative group min-h-[136px]">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <SectionTitle icon={UserRound} title="Khách hàng" />
                          {customerId ? (
                            <Link
                              href={`/customers/${customerId}`}
                              className="text-xs font-medium text-primary-500 opacity-100 transition-opacity hover:text-primary-400 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              Chi tiết
                            </Link>
                          ) : null}
                        </div>
                        <p className="text-base font-semibold text-foreground">
                          {customer?.fullName || 'Khách lẻ (Khách vãng lai)'}
                        </p>
                        <div className="mt-2">
                          <PhoneLine label="SĐT chính" phone={primaryPhone} />
                          <PhoneLine label="SĐT phụ" phone={secondaryPhone} />
                        </div>
                      </InfoPanel>

                      <InfoPanel className="relative group min-h-[136px]">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <SectionTitle icon={Tag} title="Thú cưng" />
                          {petId ? (
                            <Link
                              href={`/pets/${petId}`}
                              className="text-xs font-medium text-primary-500 opacity-100 transition-opacity hover:text-primary-400 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              Chi tiết
                            </Link>
                          ) : null}
                        </div>
                        <p className="text-base font-semibold text-foreground">{petName}</p>
                        <p className="mt-2 text-xs text-foreground-muted">
                          Mã: <span className="font-mono font-medium text-foreground">{petCode}</span>
                        </p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          Hạng cân: <span className="font-medium text-foreground">{stay.weightBand?.label || 'Chưa xác định'}</span>
                        </p>
                      </InfoPanel>

                      <InfoPanel className="min-h-[136px]">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <SectionTitle icon={CreditCard} title="Đơn hàng" />
                          <PaymentStatusBadge status={paymentStatus} />
                        </div>
                        {stay.order ? (
                          canReadOrders ? (
                            <Link
                              href={`/orders/${stay.order.id}`}
                              className="inline-flex font-mono text-sm font-semibold text-primary-500 transition-colors hover:text-primary-400 hover:underline"
                            >
                              {stay.order.orderNumber}
                            </Link>
                          ) : (
                            <p className="font-mono text-sm font-semibold text-foreground">{stay.order.orderNumber}</p>
                          )
                        ) : (
                          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                            Chưa liên kết đơn POS.
                          </div>
                        )}
                      </InfoPanel>
                    </section>

                    <section className="grid gap-3 sm:grid-cols-4">
                      <InfoItem label="Check-in" value={formatStayDate(stay.checkIn)} />
                      <InfoItem label="Dự kiến trả" value={formatStayDate(stay.estimatedCheckOut)} />
                      <InfoItem label="Check-out" value={formatStayDate(stay.checkOutActual)} />
                      <InfoItem label="Số ngày" value={displayTotalDays || 0} />
                    </section>

                    <InfoPanel>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <SectionTitle icon={ReceiptText} title="Bảng tính giá" />
                        <span className="text-xs text-foreground-muted">Tổng ngày tính tiền: {displayTotalDays || 0}</span>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                        <div className="space-y-3">
                          {chargeLines.length > 0 ? (
                            chargeLines.map((line: ChargeLine, index: number) => (
                              <div
                                key={`${line.id ?? line.label}-${index}`}
                                className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background-secondary/50 px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {String(line.label ?? 'Hotel')}
                                  </p>
                                  <p className="mt-1 text-xs text-foreground-muted">
                                    {Number(line.quantityDays ?? 0)} ngày x {toMoney(line.unitPrice)}
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-semibold text-foreground">
                                  {toMoney(line.subtotal)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-foreground-muted">
                              Chưa có dòng tính giá chi tiết.
                            </div>
                          )}

                          {adjustments.length > 0 ? (
                            <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-600">Phụ thu chi tiết</p>
                              {adjustments.map((adjustment) => (
                                <div key={adjustment.id} className="flex items-start justify-between gap-3 text-sm">
                                  <div>
                                    <p className="font-medium text-foreground">{adjustment.label}</p>
                                    {adjustment.note ? <p className="text-xs text-foreground-muted">{adjustment.note}</p> : null}
                                  </div>
                                  <span className="font-semibold text-foreground">{toMoney(adjustment.amount)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4">
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-foreground-muted">Đơn giá/ngày</span>
                              <span className="font-semibold text-foreground">{toMoney(stay.dailyRate)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-foreground-muted">Phụ thu</span>
                              <span className="font-semibold text-foreground">{toMoney(stay.surcharge)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-foreground-muted">Khuyến mãi</span>
                              <span className="font-semibold text-foreground">-{toMoney(stay.promotion)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-foreground-muted">Đặt cọc</span>
                              <span className="font-semibold text-foreground">{toMoney(stay.depositAmount)}</span>
                            </div>
                            <div className="border-t border-primary-500/20 pt-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-foreground">Tổng tiền</span>
                                <span className="text-lg font-bold text-primary-500">{toMoney(stay.totalPrice)}</span>
                              </div>
                            </div>
                            {stay.status === 'CHECKED_IN' ? (
                              <div className="border-t border-primary-500/20 pt-3">
                                {currentPriceQuery.data ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-foreground-muted">Số ngày hiện tại</span>
                                      <span className="font-semibold text-foreground">{currentPriceQuery.data.totalDays}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-sm font-semibold text-foreground">Tạm tính hiện tại</span>
                                      <span className="text-lg font-bold text-primary-500">{toMoney(currentPreviewTotal)}</span>
                                    </div>
                                  </div>
                                ) : canFetchCurrentPreview ? (
                                  <div className="text-xs text-foreground-muted">
                                    {currentPriceQuery.isFetching ? 'Đang tính tạm tính hiện tại...' : 'Chưa tính được tạm tính hiện tại.'}
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-primary-500/20 px-3 py-2 text-xs text-foreground-muted">
                                    Không đủ dữ liệu loài/cân nặng để tính tạm tính hiện tại.
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </InfoPanel>

                    <InfoPanel>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <SectionTitle icon={PawPrint} title="Ghi chú & đồ gửi kèm" />
                        <button
                          type="button"
                          onClick={() => saveNotesMutation.mutate()}
                          disabled={!canUpdateHotel || !notesChanged || saveNotesMutation.isPending}
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary-500 px-3 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save size={14} />
                          {saveNotesMutation.isPending ? 'Đang lưu...' : 'Lưu ghi chú'}
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="block">
                          <span className="text-xs font-semibold text-foreground-muted">Ghi chú lưu trú</span>
                          <textarea
                            value={noteDraft.notes}
                            onChange={(event) => setNoteDraft((draft) => ({ ...draft, notes: event.target.value }))}
                            rows={4}
                            disabled={!canUpdateHotel}
                            className="mt-2 min-h-[112px] w-full rounded-xl border border-border bg-background-secondary/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Ghi chú chăm sóc, lịch ăn, lưu ý từ khách..."
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-foreground-muted">Ghi chú thú cưng</span>
                          <textarea
                            value={noteDraft.petNotes}
                            onChange={(event) => setNoteDraft((draft) => ({ ...draft, petNotes: event.target.value }))}
                            rows={4}
                            disabled={!canUpdateHotel}
                            className="mt-2 min-h-[112px] w-full rounded-xl border border-border bg-background-secondary/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Tính cách, dị ứng, tình trạng cần theo dõi..."
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-foreground-muted">Đồ gửi kèm</span>
                          <textarea
                            value={noteDraft.accessories}
                            onChange={(event) => setNoteDraft((draft) => ({ ...draft, accessories: event.target.value }))}
                            rows={4}
                            disabled={!canUpdateHotel}
                            className="mt-2 min-h-[112px] w-full rounded-xl border border-border bg-background-secondary/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Dây dắt, đồ ăn, thuốc, phụ kiện..."
                          />
                        </label>
                      </div>
                    </InfoPanel>

                    {canShowHealthSection ? (
                      <InfoPanel>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <SectionTitle icon={HeartPulse} title="Sức khỏe khi trông" />
                          {stay.status === 'CHECKED_IN' ? (
                            <button
                              type="button"
                              onClick={() => createHealthLogMutation.mutate()}
                              disabled={!canUpdateHotel || !healthDraft.content.trim() || createHealthLogMutation.isPending}
                              className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary-500 px-3 text-sm font-medium text-white transition-all duration-150 hover:bg-primary-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Save size={14} />
                              {createHealthLogMutation.isPending ? 'Đang lưu...' : 'Ghi nhận'}
                            </button>
                          ) : null}
                        </div>

                        {stay.status === 'CHECKED_IN' ? (
                          <div className="mb-4 grid gap-3 lg:grid-cols-[180px_1fr]">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                              <label className="block">
                                <span className="text-xs font-semibold text-foreground-muted">Tình trạng</span>
                                <input
                                  value={healthDraft.condition}
                                  onChange={(event) => setHealthDraft((draft) => ({ ...draft, condition: event.target.value }))}
                                  disabled={!canUpdateHotel}
                                  className="mt-2 h-10 w-full rounded-xl border border-border bg-background-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  placeholder="Ổn định"
                                />
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                  <span className="text-xs font-semibold text-foreground-muted">Nhiệt độ</span>
                                  <input
                                    value={healthDraft.temperature}
                                    onChange={(event) => setHealthDraft((draft) => ({ ...draft, temperature: event.target.value }))}
                                    disabled={!canUpdateHotel}
                                    inputMode="decimal"
                                    className="mt-2 h-10 w-full rounded-xl border border-border bg-background-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="°C"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-semibold text-foreground-muted">Cân nặng</span>
                                  <input
                                    value={healthDraft.weight}
                                    onChange={(event) => setHealthDraft((draft) => ({ ...draft, weight: event.target.value }))}
                                    disabled={!canUpdateHotel}
                                    inputMode="decimal"
                                    className="mt-2 h-10 w-full rounded-xl border border-border bg-background-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="kg"
                                  />
                                </label>
                              </div>
                            </div>
                            <div className="grid gap-3">
                              <label className="block">
                                <span className="text-xs font-semibold text-foreground-muted">Nội dung theo dõi</span>
                                <textarea
                                  value={healthDraft.content}
                                  onChange={(event) => setHealthDraft((draft) => ({ ...draft, content: event.target.value }))}
                                  rows={4}
                                  disabled={!canUpdateHotel}
                                  className="mt-2 min-h-[112px] w-full rounded-xl border border-border bg-background-secondary/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  placeholder="Ăn uống, vận động, biểu hiện bất thường, thuốc đã dùng..."
                                />
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                  <span className="text-xs font-semibold text-foreground-muted">Ăn uống</span>
                                  <input
                                    value={healthDraft.appetite}
                                    onChange={(event) => setHealthDraft((draft) => ({ ...draft, appetite: event.target.value }))}
                                    disabled={!canUpdateHotel}
                                    className="mt-2 h-10 w-full rounded-xl border border-border bg-background-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="Ăn tốt / bỏ ăn..."
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-semibold text-foreground-muted">Đi vệ sinh</span>
                                  <input
                                    value={healthDraft.stool}
                                    onChange={(event) => setHealthDraft((draft) => ({ ...draft, stool: event.target.value }))}
                                    disabled={!canUpdateHotel}
                                    className="mt-2 h-10 w-full rounded-xl border border-border bg-background-secondary/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="Bình thường / lỏng..."
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <HealthLogList logs={healthLogsQuery.data ?? []} isLoading={healthLogsQuery.isFetching} />
                        </div>
                      </InfoPanel>
                    ) : null}
                  </div>
                </Tabs.Content>

                <Tabs.Content value="history" className="min-h-0 flex-1 overflow-y-auto outline-none">
                  <HistorySection
                    activities={activities}
                    checkpoints={checkpoints}
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
                      onClick={() => {
                        if (window.confirm('Bạn có chắc muốn hủy phiếu lưu trú này?')) {
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
