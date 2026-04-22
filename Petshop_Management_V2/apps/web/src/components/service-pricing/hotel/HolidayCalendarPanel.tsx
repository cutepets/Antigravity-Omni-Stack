'use client'

import * as Popover from '@radix-ui/react-popover'
import { addDays, addMonths, endOfMonth, endOfWeek, isAfter, isBefore, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { HolidayCalendarDate } from '@/lib/api/pricing.api'
import { cn } from '@/lib/utils'
import {
  formatHolidayRange,
  getMonthTitle,
  parseDateInputValue,
  toDateInputValue,
} from '../shared/pricing-helpers'
import type { HolidayDraft } from '../shared/pricing-types'

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
            <span className="truncate font-medium text-foreground">
              {startDate.toLocaleDateString('vi-VN')} - {endDate.toLocaleDateString('vi-VN')}
            </span>
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

export function HolidayCalendarPanel({
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
      {canEditPricing ? (
        <>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
            <HolidayDateRangeField
              value={newHoliday}
              onChange={onHolidayDraftChange as (patch: { startDate: string; endDate: string }) => void}
              disabled={!canEditPricing}
            />
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
          <div className="mt-2 flex gap-2">
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
          </div>
        </>
      ) : null}

      <div className="custom-scrollbar mt-3 max-h-52 space-y-2 overflow-y-auto">
        {holidays.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-foreground-muted">
            Chưa có kỳ lễ nào trong năm.
          </p>
        ) : holidays.map((holiday) => (
          <div key={holiday.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background-base px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{holiday.name}</p>
              <p className="text-xs text-foreground-muted">
                {formatHolidayRange(holiday)}
                {holiday.isRecurring ? ' · Hàng năm' : ''}
              </p>
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
