'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Calculator, GripHorizontal, Hotel, RefreshCw, X } from 'lucide-react'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { hotelApi } from '@/lib/api/hotel.api'
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
  const grouped = new Map<string, {
    dayType: HotelQuickPreviewResult['chargeLines'][number]['dayType']
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
      const weightBandLabel = sampleLine ? getWeightBandLabel(sampleLine, preview) : preview.weightBand?.label ?? 'theo cân nặng'
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

function buildInitialForm(): HotelQuickPreviewForm {
  return {
    species: SPECIES_OPTIONS[0]?.value ?? 'Chó',
    weight: '5',
    checkIn: toDateTimeLocalValue(new Date()),
    checkOut: toDateTimeLocalValue(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
  }
}

export function HotelQuickPreviewTool({
  triggerClassName,
  triggerLabelClassName,
  panelClassName,
  buttonLabel = 'Tính thử Hotel',
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

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
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
        <div className="pointer-events-none fixed inset-0 z-[120]">
          <div
            ref={panelRef}
            className={cn(
              'pointer-events-auto absolute w-[min(880px,calc(100vw-32px))] overflow-hidden rounded-[28px] border border-border bg-[#0f172a] text-white shadow-[0_28px_80px_rgba(15,23,42,0.45)]',
              panelClassName,
            )}
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
            }}
          >
            <div
              onPointerDown={handleDragStart}
              className={cn(
                'flex cursor-grab items-center justify-between border-b border-white/10 bg-white/5 px-5 py-4 active:cursor-grabbing',
                isDragging ? 'cursor-grabbing' : undefined,
              )}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                  <Hotel size={18} />
                </span>
                <div>
                  <p className="text-base font-black text-white">Tính thử Hotel</p>
                  <p className="text-xs font-medium text-slate-300">Cửa sổ nổi, có thể kéo để đặt vị trí tiện thao tác.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 sm:inline-flex">
                  <GripHorizontal size={12} />
                  Kéo cửa sổ
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[24px] border border-white/10 bg-[#111c33] p-4">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_180px]">
                    <label className="grid gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Nhận Hotel</span>
                      <input
                        type="datetime-local"
                        value={form.checkIn}
                        onChange={(event) => setForm((current) => ({ ...current, checkIn: event.target.value }))}
                        disabled={previewMutation.isPending}
                        className="h-12 rounded-2xl border border-white/10 bg-[#0b1324] px-4 text-sm font-semibold text-white outline-none transition-colors focus:border-cyan-400"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Kg</span>
                      <input
                        value={form.weight}
                        onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))}
                        placeholder="0"
                        disabled={previewMutation.isPending}
                        className="h-12 rounded-2xl border border-white/10 bg-[#0b1324] px-4 text-center text-sm font-bold text-white outline-none transition-colors focus:border-cyan-400"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Loài</span>
                      <div className="flex h-12 rounded-2xl border border-white/10 bg-[#0b1324] p-1">
                        {SPECIES_OPTIONS.map((speciesOption) => (
                          <button
                            key={speciesOption.value}
                            type="button"
                            disabled={previewMutation.isPending}
                            onClick={() => setForm((current) => ({ ...current, species: speciesOption.value }))}
                            className={cn(
                              'flex-1 rounded-xl px-3 text-sm font-bold transition-all',
                              form.species === speciesOption.value
                                ? 'bg-cyan-400 text-slate-950 shadow-sm'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white',
                            )}
                          >
                            {speciesOption.label}
                          </button>
                        ))}
                      </div>
                    </label>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                    <label className="grid gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Trả Hotel</span>
                      <input
                        type="datetime-local"
                        value={form.checkOut}
                        onChange={(event) => setForm((current) => ({ ...current, checkOut: event.target.value }))}
                        disabled={previewMutation.isPending}
                        className="h-12 rounded-2xl border border-white/10 bg-[#0b1324] px-4 text-sm font-semibold text-white outline-none transition-colors focus:border-cyan-400"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => previewMutation.mutate()}
                      disabled={previewMutation.isPending}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 text-sm font-black text-slate-950 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {previewMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Calculator size={16} />}
                      Tính
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Số ngày</p>
                    <p className="mt-2 text-2xl font-black text-white">{previewMutation.data?.totalDays ?? '--'}</p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Bình quân</p>
                    <p className="mt-2 text-lg font-black text-cyan-300">
                      {previewMutation.data ? formatCurrency(previewMutation.data.averageDailyRate) : '--'}
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tổng tiền</p>
                  <p className="mt-2 text-3xl font-black text-cyan-300">
                    {previewMutation.data ? formatCurrency(previewMutation.data.totalPrice) : '--'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Giá được tính theo bảng giá Hotel hiện hành, đã tách riêng khỏi màn quản lý bảng giá.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#101a30] p-5">
              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1324]">
                <div className="grid grid-cols-[minmax(0,1fr)_60px_120px_130px] gap-3 border-b border-white/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  <span>Dịch vụ</span>
                  <span className="text-right">Ngày</span>
                  <span className="text-right">Đơn giá</span>
                  <span className="text-right">Thành tiền</span>
                </div>

                {aggregatedPreviewLines.length > 0 ? (
                  <>
                    {aggregatedPreviewLines.map((line, index) => (
                      <div
                        key={`${line.dayType}-${index}`}
                        className="grid grid-cols-[minmax(0,1fr)_60px_120px_130px] items-center gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-b-0"
                      >
                        <span className="truncate font-semibold text-white" title={line.label}>{line.label}</span>
                        <span className="text-right tabular-nums text-slate-300">{line.quantityDays}</span>
                        <span className="text-right tabular-nums text-slate-300">{line.unitPriceLabel}</span>
                        <span className="text-right font-black tabular-nums text-cyan-300">{formatCurrency(line.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-300">
                      <span>Tổng cộng</span>
                      <span>{formatCurrency(previewMutation.data?.totalPrice ?? 0)}</span>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    Nhập thời gian, cân nặng và loài rồi bấm <span className="font-bold text-slate-200">Tính</span> để xem bảng tính.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
