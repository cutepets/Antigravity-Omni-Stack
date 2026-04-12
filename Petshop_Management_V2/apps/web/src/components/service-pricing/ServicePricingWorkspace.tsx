'use client'
/* eslint-disable react/no-unescaped-entities */

import * as Popover from '@radix-ui/react-popover'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addMonths, endOfMonth, endOfWeek, isAfter, isBefore, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Save, X } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { hotelApi } from '@/lib/api/hotel.api'
import {
  pricingApi,
  type HolidayCalendarDate,
  type PricingDayType,
  type PricingServiceType,
  type ServiceWeightBand,
} from '@/lib/api/pricing.api'
import { useAuthorization } from '@/hooks/useAuthorization'
import { cn, formatCurrency } from '@/lib/utils'

type PricingMode = 'HOTEL' | 'GROOMING'

type BandDraft = {
  key: string
  id: string | null
  label: string
  minWeight: string
  maxWeight: string
  sortOrder: string
}

type SpaServiceColumn = {
  key: string
  packageCode: string
}

type SpaDraft = {
  id?: string
  price: string
  durationMinutes: string
}

type HotelDraft = {
  id?: string
  fullDayPrice: string
}

type HolidayDraft = {
  startDate: string
  endDate: string
  name: string
  isRecurring: boolean
}

type HotelPreviewResult = Awaited<ReturnType<typeof hotelApi.calculatePrice>>

const SPECIES_OPTIONS = [
  { value: 'Chó', label: 'Chó' },
  { value: 'Mèo', label: 'Mèo' },
]

const SPA_PACKAGES = [
  { code: 'BATH', label: 'Tắm' },
  { code: 'BATH_CLEAN', label: 'Tắm + Vệ sinh' },
  { code: 'SHAVE', label: 'Cạo' },
  { code: 'BATH_SHAVE_CLEAN', label: 'Tắm + Cạo + VS' },
  { code: 'SPA', label: 'SPA' },
]

const DAY_TYPE_OPTIONS: Array<{ value: PricingDayType; label: string; hint: string }> = [
  { value: 'REGULAR', label: 'Ngày thường', hint: 'Dùng cho các ngày không nằm trong lịch lễ' },
  { value: 'HOLIDAY', label: 'Ngày lễ', hint: 'Dùng khi ngày gửi nằm trong lịch ngày lễ active' },
]

const HOTEL_SPECIES_COLUMNS = SPECIES_OPTIONS

const HOTEL_PROMOS = [
  'Gửi trên 7 ngày tắm miễn phí 1 lần (trừ lễ, tết).',
  'Gửi trên 30 ngày giảm 5% phí trông giữ.',
]

const HOTEL_EXTRA_SERVICES = [
  { price: '10k - 30k / lần', description: 'Cho uống thuốc, bôi thuốc (không hung dữ).' },
  { price: '10k / ngày', description: 'Đồ ăn thêm theo yêu cầu nấu hoặc bảo quản tủ.' },
  { price: '20k / ngày / bé', description: 'Điều hòa mùa hè (từ bé thứ 2 giảm còn 10k).' },
]

const HOTEL_INCLUDED = [
  'Mỗi bé 1 buồng riêng biệt, có khay vệ sinh, đệm và bát ăn riêng.',
  'Được dọn dẹp vệ sinh, xịt khử mùi, khử khuẩn và diệt ve bọ thường xuyên.',
  'Ngày ăn 2 bữa với hạt mix thịt sấy, pate, ức gà, thịt xay, cơm.',
  'Gửi clip bé vào tối hàng ngày qua Zalo.',
]

const GROOMING_EXTRA_SERVICES = [
  { name: 'Tắm nấm, bọ <5kg', price: '30k' },
  { name: 'Tắm nấm, bọ 5-15kg', price: '40k' },
  { name: 'Tắm nấm, bọ >15kg', price: '70k' },
  { name: 'Cắt móng, cạo bàn', price: '30k - 70k' },
  { name: 'Cạo bụng, hậu môn', price: '20k' },
  { name: 'Vệ sinh tai', price: '20k' },
  { name: 'Bấm gọn mắt miệng', price: '20k' },
  { name: 'Gỡ rối lông', price: '30k - 300k' },
]

const GROOMING_PROCESS_CARDS = [
  {
    title: '(1) Tắm',
    time: '20p - 40p',
    items: ['Chải lông', 'Tắm xà bông lần 1', 'Vắt tuyến hôi', 'Xả nước', 'Tắm xà bông lần 2', 'Sấy khô lông', 'Chải bông lông', 'Thoa tinh dầu'],
  },
  {
    title: '(2) Vệ sinh',
    time: '10p - 20p',
    items: ['Cắt móng', 'Cạo bàn', 'Nhổ lông tai', 'Vệ sinh tai', 'Cạo lông bụng', 'Cạo lông hậu môn'],
  },
  {
    title: '(3) Cạo lông',
    time: '30p - 60p',
    items: ['Tư vấn cạo lông phù hợp.'],
  },
  {
    title: 'SPA',
    time: '2h30 - 4h00',
    items: ['Đầy đủ gói (1) + (2).', 'Tư vấn kiểu cắt tỉa phù hợp.', 'Giá chưa bao gồm phí gỡ rối lông nếu bé bị rối nặng.'],
  },
]

function normalizeSkuText(value?: string | null) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function getWeightBandSkuSuffix(label?: string | null) {
  const numbers = String(label ?? '').match(/\d+(?:[.,]\d+)?/g)
  return numbers?.map((value) => value.replace(/[.,]/g, '')).join('') ?? ''
}

function getSkuInitials(value?: string | null) {
  return normalizeSkuText(value)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
}

function getSpaSkuPrefix(packageCode?: string | null) {
  const code = normalizeSkuText(packageCode).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const prefixByCode: Record<string, string> = {
    BATH: 'T',
    TAM: 'T',
    HYGIENE: 'VS',
    VE_SINH: 'VS',
    CLIP: 'CL',
    CUT: 'CL',
    SHAVE: 'CL',
    CAO_LONG: 'CL',
    BATH_CLEAN: 'TVS',
    BATH_HYGIENE: 'TVS',
    BATH_SHAVE: 'TCL',
    BATH_CLIP: 'TCL',
    BATH_SHAVE_CLEAN: 'TCLVS',
    BATH_CLIP_HYGIENE: 'TCLVS',
    SPA: 'SPA',
  }

  return prefixByCode[code] ?? (getSkuInitials(packageCode) || 'SPA')
}

function buildServicePricingSku(kind: 'HOTEL' | 'SPA', label: string, weightBandLabel?: string | null) {
  const prefix = kind === 'HOTEL' ? 'HLT' : getSpaSkuPrefix(label)
  return `${prefix}${getWeightBandSkuSuffix(weightBandLabel)}`
}

function formatWeightInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
}

function formatCurrencyInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(value))
}

function formatIntegerInput(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? '' : String(Math.round(value))
}

function normalizeCurrencyInput(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(digits))
}

function deriveHalfDayPrice(fullDayPrice: number | null | undefined) {
  return fullDayPrice === null || fullDayPrice === undefined ? null : Math.round(fullDayPrice / 2)
}

function parseWeightInput(value: string) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.')
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? numberValue : null
}

function parseCurrencyInput(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  const numberValue = Number(digits)
  return Number.isFinite(numberValue) ? numberValue : null
}

function parseIntegerInput(value: string) {
  const normalized = String(value ?? '').replace(/[^\d-]/g, '')
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : null
}

function toDateInputValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 10)
}

function formatHolidayRange(holiday: HolidayCalendarDate) {
  const start = new Date(holiday.date).toLocaleDateString('vi-VN')
  const end = holiday.endDate ? new Date(holiday.endDate).toLocaleDateString('vi-VN') : start
  return start === end ? start : `${start} - ${end}`
}

function parseDateInputValue(value: string) {
  const [year, month, day] = String(value ?? '').split('-').map(Number)
  return new Date(year, Math.max(0, (month ?? 1) - 1), day ?? 1)
}

function getMonthTitle(date: Date) {
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
}

