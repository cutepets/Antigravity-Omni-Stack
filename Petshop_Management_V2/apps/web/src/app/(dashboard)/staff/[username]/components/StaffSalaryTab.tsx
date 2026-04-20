'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Loader2,
  AlertCircle,
  DollarSign,
  Calendar as CalendarIcon,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
} from 'lucide-react'
import dayjs from 'dayjs'
import { SalaryData, staffApi } from '@/lib/api/staff.api'

interface StaffSalaryTabProps {
  userId: string
  staffName?: string
}

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

export function StaffSalaryTab({ userId, staffName }: StaffSalaryTabProps) {
  const [salary, setSalary] = useState<SalaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const loadSalary = useCallback(async () => {
    try {
      setLoading(true)
      const data = await staffApi.getSalary(userId, selectedMonth, selectedYear)
      setSalary(data)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu lương')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear, userId])

  useEffect(() => {
    void loadSalary()
  }, [loadSalary])

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

  const handleExportPayslip = () => {
    if (!salary) return

    // Generate a simple text-based payslip
    const payslip = `
====================================
         BẢNG LƯƠNG NHÂN VIÊN
====================================

Họ tên: ${staffName || '---'}
Tháng: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}

------------------------------------
A. THU NHẬP
------------------------------------
1. Lương cơ bản:        ${formatCurrency(salary.baseSalary)}
   (Thực nhận ${salary.actualWorkingDays}/${salary.expectedWorkingDays} ngày):
                           ${formatCurrency(salary.proRatedBaseSalary)}

2. Hoa hồng (${salary.commission.rate}%):
   - Doanh thu grooming:  ${formatCurrency(salary.commission.groomingRevenue)}
   - ${salary.commission.sessionCount} sessions
   - Hoa hồng nhận được:  ${formatCurrency(salary.commission.amount)}

3. Thưởng:
   - Thưởng chuyên cần:   ${formatCurrency(salary.bonuses.fullAttendance)}
   - Thưởng doanh thu:    ${formatCurrency(salary.bonuses.revenue)}
   → Tổng thưởng:         ${formatCurrency(salary.bonuses.total)}

------------------------------------
B. KHẤU TRỪ
------------------------------------
1. Thiếu hụt quỹ:        ${formatCurrency(salary.deductions.shortages)}

------------------------------------
C. TỔNG KẾT
------------------------------------
Tổng thu nhập:           ${formatCurrency(salary.proRatedBaseSalary + salary.commission.amount + salary.bonuses.total)}
Tổng khấu trừ:           ${formatCurrency(salary.deductions.total)}

═══════════════════════════════════
LƯƠNG THỰC NHẬN:           ${formatCurrency(salary.netSalary)}
═══════════════════════════════════

Thống kê:
- Số ca làm: ${salary.attendance.totalShifts}
- Ca hoàn thành: ${salary.attendance.completedShifts}
- Ngày làm việc: ${salary.attendance.workingDays}
- Tổng giờ: ${salary.attendance.totalHours.toFixed(1)}h

Ngày in: ${dayjs().format('DD/MM/YYYY HH:mm')}
====================================
    `.trim()

    // Download as text file
    const blob = new Blob([payslip], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bang-luong-${staffName?.replace(/\s+/g, '-').toLowerCase() || 'nv'}-${selectedMonth}-${selectedYear}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-foreground-muted">
          <Loader2 size={20} className="animate-spin text-primary-500" />
          Đang tính toán lương...
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
          onClick={() => void loadSalary()}
          className="btn-outline rounded-lg px-4 py-2 text-sm"
        >
          Thử lại
        </button>
      </div>
    )
  }

  if (!salary) return null

  return (
    <div className="space-y-6">
      {/* Month Navigation & Actions */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
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

        <div className="flex gap-2">
          <button
            onClick={handleExportPayslip}
            className="btn-outline inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
          >
            <Download size={14} />
            Xuất bảng lương
          </button>
        </div>
      </div>

      {/* Net Salary Card */}
      <div className="rounded-xl border border-primary-500/20 bg-gradient-to-br from-primary-500/10 to-primary-500/5 p-8 text-center">
        <p className="mb-2 text-sm font-medium text-foreground-muted">LƯƠNG THỰC NHẬN</p>
        <p className="text-4xl font-bold text-primary-500 sm:text-5xl">
          {formatCurrency(salary.netSalary)}
        </p>
        <p className="mt-2 text-xs text-foreground-muted">
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear} · {salary.actualWorkingDays} ngày làm việc
        </p>
      </div>

      {/* Salary Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Income Section */}
        <div className="card">
          <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-primary-500">
            <TrendingUp size={16} />
            A. Thu nhập
          </h3>

          <div className="space-y-4 text-sm">
            {/* Base Salary */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted">Lương cơ bản</span>
                <span className="font-medium text-foreground">{formatCurrency(salary.baseSalary)}</span>
              </div>
              <div className="rounded-lg border border-border bg-background-tertiary/50 p-3 text-xs text-foreground-muted">
                <div className="flex justify-between">
                  <span>Thực nhận ({salary.actualWorkingDays}/{salary.expectedWorkingDays} ngày)</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(salary.proRatedBaseSalary)}
                  </span>
                </div>
              </div>
            </div>

            {/* Commission */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted">
                  Hoa hồng ({salary.commission.rate}%)
                </span>
                <span className="font-medium text-foreground">{formatCurrency(salary.commission.amount)}</span>
              </div>
              <div className="rounded-lg border border-border bg-background-tertiary/50 p-3 text-xs text-foreground-muted">
                <div className="mb-1 flex justify-between">
                  <span>Doanh thu grooming</span>
                  <span>{formatCurrency(salary.commission.groomingRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{salary.commission.sessionCount} sessions</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(salary.commission.amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bonuses */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted">Thưởng</span>
                <span className="font-medium text-foreground">{formatCurrency(salary.bonuses.total)}</span>
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-background-tertiary/50 p-3 text-xs text-foreground-muted">
                <div className="flex justify-between">
                  <span>Chuyên cần</span>
                  <span className={salary.bonuses.fullAttendance > 0 ? 'text-primary-500' : ''}>
                    {formatCurrency(salary.bonuses.fullAttendance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Doanh thu (&gt;50M)</span>
                  <span className={salary.bonuses.revenue > 0 ? 'text-primary-500' : ''}>
                    {formatCurrency(salary.bonuses.revenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Income Total */}
            <div className="border-t border-border pt-3">
              <div className="flex justify-between font-bold text-foreground">
                <span>Tổng thu nhập</span>
                <span className="text-primary-500">
                  {formatCurrency(
                    salary.proRatedBaseSalary + salary.commission.amount + salary.bonuses.total,
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Deductions Section */}
        <div className="card">
          <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-red-500">
            <AlertCircle size={16} />
            B. Khấu trừ
          </h3>

          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted">Thiếu hụt quỹ</span>
                <span className="font-medium text-red-500">
                  {salary.deductions.shortages > 0
                    ? `-${formatCurrency(salary.deductions.shortages)}`
                    : '0 ₫'}
                </span>
              </div>
              {salary.deductions.shortages > 0 && (
                <div className="rounded-lg border border-red-500/10 bg-red-500/5 p-3 text-xs text-foreground-muted">
                  <p>Có thiếu hụt trong ca làm. Vui lòng kiểm tra lại với quản lý.</p>
                </div>
              )}
            </div>

            {/* Deductions Total */}
            <div className="border-t border-border pt-3">
              <div className="flex justify-between font-bold text-foreground">
                <span>Tổng khấu trừ</span>
                <span className="text-red-500">
                  {salary.deductions.total > 0
                    ? `-${formatCurrency(salary.deductions.total)}`
                    : '0 ₫'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="mt-6 card">
            <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
              <CalendarIcon size={16} className="text-primary-500" />
              Thống kê chấm công
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground-muted">Tổng ca làm</p>
                <p className="text-lg font-bold text-foreground">{salary.attendance.totalShifts}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Hoàn thành</p>
                <p className="text-lg font-bold text-primary-500">{salary.attendance.completedShifts}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Ngày làm việc</p>
                <p className="text-lg font-bold text-foreground">{salary.attendance.workingDays}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Tổng giờ</p>
                <p className="text-lg font-bold text-foreground">{salary.attendance.totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formula */}
      <div className="card">
        <h3 className="mb-4 text-sm font-bold text-foreground-muted">CÔNG THỨC TÍNH LƯƠNG</h3>
        <div className="rounded-xl border border-border bg-background-tertiary/50 p-4 font-mono text-sm text-foreground">
          <div className="space-y-2">
            <p>
              Lương thực nhận = Lương cơ bản (pro-rated) + Hoa hồng + Thưởng - Khấu trừ
            </p>
            <p className="text-foreground-muted">
              = {formatCurrency(salary.proRatedBaseSalary)} + {formatCurrency(salary.commission.amount)} +{' '}
              {formatCurrency(salary.bonuses.total)} - {formatCurrency(salary.deductions.total)}
            </p>
            <p className="border-t border-border pt-2 text-lg font-bold text-primary-500">
              = {formatCurrency(salary.netSalary)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
