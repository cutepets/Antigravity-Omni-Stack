'use client'

import * as Popover from '@radix-ui/react-popover'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import {
  Calculator,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Hotel,
  RefreshCw,
  X,
} from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { hotelApi } from '@/lib/api/hotel.api'
import { pricingApi, type HolidayCalendarDate } from '@/lib/api/pricing.api'
import { cn, formatCurrency } from '@/lib/utils'

type HotelQuickPreviewToolProps = {
  triggerClassName?: string
  triggerLabelClassName?: string
  panelClassName?: string
  buttonLabel?: string
}

type HotelQuickPreviewForm = {
  species: string
  weight: string
  checkIn: string
  checkOut: string
}

type HotelQuickPreviewResult = Awaited<ReturnType<typeof hotelApi.calculatePrice>>

const SPECIES_OPTIONS = [
  { value: 'Chó', label: 'Chó' },
  { value: 'Mèo', label: 'Mèo' },
]

const WINDOW_PADDING = 16

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function toDateTimeLocalValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16)
}

function toDateInputValue(value: Date) {
  return toDateTimeLocalValue(value).slice(0, 10)
}

function parseDateInputValue(value: string) {
  const [year, month, day] = String(value ?? '').split('-').map(Number)
  return new Date(year, Math.max(0, (month ?? 1) - 1), day ?? 1)
}

function getMonthTitle(date: Date) {
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
}

function getPreviewTimeValue(value: string, fallback: string) {
  const time = value.split('T')[1]?.slice(0, 5)
  return time && /^\d{2}:\d{2}$/.test(time) ? time : fallback
}

function parseWeightInput(value: string) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.')
  if (!normalized) return null
  const parsedValue = Number(normalized)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function getWeightBandLabel(line: HotelQuickPreviewResult['chargeLines'][number], preview?: HotelQuickPreviewResult) {
  const snapshot = line.pricingSnapshot as Record<string, unknown> | undefined
  return String(snapshot?.weightBandLabel ?? preview?.weightBand?.label ?? 'theo cân nặng')
}

function aggregatePreviewLines(preview: HotelQuickPreviewResult) {
  return [...preview.chargeLines]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((line) => {
      const snapshot = line.pricingSnapshot as Record<string, unknown> | undefined
      const weightBandLabel = getWeightBandLabel(line, preview)
      const holidayName = String(snapshot?.holidayName ?? '').trim()
      const fullDayPrice = Number(snapshot?.fullDayPrice)
      const label = line.dayType === 'HOLIDAY'
        ? holidayName
          ? `Hotel ng\u00E0y l\u1EC5 ${holidayName} - ${weightBandLabel}`
          : `Hotel ng\u00E0y l\u1EC5 - ${weightBandLabel}`
        : `Hotel ${weightBandLabel}`

      return {
        ...line,
        label,
        unitPriceLabel: formatCurrency(Number.isFinite(fullDayPrice) ? fullDayPrice : line.unitPrice),
        quantityDays: Math.round(line.quantityDays * 10) / 10,
        subtotal: Math.round(line.subtotal),
      }
    })
}

function buildInitialForm(): HotelQuickPreviewForm {
  return {
    species: SPECIES_OPTIONS[0]?.value ?? 'Chó',
    weight: '5',
    checkIn: `${toDateInputValue(new Date())}T09:00`,
    checkOut: `${toDateInputValue(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))}T18:00`,
  }
}