function getPreviewDateRangeValue(previewForm: { checkIn: string; checkOut: string }) {
  return {
    startDate: previewForm.checkIn.slice(0, 10),
    endDate: previewForm.checkOut.slice(0, 10),
  }
}

function getPreviewTimeValue(value: string, fallback: string) {
  const time = value.split('T')[1]?.slice(0, 5)
  return time && /^\d{2}:\d{2}$/.test(time) ? time : fallback
}

function applyPreviewDateRangeValue(
  current: { species: string; weight: string; checkIn: string; checkOut: string },
  patch: Partial<HolidayDraft>,
) {
  const nextStartDate = patch.startDate ?? current.checkIn.slice(0, 10)
  const nextEndDate = patch.endDate ?? current.checkOut.slice(0, 10)
  const nextCheckInTime = getPreviewTimeValue(current.checkIn, '09:00')
  const nextCheckOutTime = getPreviewTimeValue(current.checkOut, '18:00')
  return {
    ...current,
    checkIn: `${nextStartDate}T${nextCheckInTime}`,
    checkOut: `${nextEndDate}T${nextCheckOutTime}`,
  }
}

function applyPreviewTimeValue(
  current: { species: string; weight: string; checkIn: string; checkOut: string },
  patch: { checkInTime?: string; checkOutTime?: string },
) {
  const nextCheckInTime = patch.checkInTime ?? getPreviewTimeValue(current.checkIn, '09:00')
  const nextCheckOutTime = patch.checkOutTime ?? getPreviewTimeValue(current.checkOut, '18:00')
  return {
    ...current,
    checkIn: `${current.checkIn.slice(0, 10)}T${nextCheckInTime}`,
    checkOut: `${current.checkOut.slice(0, 10)}T${nextCheckOutTime}`,
  }
}

function createHolidayDraft(baseDate = new Date()): HolidayDraft {
  const normalizedDate = toDateInputValue(baseDate)
  return {
    startDate: normalizedDate,
    endDate: normalizedDate,
    name: '',
    isRecurring: true,
  }
}

function getHolidayDraftFromCalendarDate(holiday: HolidayCalendarDate): HolidayDraft {
  const startDate = toDateInputValue(new Date(holiday.date))
  const endDate = holiday.endDate ? toDateInputValue(new Date(holiday.endDate)) : startDate
  return {
    startDate,
    endDate,
    name: holiday.name,
    isRecurring: holiday.isRecurring,
  }
}

