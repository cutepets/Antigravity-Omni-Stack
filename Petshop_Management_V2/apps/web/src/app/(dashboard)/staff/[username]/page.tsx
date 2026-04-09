'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  Edit,
  HeartPulse,
  Key,
  Shield,
  X,
} from 'lucide-react'
import { useAuthorization } from '@/hooks/useAuthorization'
import { Staff, staffApi, UpdateStaffDto } from '@/lib/api/staff.api'
import { ChangePasswordModal } from '../components/ChangePasswordModal'
import { StaffFormModal } from '../components/StaffFormModal'
import { UpdateStatusModal } from '../components/UpdateStatusModal'
import { api } from '@/lib/api'

type StaffDetailTab = 'OVERVIEW' | 'TIMEKEEPING' | 'SALARY' | 'DOCS' | 'HISTORY'

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

  useEffect(() => {
    api.get('/roles').then(res => setRoles(res.data.data || res.data || [])).catch(() => {})
  }, [])

  const loadStaff = async () => {
    if (!username) return

    try {
      setLoading(true)
      const data = await staffApi.getById(username)
      setStaff(data)
    } catch (error) {
      console.error(error)
      alert('Không tìm thấy nhân viên')
      router.push('/staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthLoading) return

    if (!canViewStaff) {
      router.replace('/dashboard')
      return
    }

    void loadStaff()
  }, [canViewStaff, isAuthLoading, router, username])

  if (isAuthLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F111A]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2A2D3C] border-t-[#00E5B5]" />
      </div>
    )
  }

  if (!canViewStaff) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang chuyển hướng...</div>
  }

  if (!staff) {
    return null
  }

  const canShowActions = canUpdateStaff || canDeactivateStaff

  return (
    <div className="mx-auto min-h-screen max-w-[1200px] bg-[#0F111A] p-6 md:p-8">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft size={16} />
      </button>

      <div className="flex flex-col items-start gap-6 border-b border-white/5 pb-8 md:flex-row">
        <div className="aspect-[2/3] w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-white/5 bg-[#1A1D27] shadow-lg">
          {staff.avatar ? (
            <img
              src={staff.avatar}
              alt={staff.fullName}
              className="h-full w-full cursor-zoom-in object-cover"
              onClick={() => setPreviewImage(staff.avatar!)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2A2D3C] to-[#1A1D27] text-4xl font-bold text-gray-500">
              {staff.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center pt-2">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{staff.fullName}</h1>
            {staff.status === 'WORKING' ? (
              <span className="flex items-center gap-1.5 rounded-full border border-[#00E5B5]/20 bg-[#00E5B5]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#00E5B5]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00E5B5]" />
                Đang làm
              </span>
            ) : null}
            <span className="rounded-md border border-[#6366f1]/20 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#818cf8]">
              {staff.employmentType === 'PART_TIME' ? 'PART-TIME' : 'FULL-TIME'}
            </span>
          </div>

          <p className="mb-4 text-sm text-gray-400">
            @{staff.username} · {staff.phone || 'Chưa có SĐT'} ·{' '}
            <span className="text-gray-300">{staff.role?.name || 'Nhân viên'}</span>
          </p>

          {canShowActions ? (
            <div className="flex flex-wrap items-center gap-3">
              {canUpdateStaff ? (
                <>
                  <button
                    onClick={() => setShowUpdateModal(true)}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <Edit size={14} />
                    Sửa thông tin
                  </button>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <Key size={14} />
                    Đổi mật khẩu
                  </button>
                </>
              ) : null}

              {canDeactivateStaff ? (
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  <Shield size={14} />
                  Trạng thái
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="custom-scrollbar mt-4 flex gap-6 overflow-x-auto border-b border-white/5">
        {[
          { id: 'OVERVIEW', label: 'Tổng quan', icon: <Briefcase size={14} /> },
          { id: 'TIMEKEEPING', label: 'Chấm công', icon: <Clock size={14} /> },
          { id: 'SALARY', label: 'Lương & Thưởng', icon: <DollarSign size={14} /> },
          { id: 'DOCS', label: 'Tài liệu', icon: <Calendar size={14} /> },
          { id: 'HISTORY', label: 'Lịch sử', icon: <Activity size={14} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as StaffDetailTab)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-4 text-sm font-bold transition-colors ${
              activeTab === tab.id
                ? 'border-[#00E5B5] text-[#00E5B5]'
                : 'border-transparent text-gray-500 hover:border-white/20 hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'OVERVIEW' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-6">
                <h3 className="mb-6 flex items-center gap-2 text-[15px] font-bold text-white">
                  <Briefcase size={16} className="text-[#00D4FF]" />
                  Thông tin cơ bản
                </h3>

                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Vai trò chính:</span>
                    <span className="font-medium text-white">{staff.role?.name || 'Nhân viên'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Loại hình:</span>
                    <span className="rounded-md border border-[#6366f1]/20 bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#818cf8]">
                      {staff.employmentType === 'PART_TIME' ? 'PART-TIME' : 'FULL-TIME'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Ngày sinh:</span>
                    <span className="font-medium text-white">
                      {staff.dob ? new Date(staff.dob).toLocaleDateString('vi-VN') : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Email:</span>
                    <span className="font-medium text-white">{staff.email || '--'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">SĐT người thân:</span>
                    <span className="font-medium text-white">{staff.emergencyContactPhone || '--'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Số CCCD:</span>
                    <span className="font-medium text-white">{staff.identityCode || '--'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-6">
                <h3 className="mb-6 flex items-center gap-2 text-[15px] font-bold text-white">
                  <Calendar size={16} className="text-[#3B82F6]" />
                  Hợp đồng & Ca làm
                </h3>

                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Ngày vào làm:</span>
                    <span className="font-medium text-white">
                      {staff.joinDate ? new Date(staff.joinDate).toLocaleDateString('vi-VN') : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Thâm niên:</span>
                    <span className="font-medium text-[#00E5B5]">0 tháng</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Giờ làm việc:</span>
                    <span className="font-bold text-white">
                      {staff.shiftStart || '08:00'} → {staff.shiftEnd || '17:00'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Chi nhánh chính:</span>
                    <span className="font-medium text-white">{staff.branch?.name || 'Chưa gán'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Lương cơ bản:</span>
                    <span className="font-bold text-[#00E5B5]">
                      {staff.baseSalary
                        ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                            staff.baseSalary,
                          )
                        : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">% Thưởng Spa:</span>
                    <span className="font-bold text-white">
                      {staff.spaCommissionRate ? `${staff.spaCommissionRate}%` : '--%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-6">
                <h3 className="mb-6 flex items-center gap-2 text-[15px] font-bold text-white">
                  <Shield size={16} className="text-amber-400" />
                  Trạng thái làm việc
                </h3>

                <div className="space-y-4 text-sm">
                  <div className="flex items-center gap-2 rounded-lg border border-[#00E5B5]/10 bg-[#00E5B5]/5 p-3">
                    <span className="h-2 w-2 rounded-full bg-[#00E5B5]" />
                    <span className="font-bold text-[#00E5B5]">Đang làm</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-gray-500">Đăng nhập lần cuối:</span>
                    <span className="font-medium text-white">Chưa đăng nhập</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-6">
                <h3 className="mb-6 flex items-center gap-2 text-[15px] font-bold text-white">
                  <HeartPulse size={16} className="text-[#00E5B5]" />
                  Hiệu suất (tháng này)
                </h3>

                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Đơn hàng:</span>
                    <span className="font-bold text-white">0 đơn</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Doanh số:</span>
                    <span className="font-bold text-[#00E5B5]">0 ₫</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Ca Spa:</span>
                    <span className="font-bold text-white">0 ca</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#1A1D27] p-12">
            <Activity size={48} className="mb-4 text-[#2A2D3C]" />
            <p className="text-lg text-gray-400">Tính năng đang được phát triển.</p>
          </div>
        )}
      </div>

      {showUpdateModal && staff ? (
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
      ) : null}

      {showPasswordModal ? (
        <ChangePasswordModal
          staffId={staff.id}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            setShowPasswordModal(false)
          }}
        />
      ) : null}

      {showStatusModal ? (
        <UpdateStatusModal
          staff={staff}
          onClose={() => setShowStatusModal(false)}
          onSuccess={() => {
            setShowStatusModal(false)
            void loadStaff()
          }}
        />
      ) : null}

      {previewImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-white/20"
            onClick={() => setPreviewImage(null)}
          >
            <X size={24} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