function HotelQuickPreviewDateTimeRangeField({
  checkIn,
  checkOut,
  onChange,
  disabled,
}: {
  checkIn: string
  checkOut: string
  onChange: (patch: { checkIn: string; checkOut: string }) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ checkIn, checkOut })
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseDateInputValue(checkIn.slice(0, 10))))
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

  useEffect(() => {
    if (!open) return
    setDraft({ checkIn, checkOut })
    setVisibleMonth(startOfMonth(parseDateInputValue(checkIn.slice(0, 10))))
  }, [checkIn, checkOut, open])

  const applyRange = (nextStart: Date, nextEnd: Date) => {
    setDraft((current) => ({
      ...current,
      checkIn: `${toDateInputValue(nextStart)}T${getPreviewTimeValue(current.checkIn, '09:00')}`,
      checkOut: `${toDateInputValue(nextEnd)}T${getPreviewTimeValue(current.checkOut, '18:00')}`,
    }))
  }

  const handlePickDate = (pickedDate: Date) => {
    const normalizedDate = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate())
    const currentStartDate = draft.checkIn.slice(0, 10)
    const currentEndDate = draft.checkOut.slice(0, 10)

    if (!currentStartDate || (currentStartDate && currentEndDate && currentStartDate !== currentEndDate)) {
      applyRange(normalizedDate, normalizedDate)
      return
    }

    const currentStart = parseDateInputValue(currentStartDate)
    if (normalizedDate < currentStart) {
      applyRange(normalizedDate, currentStart)
      return
    }

    applyRange(currentStart, normalizedDate)
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

  const formatDisplay = (start: string, end: string) => {
    try {
      const [startDate, startTimeRaw] = start.split('T')
      const [endDate, endTimeRaw] = end.split('T')
      const startTime = startTimeRaw.slice(0, 5)
      const endTime = endTimeRaw.slice(0, 5)
      return `${startTime} ${startDate.split('-').reverse().join('/')} - ${endTime} ${endDate.split('-').reverse().join('/')}`
    } catch {
      return ''
    }
  }

  const startDate = parseDateInputValue(draft.checkIn.slice(0, 10))
  const endDate = parseDateInputValue(draft.checkOut.slice(0, 10))
  const hasPendingStart = draft.checkIn.slice(0, 10) === draft.checkOut.slice(0, 10)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background-base px-4 text-left outline-none transition-colors hover:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="truncate text-sm font-bold text-foreground">{formatDisplay(checkIn, checkOut)}</span>
          <CalendarDays size={16} className="shrink-0 text-foreground-muted" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-130 w-[min(92vw,720px)] rounded-[20px] border border-border bg-background-secondary p-5 shadow-lg"
        >
          <div className="flex flex-col gap-5 lg:flex-row">
            <div className="min-w-0 flex-1">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background-base text-foreground-muted transition-colors hover:text-foreground"
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="text-sm font-black text-foreground">{getMonthTitle(visibleMonth)}</p>
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
                  <div key={`${visibleMonth.toISOString()}-${day}`} className="py-1 text-center text-xs font-semibold text-foreground-muted">
                    {day}
                  </div>
                ))}

                {buildCalendarDays(visibleMonth).map((day) => {
                  const inVisibleMonth = isSameMonth(day, visibleMonth)
                  const isStart = isSameDay(day, startDate)
                  const isEnd = isSameDay(day, endDate)
                  const inRange = hasPendingStart ? isStart : !isBefore(day, startDate) && !isAfter(day, endDate)

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => handlePickDate(day)}
                      className={cn(
                        'h-9 rounded-xl text-sm font-semibold transition-colors',
                        inVisibleMonth ? 'text-foreground' : 'text-foreground-muted/40',
                        inRange ? 'bg-primary-500/15 text-primary-500' : 'hover:bg-background-base',
                        isStart || isEnd ? 'bg-primary-500 text-white hover:bg-primary-500' : '',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex w-full flex-col gap-4 border-t border-border pt-5 lg:w-[200px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">Check-in</span>
                <div className="relative">
                  <input
                    type="time"
                    value={getPreviewTimeValue(draft.checkIn, '09:00')}
                    onChange={(event) => setDraft((current) => ({ ...current, checkIn: `${current.checkIn.split('T')[0]}T${event.target.value}` }))}
                    className="h-11 w-full rounded-xl border border-border bg-background-base px-4 pr-10 text-sm font-semibold text-foreground outline-none focus:border-primary-500"
                  />
                  <Clock3 size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                </div>
              </label>

              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">Check-out</span>
                <div className="relative">
                  <input
                    type="time"
                    value={getPreviewTimeValue(draft.checkOut, '18:00')}
                    onChange={(event) => setDraft((current) => ({ ...current, checkOut: `${current.checkOut.split('T')[0]}T${event.target.value}` }))}
                    className="h-11 w-full rounded-xl border border-border bg-background-base px-4 pr-10 text-sm font-semibold text-foreground outline-none focus:border-primary-500"
                  />
                  <Clock3 size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                </div>
              </label>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
            <button
              type="button"
              onClick={handlePickToday}
              className="text-sm font-bold text-primary-500 transition-colors hover:text-primary-400"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft)
                setOpen(false)
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary-500 px-8 text-sm font-bold text-white transition-colors hover:bg-primary-400"
            >
              Xong
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function HotelQuickPreviewTool({
  triggerClassName,
  triggerLabelClassName,
  panelClassName,
  buttonLabel = 'Báo giá Hotel',
}: HotelQuickPreviewToolProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [form, setForm] = useState<HotelQuickPreviewForm>(() => buildInitialForm())
  const [position, setPosition] = useState({ x: WINDOW_PADDING, y: WINDOW_PADDING })

  const previewMutation = useMutation({
    mutationFn: async () => {
      const weight = parseWeightInput(form.weight)
      if (weight === null) throw new Error('Cân nặng không hợp lệ')

      const checkInDate = new Date(form.checkIn)
      const checkOutDate = new Date(form.checkOut)
      if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
        throw new Error('Thời gian nhận và trả không hợp lệ')
      }
      if (checkOutDate <= checkInDate) {
        throw new Error('Thời gian trả phải sau thời gian nhận')
      }

      return hotelApi.calculatePrice({
        species: form.species,
        weight,
        checkIn: checkInDate.toISOString(),
        checkOut: checkOutDate.toISOString(),
      })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Không tính thử được giá Hotel')
    },
  })

  const currentYear = new Date().getFullYear()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const holidaysQuery = useQuery({
    queryKey: ['hotel-quick-preview-holidays', currentYear],
    queryFn: () => pricingApi.getHolidays({ year: currentYear, isActive: true }),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  })

  const upcomingHolidays = useMemo(() => {
    const todayStr = new Date().toDateString()
    const todayStart = new Date(todayStr)
    if (!holidaysQuery.data) return []
    return holidaysQuery.data
      .filter((h) => {
        const endDate = h.endDate ? new Date(h.endDate) : new Date(h.date)
        endDate.setHours(23, 59, 59, 999)
        return endDate >= todayStart
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [holidaysQuery.data])

  const aggregatedPreviewLines = useMemo(
    () => (previewMutation.data ? aggregatePreviewLines(previewMutation.data) : []),
    [previewMutation.data],
  )

  const recenterPanel = () => {
    const panel = panelRef.current
    if (!panel) return

    const width = panel.offsetWidth
    const height = panel.offsetHeight
    setPosition({
      x: Math.max(WINDOW_PADDING, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(WINDOW_PADDING, Math.round((window.innerHeight - height) / 2)),
    })
  }

  useLayoutEffect(() => {
    if (!isOpen) return
    const frameId = window.requestAnimationFrame(() => {
      recenterPanel()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      const panel = panelRef.current
      if (!panel) return

      setPosition((current) => {
        const width = panel.offsetWidth
        const height = panel.offsetHeight
        const maxX = Math.max(WINDOW_PADDING, window.innerWidth - width - WINDOW_PADDING)
        const maxY = Math.max(WINDOW_PADDING, window.innerHeight - height - WINDOW_PADDING)
        return {
          x: clamp(current.x, WINDOW_PADDING, maxX),
          y: clamp(current.y, WINDOW_PADDING, maxY),
        }
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (event: PointerEvent) => {
      const dragOffset = dragOffsetRef.current
      const panel = panelRef.current
      if (!dragOffset || !panel) return

      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const maxX = Math.max(WINDOW_PADDING, window.innerWidth - width - WINDOW_PADDING)
      const maxY = Math.max(WINDOW_PADDING, window.innerHeight - height - WINDOW_PADDING)

      setPosition({
        x: clamp(event.clientX - dragOffset.offsetX, WINDOW_PADDING, maxX),
        y: clamp(event.clientY - dragOffset.offsetY, WINDOW_PADDING, maxY),
      })
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      dragOffsetRef.current = null
      document.body.style.removeProperty('user-select')
    }

    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      document.body.style.removeProperty('user-select')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging])

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    const panel = panelRef.current
    if (!panel) return

    dragOffsetRef.current = {
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
    }
    setIsDragging(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-xl border border-primary-500/25 bg-primary-500/10 px-4 text-sm font-bold text-primary-600 transition-colors hover:bg-primary-500/15',
          triggerClassName,
        )}
      >
        <Calculator size={16} />
        <span className={triggerLabelClassName}>{buttonLabel}</span>
      </button>

      {isOpen ? (
        <div className="pointer-events-none fixed inset-0 z-120">
          <div
            ref={panelRef}
            className={cn(
              'pointer-events-auto absolute w-[min(820px,calc(100vw-32px))] overflow-hidden rounded-[24px] border border-border bg-background-secondary shadow-xl',
              panelClassName,
            )}
            style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
          >
            {/* ── Header ── */}
            <div
              onPointerDown={handleDragStart}
              className={cn(
                'flex cursor-grab items-center justify-between border-b border-border bg-background-secondary/80 px-4 py-3 active:cursor-grabbing',
                isDragging ? 'cursor-grabbing' : undefined,
              )}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background-base text-foreground-muted">
                  <Hotel size={16} />
                </span>
                <p className="text-sm font-black text-foreground">Báo giá Hotel + Lịch lễ</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background-base text-foreground-muted transition-colors hover:text-foreground"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── Body: 2 cột ── */}
            <div className="flex gap-3 p-4">
              {/* Left: calculator */}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {/* Input row */}
                <div className="rounded-2xl border border-border bg-background-base p-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black text-foreground">Báo giá Hotel</h3>
                      <button
                        type="button"
                        onClick={() => previewMutation.mutate()}
                        disabled={previewMutation.isPending}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 text-sm font-bold text-white transition-colors hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {previewMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : null}
                        Tính
                      </button>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_56px_148px] gap-2">
                      <label className="grid gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">Thời gian</span>
                        <HotelQuickPreviewDateTimeRangeField
                          checkIn={form.checkIn}
                          checkOut={form.checkOut}
                          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                          disabled={previewMutation.isPending}
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">KG</span>
                        <input
                          value={form.weight}
                          onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))}
                          placeholder="0"
                          disabled={previewMutation.isPending}
                          className="h-11 w-full rounded-xl border border-border bg-background-secondary px-1 text-center text-sm font-bold text-foreground outline-none transition-colors focus:border-primary-500 disabled:opacity-60"
                        />
                      </label>

                      <label className="grid gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">Loài</span>
                        <div className="flex h-11 rounded-xl border border-border bg-background-secondary p-1">
                          {SPECIES_OPTIONS.map((speciesOption) => (
                            <button
                              key={speciesOption.value}
                              type="button"
                              disabled={previewMutation.isPending}
                              onClick={() => setForm((current) => ({ ...current, species: speciesOption.value }))}
                              className={cn(
                                'flex-1 rounded-lg px-2 text-sm font-bold transition-all',
                                form.species === speciesOption.value
                                  ? 'bg-primary-500 text-white shadow-sm'
                                  : 'text-foreground-muted hover:text-foreground',
                              )}
                            >
                              {speciesOption.label}
                            </button>
                          ))}
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Results table — only shown after calculation */}
                {aggregatedPreviewLines.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-border bg-background-base">
                    <div className="grid grid-cols-[minmax(0,1fr)_44px_96px_104px] gap-1 border-b border-border bg-background-secondary/60 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-foreground-muted">
                      <span>Dịch vụ</span>
                      <span className="text-right">Ngày</span>
                      <span className="text-right">Đơn giá</span>
                      <span className="text-right">Thành tiền</span>
                    </div>

                    {aggregatedPreviewLines.map((line, index) => (
                      <div
                        key={`${line.dayType}-${index}`}
                        className="grid grid-cols-[minmax(0,1fr)_44px_96px_104px] items-center gap-1 border-b border-border/60 px-3 py-2 text-sm last:border-b-0"
                      >
                        <span className="truncate font-semibold text-foreground" title={line.label}>{line.label}</span>
                        <span className="text-right tabular-nums text-foreground-muted">{line.quantityDays}</span>
                        <span className="text-right tabular-nums text-foreground-muted">{line.unitPriceLabel}</span>
                        <span className="text-right font-black tabular-nums text-primary-500">{formatCurrency(line.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-border bg-primary-500/10 px-3 py-2 text-sm font-black text-primary-500">
                      <span>Tổng cộng</span>
                      <span>{formatCurrency(previewMutation.data?.totalPrice ?? 0)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: holiday list */}
              <div className="w-auto min-w-[160px] shrink-0">
                <div className="overflow-hidden rounded-2xl border border-border bg-background-base">
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <CalendarDays size={13} className="shrink-0 text-primary-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-foreground">Lịch ngày lễ</span>
                  </div>
                  <div className="custom-scrollbar max-h-[240px] overflow-y-auto">
                    {holidaysQuery.isLoading ? (
                      <p className="px-3 py-6 text-center text-xs text-foreground-muted">Đang tải...</p>
                    ) : upcomingHolidays.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-foreground-muted">Không có ngày lễ sắp tới.</p>
                    ) : upcomingHolidays.map((holiday) => (
                      <HolidayRow key={holiday.id} holiday={holiday} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function HolidayRow({ holiday }: { holiday: HolidayCalendarDate }) {
  const formatDateShort = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-')
    return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`
  }

  const dateLabel = holiday.endDate && holiday.endDate !== holiday.date
    ? `${formatDateShort(holiday.date)} - ${formatDateShort(holiday.endDate)}`
    : formatDateShort(holiday.date)

  return (
    <div className="border-b border-border/60 px-3 py-2.5 last:border-b-0">
      <p className="text-xs font-bold text-foreground leading-snug">{holiday.name}</p>
      <p className="mt-0.5 text-[10px] text-foreground-muted">
        {dateLabel}{holiday.isRecurring ? ' · Hàng năm' : ''}
      </p>
    </div>
  )
}