function createDraftKey(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function getSpaRuleKey(bandKey: string, serviceKey: string) {
  return `${bandKey}:${serviceKey}`
}

function getHotelRuleKey(weightBandId: string, dayType: PricingDayType, species = '') {
  return `${weightBandId}:${dayType}:${species}`
}

function getHotelBandGroupKey(band: Pick<ServiceWeightBand, 'label' | 'minWeight' | 'maxWeight'>) {
  return `${band.label}:${band.minWeight}:${band.maxWeight ?? 'INF'}`
}

function buildBandDraft(band: ServiceWeightBand): BandDraft {
  return {
    key: band.id,
    id: band.id,
    label: band.label,
    minWeight: formatWeightInput(band.minWeight),
    maxWeight: formatWeightInput(band.maxWeight),
    sortOrder: String(band.sortOrder ?? 0),
  }
}

function getHotelPreviewWeightBandLabel(
  line: HotelPreviewResult['chargeLines'][number],
  preview?: HotelPreviewResult,
) {
  const snapshot = line.pricingSnapshot as Record<string, unknown> | undefined
  return String(snapshot?.weightBandLabel ?? preview?.weightBand?.label ?? 'theo cân nặng')
}

function aggregateHotelPreviewLines(preview: HotelPreviewResult) {
  const grouped = new Map<string, {
    dayType: HotelPreviewResult['chargeLines'][number]['dayType']
    quantityDays: number
    subtotal: number
    sortOrder: number
    fullDayPrices: number[]
    holidayNames: string[]
  }>()

  for (const line of preview.chargeLines) {
    const snapshot = line.pricingSnapshot as Record<string, unknown> | undefined
    const key = String(line.dayType ?? 'REGULAR')
    const existing = grouped.get(key)
    const fullDayPrice = Number(snapshot?.fullDayPrice)
    const holidayName = String(snapshot?.holidayName ?? '').trim()

    if (existing) {
      existing.quantityDays += line.quantityDays
      existing.subtotal += line.subtotal
      if (Number.isFinite(fullDayPrice) && !existing.fullDayPrices.includes(fullDayPrice)) {
        existing.fullDayPrices.push(fullDayPrice)
      }
      if (holidayName && !existing.holidayNames.includes(holidayName)) {
        existing.holidayNames.push(holidayName)
      }
      continue
    }

    grouped.set(key, {
      dayType: line.dayType,
      quantityDays: line.quantityDays,
      subtotal: line.subtotal,
      sortOrder: line.sortOrder,
      fullDayPrices: Number.isFinite(fullDayPrice) ? [fullDayPrice] : [],
      holidayNames: holidayName ? [holidayName] : [],
    })
  }

  return Array.from(grouped.values())
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((group) => {
      const sampleLine = preview.chargeLines.find((line) => line.dayType === group.dayType) ?? preview.chargeLines[0]
      const weightBandLabel = sampleLine ? getHotelPreviewWeightBandLabel(sampleLine, preview) : preview.weightBand?.label ?? 'theo cân nặng'
      const label = group.dayType === 'HOLIDAY'
        ? group.holidayNames.length === 1
          ? `Hotel lễ ${group.holidayNames[0]} - ${weightBandLabel}`
          : `Hotel ngày lễ - ${weightBandLabel}`
        : `Hotel ${weightBandLabel}`

      const unitPriceLabel = group.fullDayPrices.length === 1
        ? formatCurrency(group.fullDayPrices[0])
        : group.fullDayPrices.length > 1
          ? `${formatCurrency(Math.min(...group.fullDayPrices))} - ${formatCurrency(Math.max(...group.fullDayPrices))}`
          : formatCurrency(sampleLine?.unitPrice ?? 0)

      return {
        ...group,
        label,
        unitPriceLabel,
        quantityDays: Math.round(group.quantityDays * 10) / 10,
        subtotal: Math.round(group.subtotal),
      }
    })
}

function buildSpaServiceColumns(packageCodes: string[]): SpaServiceColumn[] {
  const seen = new Set<string>()
  const columns: SpaServiceColumn[] = []
  for (const packageCode of packageCodes) {
    const normalized = String(packageCode ?? '').trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    columns.push({ key: normalized, packageCode: normalized })
  }
  return columns
}

function HolidayDateRangeField({
  value,
  onChange,
  disabled,
}: {
  value: { startDate: string; endDate: string }
  onChange: (patch: { startDate: string; endDate: string }) => void
  disabled?: boolean
}) {
  const startDate = useMemo(() => parseDateInputValue(value.startDate), [value.startDate])
  const endDate = useMemo(() => parseDateInputValue(value.endDate), [value.endDate])
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(startDate))
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

  useEffect(() => {
    setVisibleMonth(startOfMonth(startDate))
  }, [startDate])

  const applyRange = (nextStart: Date, nextEnd: Date) => {
    onChange({
      startDate: toDateInputValue(nextStart),
      endDate: toDateInputValue(nextEnd),
    })
  }

  const handlePickDate = (pickedDate: Date) => {
    const normalizedDate = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate())

    if (!value.startDate || (value.startDate && value.endDate && value.startDate !== value.endDate)) {
      applyRange(normalizedDate, normalizedDate)
      return
    }

    const currentStart = parseDateInputValue(value.startDate)
    if (normalizedDate < currentStart) {
      applyRange(normalizedDate, currentStart)
    } else {
      applyRange(currentStart, normalizedDate)
    }
    setOpen(false)
  }

  const handlePickToday = () => {
    const today = new Date()
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    applyRange(normalizedToday, normalizedToday)
    setVisibleMonth(startOfMonth(normalizedToday))
  }

  const buildCalendarDays = (month: Date) => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days: Date[] = []
    let cursor = calendarStart

    while (cursor <= calendarEnd) {
      days.push(cursor)
      cursor = addDays(cursor, 1)
    }

    return days
  }

  const renderMonth = (month: Date) => {
    const days = buildCalendarDays(month)
    const hasPendingStart = value.startDate === value.endDate

    return (
      <div className="w-full max-w-[360px]">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background-base text-foreground-muted transition-colors hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-lg font-black text-foreground">{getMonthTitle(month)}</p>
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background-base text-foreground-muted transition-colors hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div key={`${month.toISOString()}-${day}`} className="py-2 text-center text-sm font-semibold text-foreground-muted">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const inVisibleMonth = isSameMonth(day, month)
            const isStart = isSameDay(day, startDate)
            const isEnd = isSameDay(day, endDate)
            const inRange = hasPendingStart
              ? isStart
              : !isBefore(day, startDate) && !isAfter(day, endDate)

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => handlePickDate(day)}
                className={cn(
                  'relative h-10 rounded-xl text-sm font-semibold transition-colors',
                  inVisibleMonth ? 'text-foreground' : 'text-foreground-muted/45',
                  inRange ? 'bg-primary-500/12 text-primary-500' : 'hover:bg-background-base',
                  isStart || isEnd ? 'bg-primary-500 text-white hover:bg-primary-500' : '',
                )}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-background-base px-3 text-left text-sm text-foreground outline-none transition-colors hover:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="truncate font-medium text-foreground">{startDate.toLocaleDateString('vi-VN')} - {endDate.toLocaleDateString('vi-VN')}</span>
            <CalendarDays size={18} className="shrink-0 text-primary-500" />
          </button>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content
          sideOffset={10}
          align="start"
          className="z-50 w-[min(92vw,420px)] rounded-[28px] border border-border bg-background-secondary p-4 shadow-2xl shadow-black/35"
        >
          <div className="flex justify-center">{renderMonth(visibleMonth)}</div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <button
              type="button"
              onClick={handlePickToday}
              className="text-sm font-bold text-primary-500 transition-colors hover:text-primary-400"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background-base px-4 text-sm font-bold text-foreground"
            >
              Xong
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function HolidayCalendarPanel({
  holidays,
  newHoliday,
  editingHolidayId,
  onHolidayDraftChange,
  onSubmitHoliday,
  onCancelEdit,
  onEditHoliday,
  onDeleteHoliday,
  isSavingHoliday,
  canManagePricing,
  canEditPricing = canManagePricing,
}: {
  holidays: HolidayCalendarDate[]
  newHoliday: HolidayDraft
  editingHolidayId: string | null
  onHolidayDraftChange: (patch: Partial<HolidayDraft>) => void
  onSubmitHoliday: () => void
  onCancelEdit: () => void
  onEditHoliday: (holiday: HolidayCalendarDate) => void
  onDeleteHoliday: (id: string) => void
  isSavingHoliday: boolean
  canManagePricing: boolean
  canEditPricing?: boolean
}) {
  return (
    <div className="rounded-[28px] border border-border bg-background-secondary/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays size={18} className="text-primary-500" />
        <h3 className="text-base font-black text-foreground">Lịch ngày lễ</h3>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
        <HolidayDateRangeField value={newHoliday} onChange={onHolidayDraftChange} disabled={!canEditPricing} />
        <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background-base px-3 text-sm font-semibold text-foreground-muted">
          <input
            type="checkbox"
            checked={newHoliday.isRecurring}
            onChange={(event) => onHolidayDraftChange({ isRecurring: event.target.checked })}
            disabled={!canEditPricing}
            className="h-4 w-4 accent-primary-500"
          />
          Lặp lại năm
        </label>
      </div>
      <div className="mt-2">
        <input
          value={newHoliday.name}
          onChange={(event) => onHolidayDraftChange({ name: event.target.value })}
          disabled={!canEditPricing}
          className="h-11 w-full rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
        />
      </div>
      {canEditPricing ? <div className="mt-2 flex gap-2">
        {editingHolidayId ? (
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isSavingHoliday}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-border bg-background-base text-sm font-bold text-foreground disabled:opacity-50"
          >
            Hủy sửa
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSubmitHoliday}
          disabled={isSavingHoliday}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-500 text-sm font-bold text-white disabled:opacity-50"
        >
          {editingHolidayId ? <Save size={15} /> : <Plus size={15} />}
          {editingHolidayId ? 'Lưu kỳ lễ' : 'Thêm kỳ lễ'}
        </button>
      </div> : null}

      <div className="custom-scrollbar mt-3 max-h-52 space-y-2 overflow-y-auto">
        {holidays.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-foreground-muted">Chưa có kỳ lễ nào trong năm.</p>
        ) : holidays.map((holiday) => (
          <div key={holiday.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background-base px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{holiday.name}</p>
              <p className="text-xs text-foreground-muted">{formatHolidayRange(holiday)}{holiday.isRecurring ? ' · Hàng năm' : ''}</p>
            </div>
            {canEditPricing ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditHoliday(holiday)}
                  disabled={isSavingHoliday}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground disabled:opacity-50"
                  title="Sửa kỳ lễ"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteHoliday(holiday.id)}
                  disabled={isSavingHoliday}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
                  title="Xóa kỳ lễ"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ServicePricingWorkspace({ mode }: { mode: PricingMode }) {
  const { hasAnyPermission } = useAuthorization()
  const queryClient = useQueryClient()
  const serviceType: PricingServiceType = mode === 'HOTEL' ? 'HOTEL' : 'GROOMING'
  const currentYear = new Date().getFullYear()
  const [species, setSpecies] = useState(SPECIES_OPTIONS[0].value)
  const [year, setYear] = useState(currentYear)
  const [dayType, setDayType] = useState<PricingDayType>('REGULAR')
  const [bandDrafts, setBandDrafts] = useState<BandDraft[]>([])
  const [spaServiceColumns, setSpaServiceColumns] = useState<SpaServiceColumn[]>([])
  const [spaDrafts, setSpaDrafts] = useState<Record<string, SpaDraft>>({})
  const [hotelDrafts, setHotelDrafts] = useState<Record<string, HotelDraft>>({})
  const [removedBandIds, setRemovedBandIds] = useState<string[]>([])
  const [editingBandKey, setEditingBandKey] = useState<string | null>(null)
  const [editingServiceKey, setEditingServiceKey] = useState<string | null>(null)
  const [newHoliday, setNewHoliday] = useState<HolidayDraft>(() => createHolidayDraft())
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null)
  const [previewForm, setPreviewForm] = useState({
    species: SPECIES_OPTIONS[0].value,
    weight: '5',
    checkIn: `${toDateInputValue(new Date())}T09:00`,
    checkOut: `${toDateInputValue(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))}T18:00`,
  })
  const canManagePricing = mode === 'HOTEL'
    ? hasAnyPermission(['hotel.update', 'settings.pricing_policy.manage'])
    : hasAnyPermission(['grooming.update', 'settings.pricing_policy.manage'])
  const permissionError = mode === 'HOTEL'
    ? 'Bạn không có quyền cập nhật bảng giá Hotel.'
    : 'Bạn không có quyền cập nhật bảng giá Grooming / SPA.'
  const ensureCanManagePricing = () => {
    if (canManagePricing) return true
    toast.error(permissionError)
    return false
  }

  const bandsQuery = useQuery({
    queryKey: ['pricing', 'weight-bands', serviceType, mode === 'HOTEL' ? '__ALL__' : species],
    queryFn: () => pricingApi.getWeightBands({ serviceType, ...(mode === 'GROOMING' ? { species } : {}), isActive: true }),
  })

  const spaRulesQuery = useQuery({
    queryKey: ['pricing', 'spa-rules', species],
    queryFn: () => pricingApi.getSpaRules({ species, isActive: true }),
    enabled: mode === 'GROOMING',
  })

  const hotelRulesQuery = useQuery({
    queryKey: ['pricing', 'hotel-rules', year],
    queryFn: () => pricingApi.getHotelRules({ year, isActive: true }),
    enabled: mode === 'HOTEL',
  })

  const holidaysQuery = useQuery({
    queryKey: ['pricing', 'holidays', year],
    queryFn: () => pricingApi.getHolidays({ year, isActive: true }),
    enabled: mode === 'HOTEL',
  })

  const rawBands = useMemo(() => bandsQuery.data ?? [], [bandsQuery.data])
  const spaRules = useMemo(() => spaRulesQuery.data ?? [], [spaRulesQuery.data])
  const hotelRules = useMemo(() => hotelRulesQuery.data ?? [], [hotelRulesQuery.data])
  const holidays = useMemo(() => holidaysQuery.data ?? [], [holidaysQuery.data])

  const bands = useMemo(() => {
    if (mode !== 'HOTEL') return rawBands

    const grouped = new Map<string, ServiceWeightBand[]>()
    for (const band of rawBands) {
      const key = getHotelBandGroupKey(band)
      grouped.set(key, [...(grouped.get(key) ?? []), band])
    }

    return Array.from(grouped.values())
      .map((group) =>
        [...group].sort((left, right) => {
          const leftPriority = left.species === null ? 0 : left.species === SPECIES_OPTIONS[0].value ? 1 : 2
          const rightPriority = right.species === null ? 0 : right.species === SPECIES_OPTIONS[0].value ? 1 : 2
          if (leftPriority !== rightPriority) return leftPriority - rightPriority
          if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
          return left.minWeight - right.minWeight
        })[0]!,
      )
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
        return left.minWeight - right.minWeight
      })
  }, [mode, rawBands])

  const hotelBandIdMap = useMemo(() => {
    const next = new Map<string, string>()
    if (mode !== 'HOTEL') return next

    const representativeByGroup = new Map<string, string>()
    for (const band of bands) representativeByGroup.set(getHotelBandGroupKey(band), band.id)
    for (const band of rawBands) {
      const groupKey = getHotelBandGroupKey(band)
      const representativeId = representativeByGroup.get(groupKey)
      if (representativeId) next.set(band.id, representativeId)
    }
    return next
  }, [bands, mode, rawBands])

  useEffect(() => {
    setBandDrafts(bands.map(band => buildBandDraft(band)))
  }, [bands])

  useEffect(() => {
    if (mode !== 'GROOMING') return
    const sourcePackageCodes = spaRules.length > 0
      ? spaRules.map((rule) => rule.packageCode)
      : SPA_PACKAGES.map((pkg) => pkg.code)
    const columns = buildSpaServiceColumns(sourcePackageCodes)
    const serviceKeyByCode = new Map(columns.map((column) => [column.packageCode, column.key]))
    const nextDrafts: Record<string, SpaDraft> = {}
    for (const rule of spaRules) {
      const serviceKey = serviceKeyByCode.get(rule.packageCode)
      if (!serviceKey) continue
      nextDrafts[getSpaRuleKey(rule.weightBandId, serviceKey)] = {
        id: rule.id,
        price: formatCurrencyInput(rule.price),
        durationMinutes: formatIntegerInput(rule.durationMinutes),
      }
    }
    setSpaServiceColumns(columns)
    setSpaDrafts(nextDrafts)
  }, [mode, spaRules])

  useEffect(() => {
    if (mode !== 'GROOMING') return
    setRemovedBandIds([])
    setEditingBandKey(null)
    setEditingServiceKey(null)
  }, [mode, species])

  useEffect(() => {
    if (mode !== 'HOTEL') return
    const nextDrafts: Record<string, HotelDraft> = {}
    for (const rule of hotelRules) {
      const representativeBandId = hotelBandIdMap.get(rule.weightBandId) ?? rule.weightBandId
      const ruleSpecies = rule.species?.trim()
      if (!ruleSpecies) continue
      nextDrafts[getHotelRuleKey(representativeBandId, rule.dayType, ruleSpecies)] = {
        id: rule.id,
        fullDayPrice: formatCurrencyInput(rule.fullDayPrice),
      }
    }
    setHotelDrafts(nextDrafts)
  }, [hotelBandIdMap, hotelRules, mode])

  const invalidSpaCells = useMemo(() => {
    if (mode !== 'GROOMING') return 0
    let count = 0
    for (const band of bandDrafts) {
      for (const service of spaServiceColumns) {
        const draft = spaDrafts[getSpaRuleKey(band.key, service.key)]
        if (!draft?.price) count += 1
      }
    }
    return count
  }, [bandDrafts, mode, spaDrafts, spaServiceColumns])

  const invalidHotelCells = useMemo(() => {
    if (mode !== 'HOTEL') return 0
    let count = 0
    for (const band of bandDrafts) {
      for (const option of DAY_TYPE_OPTIONS) {
        for (const speciesOption of HOTEL_SPECIES_COLUMNS) {
          const draft = hotelDrafts[getHotelRuleKey(band.key, option.value, speciesOption.value)]
          if (!draft?.fullDayPrice) count += 1
        }
      }
    }
    return count
  }, [bandDrafts, hotelDrafts, mode])

  const invalidatePricing = () => {
    queryClient.invalidateQueries({ queryKey: ['pricing'] })
  }

  const resetHolidayDraft = () => {
    setNewHoliday(createHolidayDraft())
    setEditingHolidayId(null)
  }

  const updateHolidayDraft = (patch: Partial<HolidayDraft>) => {
    setNewHoliday((current) => {
      const next = { ...current, ...patch }
      if (next.endDate < next.startDate) next.endDate = next.startDate
      return next
    })
  }

  const handleEditHoliday = (holiday: HolidayCalendarDate) => {
    setEditingHolidayId(holiday.id)
    setNewHoliday(getHolidayDraftFromCalendarDate(holiday))
  }

  const presetBandsMutation = useMutation({
    mutationFn: () => pricingApi.createPresetWeightBands(mode === 'HOTEL' ? { serviceType } : { serviceType, species }),
    onSuccess: () => {
      invalidatePricing()
      toast.success('Đã tạo hạng cân mẫu')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không tạo được hạng cân mẫu'),
  })


  const removeBandMutation = useMutation({
    mutationFn: pricingApi.deactivateWeightBand,
    onSuccess: () => {
      invalidatePricing()
      toast.success('Đã tắt hạng cân')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không tắt được hạng cân'),
  })
  const createHolidayMutation = useMutation({
    mutationFn: pricingApi.createHoliday,
    onSuccess: () => {
      const today = toDateInputValue(new Date())
      setNewHoliday({ startDate: today, endDate: today, name: '', isRecurring: true })
      invalidatePricing()
      toast.success('Đã thêm ngày lễ')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không thêm được ngày lễ'),
  })

  const updateHolidayMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: HolidayDraft }) => pricingApi.updateHoliday(id, data),
    onSuccess: () => {
      resetHolidayDraft()
      invalidatePricing()
      toast.success('Đã cập nhật kỳ lễ')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không lưu được kỳ lễ'),
  })

  const deleteHolidayMutation = useMutation({
    mutationFn: pricingApi.deactivateHoliday,
    onSuccess: (_, holidayId) => {
      if (editingHolidayId === holidayId) resetHolidayDraft()
      invalidatePricing()
      toast.success('Đã xóa kỳ lễ')
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Không xóa được kỳ lễ'),
  })

  const previewMutation = useMutation({
    mutationFn: () => {
      const weight = parseWeightInput(previewForm.weight)
      if (weight === null) throw new Error('Cân nặng không hợp lệ')
      return hotelApi.calculatePrice({
        species: previewForm.species,
        weight,
        checkIn: new Date(previewForm.checkIn).toISOString(),
        checkOut: new Date(previewForm.checkOut).toISOString(),
      })
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || 'Không preview được giá Hotel'),
  })

  const [isSavingBands, setIsSavingBands] = useState(false)
  const [isSavingGrooming, setIsSavingGrooming] = useState(false)
  const [isSavingHotel, setIsSavingHotel] = useState(false)

  const saveAllBands = async () => {
    if (!ensureCanManagePricing()) return
    const invalid = bandDrafts.some(b => !b.label.trim() || !b.minWeight)
    if (invalid) {
      toast.error('Cần nhập tên hạng cân và min kg cho tất cả các dòng')
      return
    }

    setIsSavingBands(true)
    try {
      for (let i = 0; i < bandDrafts.length; i++) {
        const draft = bandDrafts[i]
        await pricingApi.upsertWeightBand({
          id: draft.id || undefined,
          serviceType,
          species: mode === 'GROOMING' ? species : null,
          label: draft.label.trim(),
          minWeight: parseWeightInput(draft.minWeight) ?? 0,
          maxWeight: parseWeightInput(draft.maxWeight),
          sortOrder: i,
          isActive: true,
        })
      }
      invalidatePricing()
      toast.success('Đã lưu bảng hạng cân')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Có lỗi khi lưu các hạng cân, có thể bị trùng khoảng min-max.')
    } finally {
      setIsSavingBands(false)
    }
  }

  const addBandRow = () => {
    const nextKey = createDraftKey('band')
    setBandDrafts((current) => [
      ...current,
      { key: nextKey, id: null, label: '', minWeight: '', maxWeight: '', sortOrder: String(current.length) }
    ])
    setEditingBandKey(nextKey)
  }

  const removeBandRow = (index: number) => {
    const band = bandDrafts[index]
    if (!band) return
    setBandDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setEditingBandKey((current) => (current === band.key ? null : current))
    if (mode === 'GROOMING') {
      setSpaDrafts((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${band.key}:`))),
      )
    } else {
      setHotelDrafts((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${band.key}:`))),
      )
    }
    if (band.id) {
      setRemovedBandIds((current) => (current.includes(band.id!) ? current : [...current, band.id!]))
    }
  }

  const updateBandRow = (index: number, patch: Partial<BandDraft>) => {
    setBandDrafts(current => current.map((b, i) => i === index ? { ...b, ...patch } : b))
  }

  const addSpaServiceColumn = () => {
    const nextKey = createDraftKey('service')
    setSpaServiceColumns((current) => [...current, { key: nextKey, packageCode: '' }])
    setEditingServiceKey(nextKey)
  }

  const updateSpaServiceColumn = (serviceKey: string, packageCode: string) => {
    setSpaServiceColumns((current) =>
      current.map((column) => (column.key === serviceKey ? { ...column, packageCode } : column)),
    )
  }

  const removeSpaServiceColumn = (serviceKey: string) => {
    setSpaServiceColumns((current) => current.filter((column) => column.key !== serviceKey))
    setSpaDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => {
          const [, currentServiceKey] = key.split(':')
          return currentServiceKey !== serviceKey
        }),
      ),
    )
    setEditingServiceKey((current) => (current === serviceKey ? null : current))
  }

  const saveGroomingMatrix = async () => {
    if (!ensureCanManagePricing()) return
    const invalidBand = bandDrafts.some((draft) => !draft.label.trim() || parseWeightInput(draft.minWeight) === null)
    if (invalidBand) {
      toast.error('Cần nhập tên hạng cân và min kg cho tất cả các dòng')
      return
    }

    const normalizedServices = spaServiceColumns.map((column) => ({
      ...column,
      packageCode: column.packageCode.trim(),
    }))
    if (normalizedServices.some((column) => !column.packageCode)) {
      toast.error('Tên dịch vụ không được để trống')
      return
    }

    const duplicateServiceNames = new Set<string>()
    for (const column of normalizedServices) {
      const normalizedName = column.packageCode.toLocaleLowerCase()
      if (duplicateServiceNames.has(normalizedName)) {
        toast.error('Tên dịch vụ đang bị trùng')
        return
      }
      duplicateServiceNames.add(normalizedName)
    }

    setIsSavingGrooming(true)
    try {
      const bandIdByKey = new Map<string, string>()
      for (let index = 0; index < bandDrafts.length; index += 1) {
        const draft = bandDrafts[index]
        const savedBand = await pricingApi.upsertWeightBand({
          id: draft.id || undefined,
          serviceType: 'GROOMING',
          species,
          label: draft.label.trim(),
          minWeight: parseWeightInput(draft.minWeight) ?? 0,
          maxWeight: parseWeightInput(draft.maxWeight),
          sortOrder: index,
          isActive: true,
        })
        bandIdByKey.set(draft.key, savedBand.id)
      }

      const rules = bandDrafts.flatMap((band) =>
        normalizedServices.flatMap((column) => {
          const weightBandId = bandIdByKey.get(band.key)
          if (!weightBandId) return []
          const draft = spaDrafts[getSpaRuleKey(band.key, column.key)]
          const price = parseCurrencyInput(draft?.price ?? '')
          if (price === null) return []
          return [{
            id: draft?.id,
            species,
            packageCode: column.packageCode,
            weightBandId,
            price,
            durationMinutes: parseIntegerInput(draft?.durationMinutes ?? ''),
            isActive: true,
          }]
        }),
      )

      await pricingApi.bulkUpsertSpaRules({ species, rules })

      for (const bandId of removedBandIds) {
        await pricingApi.deactivateWeightBand(bandId)
      }

      setRemovedBandIds([])
      invalidatePricing()
      toast.success('Đã lưu bảng giá Grooming')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không lưu được bảng giá Grooming')
    } finally {
      setIsSavingGrooming(false)
    }
  }

  const saveHotelMatrix = () => {
    if (!ensureCanManagePricing()) return
    const invalidBand = bandDrafts.some((draft) => !draft.label.trim() || parseWeightInput(draft.minWeight) === null)
    if (invalidBand) {
      toast.error('Cần nhập tên hạng cân và min kg cho tất cả các dòng')
      return
    }

    setIsSavingHotel(true)
    ;(async () => {
      try {
        const bandIdByKey = new Map<string, string>()
        for (let index = 0; index < bandDrafts.length; index += 1) {
          const draft = bandDrafts[index]
          const savedBand = await pricingApi.upsertWeightBand({
            id: draft.id || undefined,
            serviceType: 'HOTEL',
            species: null,
            label: draft.label.trim(),
            minWeight: parseWeightInput(draft.minWeight) ?? 0,
            maxWeight: parseWeightInput(draft.maxWeight),
            sortOrder: index,
            isActive: true,
          })
          bandIdByKey.set(draft.key, savedBand.id)
        }

        const rules = bandDrafts.flatMap((band) =>
          DAY_TYPE_OPTIONS.flatMap((option) =>
            HOTEL_SPECIES_COLUMNS.flatMap((speciesOption) => {
              const weightBandId = bandIdByKey.get(band.key)
              if (!weightBandId) return []
              const draft = hotelDrafts[getHotelRuleKey(band.key, option.value, speciesOption.value)]
              const fullDayPrice = parseCurrencyInput(draft?.fullDayPrice ?? '')
              if (fullDayPrice === null) return []
              return [{
                id: draft?.id,
                year,
                species: speciesOption.value,
                weightBandId,
                dayType: option.value,
                halfDayPrice: deriveHalfDayPrice(fullDayPrice) ?? undefined,
                fullDayPrice,
                isActive: true,
              }]
            }),
          ),
        )

        if (rules.length === 0) {
          toast.error('Chưa có giá Hotel nào để lưu')
          return
        }

        await pricingApi.bulkUpsertHotelRules(rules)
        for (const bandId of removedBandIds) {
          await pricingApi.deactivateWeightBand(bandId)
        }
        setRemovedBandIds([])
        invalidatePricing()
        toast.success('Đã lưu bảng giá Hotel')
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Không lưu được bảng giá Hotel')
      } finally {
        setIsSavingHotel(false)
      }
    })()
  }

  const updateSpaDraft = (bandKey: string, serviceKey: string, patch: Partial<SpaDraft>) => {
    const key = getSpaRuleKey(bandKey, serviceKey)
    setSpaDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  const updateHotelDraft = (bandId: string, nextDayType: PricingDayType, nextSpecies: string, patch: Partial<HotelDraft>) => {
    const key = getHotelRuleKey(bandId, nextDayType, nextSpecies)
    setHotelDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  const title = mode === 'HOTEL' ? 'Bảng giá Hotel' : 'Spa & Grooming'
  const subtitle =
    mode === 'HOTEL'
      ? 'Tách hạng cân Hotel, giá ngày thường/ngày lễ và lịch ngày lễ để POS/order sinh đúng charge lines.'
      : 'Cấu hình giá theo hạng cân và các gói dịch vụ.'
  const missingCount = mode === 'HOTEL' ? invalidHotelCells : invalidSpaCells
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <section className="hidden">
        {/* Title area hidden as it is moved to Top Header */}
      </section>



      <section className="grid min-h-0 flex-1 gap-4">
        {mode === 'GROOMING' ? (
          <div className="flex flex-col gap-4 min-h-0">
            <GroomingPricingMatrix
              bands={bandDrafts}
              serviceColumns={spaServiceColumns}
              drafts={spaDrafts}
              editingBandKey={editingBandKey}
              editingServiceKey={editingServiceKey}
              onBandChange={updateBandRow}
              onBandEdit={setEditingBandKey}
              onBandRemove={removeBandRow}
              onAddBand={addBandRow}
              onServiceChange={updateSpaServiceColumn}
              onServiceEdit={setEditingServiceKey}
              onServiceRemove={removeSpaServiceColumn}
              onAddService={addSpaServiceColumn}
              onDraftChange={updateSpaDraft}
              onSave={saveGroomingMatrix}
              onCreatePresetBands={() => {
                if (!ensureCanManagePricing()) return
                presetBandsMutation.mutate()
              }}
              isSaving={isSavingGrooming}
              isCreatingPreset={presetBandsMutation.isPending}
              canManagePricing={canManagePricing}
              species={species}
              setSpecies={setSpecies}
            />
          </div>
        ) : (
          <UnifiedHotelPricingPanel
            bands={bandDrafts}
            drafts={hotelDrafts}
            editingBandKey={editingBandKey}
            onBandChange={updateBandRow}
            onBandEdit={setEditingBandKey}
            onBandRemove={removeBandRow}
            onAddBand={addBandRow}
            onDraftChange={updateHotelDraft}
            onSave={saveHotelMatrix}
            onCreatePresetBands={() => {
              if (!ensureCanManagePricing()) return
              presetBandsMutation.mutate()
            }}
            isSaving={isSavingHotel}
            isCreatingPreset={presetBandsMutation.isPending}
            holidays={holidays}
            newHoliday={newHoliday}
            editingHolidayId={editingHolidayId}
            onHolidayDraftChange={updateHolidayDraft}
            onSubmitHoliday={() => {
              if (!ensureCanManagePricing()) return
              if (!newHoliday.startDate || !newHoliday.endDate || !newHoliday.name.trim()) {
                toast.error('Cần nhập khoảng ngày và tên ngày lễ')
                return
              }
              if (newHoliday.endDate < newHoliday.startDate) {
                toast.error('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu')
                return
              }
              const holidayPayload = { ...newHoliday, name: newHoliday.name.trim() }
              if (editingHolidayId) {
                updateHolidayMutation.mutate({ id: editingHolidayId, data: holidayPayload })
                return
              }
              createHolidayMutation.mutate(holidayPayload)
            }}
            onCancelHolidayEdit={resetHolidayDraft}
            onEditHoliday={handleEditHoliday}
            onDeleteHoliday={(id) => {
              if (!ensureCanManagePricing()) return
              deleteHolidayMutation.mutate(id)
            }}
            isSavingHoliday={createHolidayMutation.isPending || updateHolidayMutation.isPending || deleteHolidayMutation.isPending}
            previewForm={previewForm}
            setPreviewForm={setPreviewForm}
            onPreview={() => previewMutation.mutate()}
            preview={previewMutation.data}
            isPreviewing={previewMutation.isPending}
            canManagePricing={canManagePricing}
            permissionHint={permissionError}
          />
        )}
      </section>
    </div>
  )
}

