'use client'
import Image from 'next/image';

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
  UserCheck,
  X,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useAuthorization } from '@/hooks/useAuthorization'
import { Staff, staffApi, UpdateStaffDto } from '@/lib/api/staff.api'
import { ChangePasswordModal } from '../components/ChangePasswordModal'
import { SelfProfileModal } from '../components/SelfProfileModal'
import { StaffFormModal } from '../components/StaffFormModal'
import { formatShiftTimeRange } from '../components/shift-time'
import { UpdateStatusModal } from '../components/UpdateStatusModal'
import { StaffDocumentsTab } from './components/StaffDocumentsTab'
import { StaffTimekeepingTab } from './components/StaffTimekeepingTab'
import { StaffSalaryTab } from './components/StaffSalaryTab'
import { StaffHistoryTab } from './components/StaffHistoryTab'
import { PerformanceChart, MonthlyPerformance } from './components/PerformanceChart'
import { api, settingsApi } from '@/lib/api'
import { customToast as toast } from '@/components/ui/toast-with-copy'


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

interface BranchOption {
  id: string
  name: string
  address?: string | null
}

export default function StaffDetailPage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const { user, hasPermission, isLoading: isAuthLoading } = useAuthorization()
  const canViewStaff = hasPermission('staff.read')
  const canUpdateStaff = hasPermission('staff.update')
  const canDeactivateStaff = hasPermission('staff.deactivate')
  const isOwnProfileRoute = user?.username === username || user?.id === username

  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<StaffDetailTab>('OVERVIEW')
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showSelfProfileModal, setShowSelfProfileModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])

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
      const [data, perfData, rolesData, allRolesRes, branchData] = await Promise.all([
        isOwnProfileRoute ? staffApi.getSelf() : staffApi.getById(username),
        isOwnProfileRoute ? staffApi.getSelfPerformance().catch(() => null) : staffApi.getPerformance(username).catch(() => null),
        isOwnProfileRoute ? staffApi.getSelfBranchRoles().catch(() => []) : staffApi.getBranchRoles(username).catch(() => []),
        canUpdateStaff ? api.get('/roles').catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        canUpdateStaff ? settingsApi.getBranches().catch(() => []) : Promise.resolve([]),
      ])
      setStaff(data)
      if (allRolesRes && (allRolesRes.data?.data || allRolesRes.data)) {
        setRoles(allRolesRes.data.data || allRolesRes.data || [])
      }
      setBranches(Array.isArray(branchData) ? branchData : [])

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
      toast.error('Không tìm thấy nhân viên')
      router.push('/staff')
    } finally {
      setLoading(false)
    }
  }, [username, isOwnProfileRoute, canUpdateStaff, router])

  useEffect(() => {
    if (isAuthLoading) return

    if (!canViewStaff && !isOwnProfileRoute) {
      router.replace('/dashboard')
      return
    }

    void loadStaff()
  }, [canViewStaff, isAuthLoading, isOwnProfileRoute, router, loadStaff])

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
    if (!joinDate) return '--'

    const startedAt = dayjs(joinDate)
    if (!startedAt.isValid()) return '--'

    const totalMonths = dayjs().startOf('day').diff(startedAt.startOf('day'), 'month')
    if (totalMonths < 0) return '--'

    const years = Math.floor(totalMonths / 12)
    const months = totalMonths % 12
    const parts: string[] = []

    if (years > 0) parts.push(`${years} năm`)
    if (months > 0 || parts.length === 0) parts.push(`${months} tháng`)

    return parts.join(' ')
  }

  if (isAuthLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary-500" />
      </div>
    )
  }

  if (!canViewStaff && !isOwnProfileRoute) {
    return <div className="flex h-64 items-center justify-center text-foreground-muted">Đang chuyển hướng...</div>
  }

  if (!staff) {
    return null
  }

  const isSelfProfile = user?.id === staff.id || user?.username === staff.username
  const canShowActions = isSelfProfile || canUpdateStaff || canDeactivateStaff

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-[852px] flex-col gap-[15px] p-[10px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <Link href="/staff" className="hover:text-primary-500 flex items-center gap-1 transition-colors">
              <ArrowLeft size={16} /> Nhân viên
            </Link>
            <span className="text-border">/</span>
            <span className="font-semibold text-foreground">{staff.fullName}</span>
          </div>

          {canShowActions && (
            <div className="flex items-center gap-2">
              {isSelfProfile && (
                <>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background-secondary text-foreground-muted transition-colors hover:bg-background-tertiary"
                    title="Đổi mật khẩu"
                  >
                    <Key size={16} />
                  </button>
                  <button
                    onClick={() => setShowSelfProfileModal(true)}
                    className="flex h-9 items-center gap-2 rounded-lg bg-primary-500 px-4 text-white transition-colors hover:bg-primary-600"
                  >
                    <Edit size={15} />
                    <span className="text-sm font-medium">Cập nhật cá nhân</span>
                  </button>
                </>
              )}
              {canUpdateStaff && (
                <>
                  {!isSelfProfile && (
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background-secondary text-foreground-muted transition-colors hover:bg-background-tertiary"
                      title="Đổi mật khẩu"
                    >
                      <Key size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setShowUpdateModal(true)}
                    className="flex h-9 items-center gap-2 rounded-lg bg-primary-500 px-4 text-white transition-colors hover:bg-primary-600"
                  >
                    <Edit size={15} />
                    <span className="text-sm font-medium">Sửa thông tin</span>
                  </button>
                </>
              )}
              {canDeactivateStaff && (
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 transition-colors hover:bg-amber-500/20"
                  title="Cập nhật trạng thái"
                >
                  <Shield size={16} />
                </button>
              )}
            </div>
          )}
        </div>

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
              ].filter((tab) => tab.id !== 'TIMEKEEPING' && tab.id !== 'SALARY').map((tab) => {
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
        <div>
          {activeTab === 'OVERVIEW' ? (
            <div className="grid grid-cols-1 gap-[15px] lg:grid-cols-2">
                {/* Card: Thông tin cơ bản */}
                <div className="rounded-xl border border-border bg-background-secondary p-6">
                  <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
                    <Briefcase size={16} className="text-primary-500" />
                    Thông tin cơ bản
                  </h3>

                  <div className="space-y-4 text-sm">
                    {[
                      { label: 'Vai trò chính', value: staff.role?.name || 'Nhân viên' },
                      { label: 'Chi nhánh chính', value: staff.branch?.name || 'Chưa gán' },
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
                      { label: 'Giờ làm việc', value: formatShiftTimeRange(staff.shiftStart, staff.shiftEnd), bold: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-foreground-muted">{item.label}:</span>
                        <span className={item.bold ? 'whitespace-nowrap font-bold text-foreground' : 'font-medium text-foreground'}>{item.value}</span>
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
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">Ngân hàng:</span>
                      <span className="font-medium text-foreground">{staff.salaryBankName || '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">STK nhận lương:</span>
                      <span className="font-mono font-medium text-foreground">{staff.salaryBankAccount || '--'}</span>
                    </div>
                  </div>
                </div>

              {/* Performance Chart */}
              {performanceChartData.length > 0 && (
                <div className="lg:col-span-2">
                  <PerformanceChart data={performanceChartData} />
                </div>
              )}
            </div>
          ) : activeTab === 'TIMEKEEPING' ? (
            staff && <StaffTimekeepingTab userId={staff.id} />
          ) : activeTab === 'SALARY' ? (
            staff && <StaffSalaryTab userId={staff.id} staffName={staff.fullName} />
          ) : activeTab === 'DOCS' ? (
            staff && <StaffDocumentsTab userId={staff.id} isSelfProfile={isSelfProfile} canManageDocuments={canUpdateStaff} />
          ) : activeTab === 'HISTORY' ? (
            staff && <StaffHistoryTab userId={staff.id} isSelfProfile={isSelfProfile} />
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
            branches={branches}
            onSave={async (data) => {
              await staffApi.update(staff.id, data as UpdateStaffDto)
              setShowUpdateModal(false)
              void loadStaff()
            }}
          />
        )}

        {showSelfProfileModal && staff && (
          <SelfProfileModal
            isOpen={showSelfProfileModal}
            staff={staff}
            onClose={() => setShowSelfProfileModal(false)}
            onSave={async (data) => {
              await staffApi.updateSelf(data)
              setShowSelfProfileModal(false)
              void loadStaff()
            }}
          />
        )}

        {showPasswordModal && staff && (
          <ChangePasswordModal
            staffId={staff.id}
            selfUpdate={isSelfProfile}
            onClose={() => setShowPasswordModal(false)}
            onSuccess={() => {
              setShowPasswordModal(false)
              void loadStaff()
            }}
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
            className="fixed inset-0 z-100 flex items-center justify-center app-modal-overlay p-4"
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
