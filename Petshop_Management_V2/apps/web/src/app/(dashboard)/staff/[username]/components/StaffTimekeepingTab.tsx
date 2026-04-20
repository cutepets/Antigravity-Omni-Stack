'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Loader2,
  AlertCircle,
  Clock,
  Calendar as CalendarIcon,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import dayjs from 'dayjs'
import { AttendanceData, staffApi } from '@/lib/api/staff.api'

interface StaffTimekeepingTabProps {
  userId: string
}

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

export function StaffTimekeepingTab({ userId }: StaffTimekeepingTabProps) {
  const [attendance, setAttendance] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true)
      const data = await staffApi.getAttendance(userId, selectedMonth, selectedYear)
      setAttendance(data)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu chấm công')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear, userId])

  useEffect(() => {
    void loadAttendance()
  }, [loadAttendance])

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear((y) => y - 1)
    } else {
      setSelectedMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear((y) => y + 1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}p`
  }

  // Generate calendar days
  const getCalendarDays = () => {
    if (!attendance) return []

    const firstDay = new Date(selectedYear, selectedMonth - 1, 1)
    const lastDay = new Date(selectedYear, selectedMonth, 0)
    const startDayOfWeek = firstDay.getDay() // 0 = Sunday
    const daysInMonth = lastDay.getDate()

    const days = []

    // Empty cells for days before the 1st
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ day: null, hours: 0, hasShift: false })
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const hours = attendance.dailyHours[dateKey] || 0
      days.push({
        day: d,
        hours,
        hasShift: hours > 0,
        isToday: dateKey === dayjs().format('YYYY-MM-DD'),
      })
    }

    return days
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-foreground-muted">
          <Loader2 size={20} className="animate-spin text-primary-500" />
          Đang tải dữ liệu chấm công...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-foreground-muted">
        <AlertCircle size={32} className="text-error" />
        <p>{error}</p>
        <button
          onClick={() => void loadAttendance()}
          className="btn-outline rounded-lg px-4 py-2 text-sm"
        >
          Thử lại
        </button>
      </div>
    )
  }

  const calendarDays = getCalendarDays()

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-background-secondary p-4">
        <button
          onClick={handlePrevMonth}
          className="btn-outline inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-2 text-lg font-bold text-foreground">
          <CalendarIcon size={20} className="text-primary-500" />
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </div>

        <button
          onClick={handleNextMonth}
          className="btn-outline inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Stats Cards */}
      {attendance && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card">
            <div className="mb-2 flex items-center gap-2 text-xs text-foreground-muted">
              <Clock size={14} />
              Tổng ca làm
            </div>
            <div className="text-2xl font-bold text-foreground">{attendance.totalShifts}</div>
            <div className="mt-1 text-xs text-foreground-muted">
              {attendance.completedShifts} hoàn thành · {attendance.openShifts} đang mở
            </div>
          </div>

          <div className="card">
            <div className="mb-2 flex items-center gap-2 text-xs text-foreground-muted">
              <CalendarIcon size={14} />
              Ngày làm việc
            </div>
            <div className="text-2xl font-bold text-primary-500">{attendance.workingDays}</div>
            <div className="mt-1 text-xs text-foreground-muted">
              {formatHours(attendance.totalHours)} tổng giờ
            </div>
          </div>

          <div className="card">
            <div className="mb-2 flex items-center gap-2 text-xs text-foreground-muted">
              <DollarSign size={14} />
              Doanh thu
            </div>
            <div className="text-xl font-bold text-primary-500">
              {formatCurrency(attendance.totalRevenue)}
            </div>
            <div className="mt-1 text-xs text-foreground-muted">
              {attendance.totalShifts > 0 ? formatCurrency(attendance.totalRevenue / attendance.totalShifts) + '/ca' : '--'}
            </div>
          </div>

          <div className="card">
            <div className="mb-2 flex items-center gap-2 text-xs text-foreground-muted">
              <TrendingUp size={14} />
              TB giờ/ca
            </div>
            <div className="text-2xl font-bold text-foreground">
              {attendance.totalShifts > 0
                ? formatHours(attendance.totalHours / attendance.totalShifts)
                : '--'}
            </div>
            <div className="mt-1 text-xs text-foreground-muted">
              {attendance.totalHours > 0 ? `${(attendance.totalHours / Math.max(attendance.workingDays, 1)).toFixed(1)}h/ngày` : '--'}
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="card">
        <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
          <CalendarIcon size={16} className="text-primary-500" />
          Lịch chấm công
        </h3>

        {/* Day headers */}
        <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-foreground-muted">
          <div>CN</div>
          <div>T2</div>
          <div>T3</div>
          <div>T4</div>
          <div>T5</div>
          <div>T6</div>
          <div>T7</div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((dayData, idx) => (
            <div
              key={idx}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-all ${dayData.day === null
                ? 'bg-transparent'
                : dayData.isToday
                  ? 'bg-primary-500/20 text-primary-500 ring-1 ring-primary-500/50'
                  : dayData.hasShift
                    ? 'bg-primary-500/10 text-foreground hover:bg-primary-500/20'
                    : 'bg-background-tertiary/50 text-foreground-muted'
                }`}
            >
              {dayData.day && (
                <>
                  <span className="font-medium">{dayData.day}</span>
                  {dayData.hours > 0 && (
                    <span className="mt-0.5 text-[10px] text-foreground-muted">
                      {formatHours(dayData.hours)}
                    </span>
                  )}
                  {dayData.isToday && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary-500" />
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-foreground-muted">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-primary-500/20 ring-1 ring-primary-500/50" />
            Hôm nay
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-primary-500/10" />
            Có ca làm
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-background-tertiary/50" />
            Không có ca
          </div>
        </div>
      </div>

      {/* Shift Sessions List */}
      {attendance && attendance.shifts.length > 0 && (
        <div className="card">
          <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
            <Clock size={16} className="text-primary-500" />
            Danh sách ca làm ({attendance.shifts.length})
          </h3>

          <div className="space-y-3">
            {attendance.shifts.slice(0, 10).map((shift) => (
              <div
                key={shift.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background-tertiary/50 p-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${shift.closedAt
                      ? 'bg-primary-500/10 text-primary-500'
                      : 'bg-amber-500/10 text-amber-500'
                      }`}
                  >
                    {shift.closedAt ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>

                  <div>
                    <p className="font-medium text-foreground">
                      {dayjs(shift.openedAt).format('DD/MM/YYYY')}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {dayjs(shift.openedAt).format('HH:mm')}
                      {shift.closedAt && ` - ${dayjs(shift.closedAt).format('HH:mm')}`}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {shift.orderCount} đơn hàng
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {formatCurrency(shift.collectedAmount)}
                  </p>
                </div>
              </div>
            ))}

            {attendance.shifts.length > 10 && (
              <p className="text-center text-sm text-foreground-muted">
                Hiển thị 10 ca gần nhất · Tổng {attendance.shifts.length} ca
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