function UnifiedHotelPricingPanel({
  bands,
  drafts,
  editingBandKey,
  onBandChange,
  onBandEdit,
  onBandRemove,
  onAddBand,
  onDraftChange,
  onSave,
  onCreatePresetBands,
  isSaving,
  isCreatingPreset,
  holidays,
  newHoliday,
  editingHolidayId,
  onHolidayDraftChange,
  onSubmitHoliday,
  onCancelHolidayEdit,
  onEditHoliday,
  onDeleteHoliday,
  isSavingHoliday,
  previewForm,
  setPreviewForm,
  onPreview,
  preview,
  isPreviewing,
  canManagePricing,
  permissionHint,
}: {
  bands: BandDraft[]
  drafts: Record<string, HotelDraft>
  editingBandKey: string | null
  onBandChange: (index: number, patch: Partial<BandDraft>) => void
  onBandEdit: (key: string | null) => void
  onBandRemove: (index: number) => void
  onAddBand: () => void
  onDraftChange: (bandId: string, dayType: PricingDayType, species: string, patch: Partial<HotelDraft>) => void
  onSave: () => void
  onCreatePresetBands: () => void
  isSaving: boolean
  isCreatingPreset: boolean
  holidays: HolidayCalendarDate[]
  newHoliday: HolidayDraft
  editingHolidayId: string | null
  onHolidayDraftChange: (patch: Partial<HolidayDraft>) => void
  onSubmitHoliday: () => void
  onCancelHolidayEdit: () => void
  onEditHoliday: (holiday: HolidayCalendarDate) => void
  onDeleteHoliday: (id: string) => void
  isSavingHoliday: boolean
  previewForm: { species: string; weight: string; checkIn: string; checkOut: string }
  setPreviewForm: (value: { species: string; weight: string; checkIn: string; checkOut: string }) => void
  onPreview: () => void
  preview?: Awaited<ReturnType<typeof hotelApi.calculatePrice>>
  isPreviewing: boolean
  canManagePricing: boolean
  permissionHint: string
}) {
  const [isEditMode, setIsEditMode] = useState(false)
  const totalColumns = 1 + HOTEL_SPECIES_COLUMNS.length * DAY_TYPE_OPTIONS.length
  const canEditHotelPricing = canManagePricing && isEditMode
  const aggregatedPreviewLines = preview ? aggregateHotelPreviewLines(preview) : []

  const handleExitEditMode = () => {
    onBandEdit(null)
    onCancelHolidayEdit()
    setIsEditMode(false)
  }

  return (
    <div className="grid min-h-0 gap-4 2xl:grid-cols-[65fr_35fr]">
      <div className="min-h-0 rounded-[28px] border border-border bg-background-secondary/70 p-4">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('closeHotelSettings'))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background-base text-foreground transition-colors hover:bg-background-secondary"
            >
              <ArrowLeft size={16} />
            </button>
            <h3 className="text-lg font-black text-foreground">Bảng giá Hotel</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditHotelPricing ? (
              <button
                type="button"
                onClick={onAddBand}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary-500/35 bg-primary-500/5 px-4 text-sm font-bold text-primary-500 transition-colors hover:bg-primary-500/10"
              >
                <Plus size={15} />
                + Hạng cân
              </button>
            ) : null}

            {canManagePricing ? (
              isEditMode ? (
                <>
                  <button
                    type="button"
                    onClick={handleExitEditMode}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-background-base px-5 text-sm font-bold text-foreground transition-colors hover:bg-background-tertiary"
                  >
                    Xem
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    Lưu bảng giá
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white"
                >
                  <Pencil size={16} />
                  Sửa bảng giá
                </button>
              )
            ) : null}
          </div>
        </div>

        {!canManagePricing ? (
          <p className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
            {permissionHint}
          </p>
        ) : null}

        <div className="custom-scrollbar overflow-auto rounded-2xl border border-border bg-background-base">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-background-secondary">
              <tr>
                <th rowSpan={2} className="w-[300px] border-b border-r border-border bg-background-secondary px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">
                  Hạng cân
                </th>
                {HOTEL_SPECIES_COLUMNS.map((speciesOption, idx) => (
                  <th key={speciesOption.value} colSpan={DAY_TYPE_OPTIONS.length} className={cn('border-b border-border px-3 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted', idx > 0 ? 'border-l' : '')}>
                    {speciesOption.label}
                  </th>
                ))}
              </tr>
              <tr>
                {HOTEL_SPECIES_COLUMNS.flatMap((speciesOption, speciesIdx) =>
                  DAY_TYPE_OPTIONS.map((option, dayIdx) => (
                    <th key={`${speciesOption.value}:${option.value}`} className={cn('w-[150px] border-b border-border px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.14em] text-foreground-muted', speciesIdx > 0 && dayIdx === 0 ? 'border-l' : '')}>
                      {option.label}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {bands.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} className="px-4 py-12 text-center text-sm text-foreground-muted">
                    Chưa có hạng cân. Bấm "+ Hạng cân" để bắt đầu.
                  </td>
                </tr>
              ) : bands.map((band, index) => (
                <tr key={band.key} className="border-b border-border/50 last:border-b-0">
                  <td className="border-b border-r border-border bg-background-secondary/60 px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        {editingBandKey === band.key && canEditHotelPricing ? (
                          <input
                            value={band.label}
                            onChange={(event) => onBandChange(index, { label: event.target.value })}
                            onBlur={() => onBandEdit(null)}
                            autoFocus
                            disabled={!canEditHotelPricing}
                            placeholder="Tên hạng cân"
                            className="h-10 w-full rounded-xl border border-border bg-background-base px-3 text-sm font-bold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                          />
                        ) : (
                          <p className="truncate text-sm font-black text-foreground">{band.label || 'Hạng cân mới'}</p>
                        )}
                        <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-primary-500">
                          {buildServicePricingSku('HOTEL', 'Hotel lưu trú', band.label)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Từ</span>
                          <input
                            value={band.minWeight}
                            onChange={(event) => onBandChange(index, { minWeight: event.target.value })}
                            disabled={!canEditHotelPricing}
                            inputMode="decimal"
                            className="h-9 w-14 rounded-xl border border-border bg-background-base px-2 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Đến</span>
                          <input
                            value={band.maxWeight}
                            onChange={(event) => onBandChange(index, { maxWeight: event.target.value })}
                            disabled={!canEditHotelPricing}
                            inputMode="decimal"
                            placeholder="∞"
                            className="h-9 w-14 rounded-xl border border-border bg-background-base px-2 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                          />
                        </div>
                      </div>

                      {canEditHotelPricing ? (
                        <div className="ml-2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onBandEdit(band.key)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onBandRemove(index)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/10"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {HOTEL_SPECIES_COLUMNS.flatMap((speciesOption, speciesIdx) =>
                    DAY_TYPE_OPTIONS.map((option, dayIdx) => {
                      const draft = drafts[getHotelRuleKey(band.key, option.value, speciesOption.value)] ?? { fullDayPrice: '' }
                      return (
                        <td key={`${band.key}:${speciesOption.value}:${option.value}`} className={cn('border-b border-border px-3 py-3 align-top', speciesIdx > 0 && dayIdx === 0 ? 'border-l' : '')}>
                          <PriceInput
                            value={draft.fullDayPrice}
                            onChange={(value) => onDraftChange(band.key, option.value, speciesOption.value, { fullDayPrice: value })}
                            placeholder="0 / ngày"
                            disabled={!canEditHotelPricing}
                          />
                        </td>
                      )
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <div className="rounded-[28px] border border-border bg-background-secondary/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-black text-foreground">Tính tiền hotel nhanh</h3>
            <button type="button" onClick={onPreview} disabled={isPreviewing} className="h-11 rounded-xl bg-primary-500 px-4 text-sm font-bold text-white disabled:opacity-50 sm:min-w-[110px]">
              Tính
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <label className="grid min-w-[200px] flex-1 gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Khoảng ngày</span>
                <HolidayDateRangeField
                  value={getPreviewDateRangeValue(previewForm)}
                  onChange={(patch) => setPreviewForm(applyPreviewDateRangeValue(previewForm, patch))}
                  disabled={isPreviewing}
                />
              </label>
              <label className="grid w-[120px] shrink-0 gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Giờ check-in</span>
                <input
                  type="time"
                  value={getPreviewTimeValue(previewForm.checkIn, '09:00')}
                  onChange={(event) => setPreviewForm(applyPreviewTimeValue(previewForm, { checkInTime: event.target.value }))}
                  disabled={isPreviewing}
                  className="h-11 rounded-xl border border-border bg-background-base px-2 text-sm text-foreground outline-none focus:border-primary-500 disabled:opacity-50"
                />
              </label>
              <label className="grid w-[120px] shrink-0 gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Giờ check-out</span>
                <input
                  type="time"
                  value={getPreviewTimeValue(previewForm.checkOut, '18:00')}
                  onChange={(event) => setPreviewForm(applyPreviewTimeValue(previewForm, { checkOutTime: event.target.value }))}
                  disabled={isPreviewing}
                  className="h-11 rounded-xl border border-border bg-background-base px-2 text-sm text-foreground outline-none focus:border-primary-500 disabled:opacity-50"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="grid min-w-[180px] flex-1 gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Loài</span>
                <div className="flex rounded-2xl border border-border bg-background-base p-1">
                  {HOTEL_SPECIES_COLUMNS.map((speciesOption) => (
                    <button
                      key={`preview-top-${speciesOption.value}`}
                      type="button"
                      onClick={() => setPreviewForm({ ...previewForm, species: speciesOption.value })}
                      className={cn(
                        'h-10 min-w-0 flex-1 truncate rounded-xl px-2 text-sm font-semibold transition-colors',
                        previewForm.species === speciesOption.value ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground',
                      )}
                    >
                      {speciesOption.label}
                    </button>
                  ))}
                </div>
              </label>
              <label className="grid min-w-[100px] flex-1 gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">Cân nặng</span>
                <input
                  value={previewForm.weight}
                  onChange={(event) => setPreviewForm({ ...previewForm, weight: event.target.value })}
                  placeholder="Kg"
                  className="h-11 rounded-xl border border-border bg-background-base px-3 text-sm text-foreground outline-none focus:border-primary-500"
                />
              </label>
            </div>
          </div>
          {preview ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background-base">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-border bg-background-secondary/60 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.05em] text-foreground-muted">
                <span className="truncate">Dịch vụ</span>
                <span className="shrink-0 text-right">Ngày</span>
                <span className="shrink-0 text-right">Đơn giá</span>
                <span className="shrink-0 text-right">Thành tiền</span>
              </div>
              {aggregatedPreviewLines.map((line, index) => (
                <div key={`preview-top-row-${line.dayType}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-border/70 px-3 py-2.5 text-[11px] last:border-b-0">
                  <span className="truncate font-semibold text-foreground" title={line.label}>{line.label}</span>
                  <span className="shrink-0 text-right tabular-nums text-foreground-muted">{line.quantityDays}</span>
                  <span className="shrink-0 text-right tabular-nums text-foreground-muted">{line.unitPriceLabel}</span>
                  <span className="shrink-0 text-right font-black tabular-nums text-primary-500">{formatCurrency(line.subtotal)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-primary-500/10 px-4 py-3 text-sm font-black text-primary-500">
                <span>Tổng</span>
                <span>{formatCurrency(preview.totalPrice)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <HolidayCalendarPanel
          holidays={holidays}
          newHoliday={newHoliday}
          editingHolidayId={editingHolidayId}
          onHolidayDraftChange={onHolidayDraftChange}
          onSubmitHoliday={onSubmitHoliday}
          onCancelEdit={onCancelHolidayEdit}
          onEditHoliday={onEditHoliday}
          onDeleteHoliday={onDeleteHoliday}
          isSavingHoliday={isSavingHoliday}
          canManagePricing={canManagePricing}
          canEditPricing={canEditHotelPricing}
        />
      </div>
    </div>
  )
}
function PriceInput({ value, onChange, placeholder, disabled = false }: { value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(normalizeCurrencyInput(event.target.value))}
      placeholder={placeholder ?? '0'}
      inputMode="numeric"
      disabled={disabled}
      className={cn(
        'h-11 w-full min-w-[70px] rounded-xl border bg-background-base px-3 text-right text-sm font-bold tabular-nums text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-70',
        value ? 'border-border' : 'border-amber-500/35 bg-amber-500/5',
      )}
    />
  )
}

function GroomingPricingMatrix({
  bands,
  serviceColumns,
  drafts,
  editingBandKey,
  editingServiceKey,
  onBandChange,
  onBandEdit,
  onBandRemove,
  onAddBand,
  onServiceChange,
  onServiceEdit,
  onServiceRemove,
  onAddService,
  onDraftChange,
  onSave,
  onCreatePresetBands,
  isSaving,
  isCreatingPreset,
  canManagePricing,
  species,
  setSpecies,
}: {
  bands: BandDraft[]
  serviceColumns: SpaServiceColumn[]
  drafts: Record<string, SpaDraft>
  editingBandKey: string | null
  editingServiceKey: string | null
  onBandChange: (index: number, patch: Partial<BandDraft>) => void
  onBandEdit: (key: string | null) => void
  onBandRemove: (index: number) => void
  onAddBand: () => void
  onServiceChange: (serviceKey: string, packageCode: string) => void
  onServiceEdit: (key: string | null) => void
  onServiceRemove: (serviceKey: string) => void
  onAddService: () => void
  onDraftChange: (bandKey: string, serviceKey: string, patch: Partial<SpaDraft>) => void
  onSave: () => void
  onCreatePresetBands: () => void
  isSaving: boolean
  isCreatingPreset: boolean
  canManagePricing: boolean
  species: string
  setSpecies: (value: string) => void
}) {
  const [isEditMode, setIsEditMode] = useState(false)
  const totalColumns = Math.max(1, serviceColumns.length * 2 + 1)
  const canEditPricing = canManagePricing && isEditMode

  const handleExitEditMode = () => {
    onBandEdit(null)
    onServiceEdit(null)
    setIsEditMode(false)
  }

  return (
    <div className="min-h-0 rounded-[28px] border border-border bg-background-secondary/70 p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('openGroomingSettings'))}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-background-base text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="inline-flex rounded-2xl border border-border bg-background-base p-1">
            {SPECIES_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSpecies(option.value)}
                className={cn(
                  'h-10 rounded-xl px-6 text-sm font-semibold transition-colors',
                  species === option.value ? 'bg-primary-500 text-white' : 'text-foreground-muted hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditPricing ? (
            <>
              <button
                type="button"
                onClick={onAddBand}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary-500/35 bg-primary-500/5 px-4 text-sm font-bold text-primary-500 transition-colors hover:bg-primary-500/10"
              >
                <Plus size={15} />
                + Hạng cân
              </button>
              <button
                type="button"
                onClick={onAddService}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-primary-500/35 bg-primary-500/5 px-4 text-sm font-bold text-primary-500 transition-colors hover:bg-primary-500/10"
              >
                <Plus size={15} />
                + Dịch vụ
              </button>
            </>
          ) : null}
          {canManagePricing ? (
            isEditMode ? (
              <>
                <button
                  type="button"
                  onClick={handleExitEditMode}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-background-base px-5 text-sm font-bold text-foreground transition-colors hover:bg-background-tertiary"
                >
                  Xem
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Lưu bảng giá
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-white"
              >
                <Pencil size={16} />
                Sửa bảng giá
              </button>
            )
          ) : null}
        </div>
      </div>

      <div className="custom-scrollbar overflow-auto rounded-2xl border border-border bg-background-base">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-background-secondary">
            <tr>
              <th className="w-auto min-w-[280px] border-b border-r border-border bg-background-secondary px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">
                Hạng cân
              </th>
              {serviceColumns.length === 0 ? (
                <th className="border-b border-border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.14em] text-foreground-muted">
                  Dịch vụ
                </th>
              ) : serviceColumns.map((column) => (
                <th key={column.key} className="border-b border-r border-border px-3 py-3">
                  <div className="flex items-center justify-center gap-2">
                    {editingServiceKey === column.key && canEditPricing ? (
                      <input
                        value={column.packageCode}
                        onChange={(event) => onServiceChange(column.key, event.target.value)}
                        onBlur={() => onServiceEdit(null)}
                        autoFocus
                        disabled={!canEditPricing}
                        placeholder="Tên dịch vụ"
                        className="h-9 w-full min-w-[120px] rounded-xl border border-border bg-background-base px-3 text-sm font-bold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                      />
                    ) : (
                      <span className="truncate text-sm font-black text-foreground">{column.packageCode || 'Dịch vụ mới'}</span>
                    )}
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onServiceEdit(column.key)}
                        disabled={!canEditPricing}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground disabled:opacity-50"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onServiceRemove(column.key)}
                        disabled={!canEditPricing}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bands.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="px-4 py-12 text-center text-sm text-foreground-muted">
                  Chưa có hạng cân. Bấm "+ Hạng cân" để bắt đầu.
                </td>
              </tr>
            ) : bands.map((band, index) => (
              <tr key={band.key} className="border-b border-border/50 last:border-b-0">
                <td className="border-b border-r border-border bg-background-secondary/60 px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    {editingBandKey === band.key && canEditPricing ? (
                      <input
                        value={band.label}
                        onChange={(event) => onBandChange(index, { label: event.target.value })}
                        onBlur={() => onBandEdit(null)}
                        autoFocus
                        disabled={!canEditPricing}
                        placeholder="Tên..."
                        className="h-10 w-[120px] shrink-0 rounded-xl border border-border bg-background-base px-3 text-sm font-bold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                      />
                    ) : (
                      <p className="w-[120px] truncate text-sm font-black text-foreground">{band.label || 'Hạng cân mới'}</p>
                    )}

                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Từ</span>
                      <input
                        value={band.minWeight}
                        onChange={(event) => onBandChange(index, { minWeight: event.target.value })}
                        disabled={!canEditPricing}
                        inputMode="decimal"
                        className="h-9 w-[46px] rounded-xl border border-border bg-background-base px-1 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                      />
                      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">-</span>
                      <input
                        value={band.maxWeight}
                        onChange={(event) => onBandChange(index, { maxWeight: event.target.value })}
                        disabled={!canEditPricing}
                        inputMode="decimal"
                        placeholder="∞"
                        className="h-9 w-[46px] rounded-xl border border-border bg-background-base px-1 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:opacity-60"
                      />
                      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">kg</span>
                    </div>

                    <div className="ml-1 flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onBandEdit(band.key)}
                        disabled={!canEditPricing}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground disabled:opacity-50"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onBandRemove(index)}
                        disabled={!canEditPricing}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </td>

                {serviceColumns.length === 0 ? (
                  <td className="border-b border-border px-4 py-3 text-sm text-foreground-muted">Chưa có dịch vụ nào cho ma trận này.</td>
                ) : serviceColumns.flatMap((column) => {
                  const draft = drafts[getSpaRuleKey(band.key, column.key)] ?? { price: '', durationMinutes: '' }
                  const sku = buildServicePricingSku('SPA', column.packageCode, band.label)
                  return (
                    <td key={`${band.key}:${column.key}`} className="border-b border-r border-border px-2 py-2 align-middle">
                      <div className="mb-1 text-center text-[10px] font-black uppercase tracking-[0.12em] text-primary-500">
                        {sku}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 md:gap-3">
                        <div className="w-[100px] shrink-0">
                          <PriceInput
                            value={draft.price}
                            onChange={(value) => onDraftChange(band.key, column.key, { price: value })}
                            placeholder="0"
                            disabled={!canEditPricing}
                          />
                        </div>
                        <span className="text-[10px] text-foreground-muted sm:text-xs">/</span>
                        <div className="relative w-[64px] shrink-0">
                          <input
                            value={draft.durationMinutes}
                            onChange={(event) => onDraftChange(band.key, column.key, { durationMinutes: event.target.value })}
                            placeholder=""
                            inputMode="numeric"
                            disabled={!canEditPricing}
                            className="block h-11 w-full rounded-xl border border-border bg-background-secondary pl-1.5 pr-7 text-center text-sm font-semibold text-foreground outline-none focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                          />
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-foreground-muted">phút</span>
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
