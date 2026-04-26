'use client'
import Image from 'next/image';

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  Edit,
  FileText,
  History,
  Key,
  MapPin,
  Shield,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useAuthorization } from '@/hooks/useAuthorization'
import { Staff, staffApi, UpdateStaffDto } from '@/lib/api/staff.api'
import { ChangePasswordModal } from '../components/ChangePasswordModal'
import { StaffFormModal } from '../components/StaffFormModal'
import { UpdateStatusModal } from '../components/UpdateStatusModal'
import { StaffDocumentsTab } from './components/StaffDocumentsTab'
import { StaffTimekeepingTab } from './components/StaffTimekeepingTab'
import { StaffSalaryTab } from './components/StaffSalaryTab'
import { StaffHistoryTab } from './components/StaffHistoryTab'
import { PerformanceChart, MonthlyPerformance } from './components/PerformanceChart'
import { api } from '@/lib/api'


type StaffDetailTab = 'OVERVIEW' | 'TIMEKEEPING' | 'SALARY' | 'DOCS' | 'HISTORY'

interface StaffPerformance {
  monthlyRevenue: number
  monthlySpaSessions: number
  monthlyOrders: number
}

interface BranchRole {
  role: string
  branch: string
}

export default function StaffDetailPage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const { hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const canViewStaff = hasPermission('staff.read')
  const canUpdateStaff = hasPermission('staff.update')
  const canDeactivateStaff = hasPermission('staff.deactivate')

  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<StaffDetailTab>('OVERVIEW')
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [roles, setRoles] = useState<any[]>([])

  const [performance, setPerformance] = useState<StaffPerformance>({
    monthlyRevenue: 0,
    monthlySpaSessions: 0,
    monthlyOrders: 0,
  })

  const [performanceChartData, setPerformanceChartData] = useState<MonthlyPerformance[]>([])
  const [branchRoles, setBranchRoles] = useState<BranchRole[]>([])



  const loadStaff = useCallback(async () => {
    if (!username) return

    try {
      setLoading(true)
      const [data, perfData, rolesData, allRolesRes] = await Promise.all([
        staffApi.getById(username),
        staffApi.getPerformance(username).catch(() => null),
        staffApi.getBranchRoles(username).catch(() => []),
        api.get('/roles').catch(() => ({ data: { data: [] } })),
      ])
      setStaff(data)
      if (allRolesRes && (allRolesRes.data?.data || allRolesRes.data)) {
        setRoles(allRolesRes.data.data || allRolesRes.data || [])
      }

      if (perfData) {
        setPerformance({
          monthlyRevenue: perfData.monthlyRevenue || 0,
          monthlySpaSessions: perfData.monthlySpaSessions || 0,
          monthlyOrders: perfData.monthlyOrders || 0,
        })
        if (perfData.chartData) {
          setPerformanceChartData(perfData.chartData)
        }
      }

      setBranchRoles(rolesData)
    } catch (error) {
      console.error(error)
      alert('Không tìm thấy nhân viên')
      router.push('/staff')
    } finally {
      setLoading(false)
    }
  }, [username, router])

  useEffect(() => {
    if (isAuthLoading) return

    if (!canViewStaff) {
      router.replace('/dashboard')
      return
    }

    void loadStaff()
  }, [canViewStaff, isAuthLoading, router, loadStaff])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '--'
    return dayjs(dateStr).format('DD/MM/YYYY')
  }

  const getTenure = (joinDate: string | null | undefined) => {
    if (!joinDate) return '0 tháng'
    const months = dayjs().diff(dayjs(joinDate), 'month')
    return `${months} tháng`
  }

  if (isAuthLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary-500" />
      </div>
    )
  }

  if (!canViewStaff) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Đang chuyển hướng...</div>
  }

  if (!staff) {
    return null
  }

  const canShowActions = canUpdateStaff || canDeactivateStaff

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-8 md:py-8 space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-foreground-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Quay lại</span>
        </button>

        {/* Header Card */}
        <div className="rounded-xl border border-border bg-background-secondary overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="aspect-square w-20 overflow-hidden rounded-2xl border border-border bg-background-tertiary shadow-lg sm:w-24">
                  {staff.avatar ? (
                    <Image src={staff.avatar}
                      alt={staff.fullName}
                      className="h-full w-full cursor-zoom-in object-cover"
                      onClick={() => setPreviewImage(staff.avatar!)}
                      width={400} height={400} unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-background-tertiary to-background text-3xl font-bold text-foreground-muted sm:text-4xl">
                      {staff.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground sm:text-2xl">{staff.fullName}</h1>
                    {(() => {
                      const statusMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
                        WORKING: { label: 'Chính thức', color: 'text-primary-500', bg: 'bg-primary-500/10', border: 'border-primary-500/20' },
                        OFFICIAL: { label: 'Chính thức', color: 'text-primary-500', bg: 'bg-primary-500/10', border: 'border-primary-500/20' },
                        PROBATION: { label: 'Thử việc', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                        LEAVE: { label: 'Tạm nghỉ', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                        LEAVING: { label: 'Sắp nghỉ', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                        RESIGNED: { label: 'Đã nghỉ', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                        QUIT: { label: 'Bỏ việc', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                      }
                      const s = statusMap[staff.status] || statusMap.WORKING
                      return (
                        <span className={`flex items-center gap-1.5 rounded-full border ${s.border} ${s.bg} px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.color.replace('text-', 'bg-')}`} />
                          {s.label}
                        </span>
                      )
                    })()}
                    <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-xs font-bold uppercase text-indigo-400">
                      {staff.employmentType === 'PART_TIME' ? 'PART-TIME' : 'FULL-TIME'}
                    </span>
                  </div>

                  <p className="mb-3 text-sm text-foreground-muted">
                    @{staff.username} · {staff.phone || 'Chưa có SĐT'} ·{' '}
                    <span className="text-foreground">{staff.role?.name || 'Nhân viên'}</span>
                  </p>

                  {canShowActions && (
                    <div className="flex flex-wrap gap-2">
                      {canUpdateStaff && (
                        <>
                          <button
                            onClick={() => setShowUpdateModal(true)}
                            className="btn-outline inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                          >
                            <Edit size={14} />
                            Sửa thông tin
                          </button>
                          <button
                            onClick={() => setShowPasswordModal(true)}
                            className="btn-outline inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                          >
                            <Key size={14} />
                            Đổi pass
                          </button>
                        </>
                      )}
                      {canDeactivateStaff && (
                        <button
                          onClick={() => setShowStatusModal(true)}
                          className="btn-outline inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        >
                          <Shield size={14} />
                          Cập nhật trạng thái
                        </button>
                      )}

                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="rounded-xl border border-border bg-background-secondary px-4 py-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-foreground-muted">
                    <DollarSign size={14} className="text-primary-500" />
                    <span>DOANH SỐ THÁNG</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {formatCurrency(performance.monthlyRevenue)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background-secondary px-4 py-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-foreground-muted">
                    <Activity size={14} className="text-primary-500" />
                    <span>SPA THÁNG</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {performance.monthlySpaSessions} ca
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 border-t border-border">
            <div className="custom-scrollbar flex gap-1 overflow-x-auto">
              {[
                { id: 'OVERVIEW', label: 'Tổng quan', icon: Briefcase },
                { id: 'TIMEKEEPING', label: 'Chấm công', icon: Clock },
                { id: 'SALARY', label: 'Lương & Thưởng', icon: DollarSign },
                { id: 'DOCS', label: 'Tài liệu', icon: FileText },
                { id: 'HISTORY', label: 'Lịch sử', icon: History },
              ].map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as StaffDetailTab)}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-all ${isActive
                      ? 'border-primary-500 text-primary-500'
                      : 'border-transparent text-foreground-muted hover:border-border hover:text-foreground'
                      }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="mt-6">
          {activeTab === 'OVERVIEW' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left Column */}
              <div className="space-y-6 lg:col-span-2">
                {/* Card: Thông tin cơ bản */}
                <div className="rounded-xl border border-border bg-background-secondary p-6">
                  <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
                    <Briefcase size={16} className="text-primary-500" />
                    Thông tin cơ bản
                  </h3>

                  <div className="space-y-4 text-sm">
                    {[
                      { label: 'Vai trò chính', value: staff.role?.name || 'Nhân viên' },
                      { label: 'Ngày sinh', value: formatDate(staff.dob) },
                      { label: 'Email', value: staff.email || '--' },
                      { label: 'SĐT người thân', value: staff.emergencyContactPhone || '--' },
                      { label: 'Số CCCD', value: staff.identityCode || '--' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-foreground-muted">{item.label}:</span>
                        <span className="font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Loại hình:</span>
                      <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-xs font-bold uppercase text-indigo-400">
                        {staff.employmentType === 'PART_TIME' ? 'PART-TIME' : 'FULL-TIME'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card: Hợp đồng & Ca làm */}
                <div className="rounded-xl border border-border bg-background-secondary p-6">
                  <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
                    <Calendar size={16} className="text-blue-500" />
                    Hợp đồng & Ca làm
                  </h3>

                  <div className="space-y-4 text-sm">
                    {[
                      { label: 'Ngày vào làm', value: formatDate(staff.joinDate) },
                      { label: 'Giờ làm việc', value: `${staff.shiftStart || '08:00'} → ${staff.shiftEnd || '17:00'}`, bold: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-foreground-muted">{item.label}:</span>
                        <span className={item.bold ? 'font-bold text-foreground' : 'font-medium text-foreground'}>{item.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Thâm niên:</span>
                      <span className="font-medium text-primary-500">{getTenure(staff.joinDate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Lương cơ bản:</span>
                      <span className="font-bold text-primary-500">
                        {staff.baseSalary ? formatCurrency(staff.baseSalary) : '--'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">% Thưởng Spa:</span>
                      <span className="font-bold text-foreground">
                        {staff.spaCommissionRate ? `${staff.spaCommissionRate}%` : '--%'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">


                {/* Card: Hiệu suất (tháng này) */}
                <div className="rounded-xl border border-border bg-background-secondary p-6">
                  <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
                    <TrendingUp size={16} className="text-primary-500" />
                    Hiệu suất (tháng này)
                  </h3>

                  <div className="space-y-4 text-sm">
                    {[
                      { label: 'Đơn hàng', value: `${performance.monthlyOrders} đơn` },
                      { label: 'Doanh số', value: formatCurrency(performance.monthlyRevenue), primary: true },
                      { label: 'Ca Spa', value: `${performance.monthlySpaSessions} ca` },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-foreground-muted">{item.label}:</span>
                        <span className={`font-bold ${item.primary ? 'text-primary-500' : 'text-foreground'}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Performance Chart */}
              {performanceChartData.length > 0 && (
                <div className="lg:col-span-3">
                  <PerformanceChart data={performanceChartData} />
                </div>
              )}
            </div>
          ) : activeTab === 'TIMEKEEPING' ? (
            staff && <StaffTimekeepingTab userId={staff.id} />
          ) : activeTab === 'SALARY' ? (
            staff && <StaffSalaryTab userId={staff.id} staffName={staff.fullName} />
          ) : activeTab === 'DOCS' ? (
            staff && <StaffDocumentsTab userId={staff.id} />
          ) : activeTab === 'HISTORY' ? (
            staff && <StaffHistoryTab userId={staff.id} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-background-secondary p-12">
              <Activity size={48} className="mb-4 text-foreground-muted/30" />
              <p className="text-lg text-foreground-muted">Tính năng đang được phát triển.</p>
            </div>
          )}
        </div>

        {/* Modals */}
        {showUpdateModal && staff && (
          <StaffFormModal
            isOpen={showUpdateModal}
            onClose={() => setShowUpdateModal(false)}
            initialData={staff}
            roles={roles}
            onSave={async (data) => {
              await staffApi.update(staff.id, data as UpdateStaffDto)
              setShowUpdateModal(false)
              void loadStaff()
            }}
          />
        )}

        {showPasswordModal && staff && (
          <ChangePasswordModal
            staffId={staff.id}
            onClose={() => setShowPasswordModal(false)}
            onSuccess={() => setShowPasswordModal(false)}
          />
        )}

        {showStatusModal && staff && (
          <UpdateStatusModal
            staff={staff}
            onClose={() => setShowStatusModal(false)}
            onSuccess={() => {
              setShowStatusModal(false)
              void loadStaff()
            }}
          />
        )}

        {previewImage && (
          <div
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          >
            <Image src={previewImage}
              alt="Preview"
              className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl" width={400} height={400} unoptimized />
            <button
              className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-white/20"
              onClick={() => setPreviewImage(null)}
            >
              <X size={24} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}