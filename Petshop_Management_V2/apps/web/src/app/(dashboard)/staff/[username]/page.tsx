'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Staff, staffApi } from '@/lib/api/staff.api'
import { ArrowLeft, User, Phone, Mail, Calendar, MapPin, Briefcase, DollarSign, Clock, Shield, Edit, Key, Activity, HeartPulse, X } from 'lucide-react'
import { UpdateStaffModal } from '../components/UpdateStaffModal'
import { ChangePasswordModal } from '../components/ChangePasswordModal'
import { UpdateStatusModal } from '../components/UpdateStatusModal'

export default function StaffDetailPage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CONTRACTS' | 'ACTIVITY'>('OVERVIEW')

  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const loadStaff = () => {
    if (username) {
      staffApi.getById(username)
        .then(setStaff)
        .catch(err => {
          console.error(err)
          alert('Không tìm thấy nhân viên')
          router.push('/staff')
        })
        .finally(() => setLoading(false))
    }
  }

  useEffect(() => {
    loadStaff()
  }, [username, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F111A]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2A2D3C] border-t-[#00E5B5]" />
      </div>
    )
  }

  if (!staff) return null

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto min-h-screen bg-[#0F111A]">
      <button 
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
      </button>

      {/* Header Profile Card */}
      <div className="flex flex-col md:flex-row items-start gap-6 border-b border-white/5 pb-8">
        <div className="w-32 aspect-[2/3] rounded-2xl bg-[#1A1D27] overflow-hidden flex-shrink-0 shadow-lg border border-white/5">
          {staff.avatar ? (
            <img 
              src={staff.avatar} 
              alt={staff.fullName} 
              className="w-full h-full object-cover cursor-zoom-in" 
              onClick={() => setPreviewImage(staff.avatar!)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-500 bg-gradient-to-br from-[#2A2D3C] to-[#1A1D27]">
              {staff.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center pt-2">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{staff.fullName}</h1>
            {staff.status === 'WORKING' && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#00E5B5]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#00E5B5] border border-[#00E5B5]/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00E5B5]" /> Đang làm
              </span>
            )}
            <span className="rounded-md bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-bold text-[#818cf8] uppercase border border-[#6366f1]/20">
              {staff.employmentType === 'PART_TIME' ? 'PART-TIME' : 'FULL-TIME'}
            </span>
          </div>
          
          <p className="text-gray-400 text-sm mb-4">
            @{staff.username} · {staff.phone || 'Chưa có SĐT'} · <span className="text-gray-300">{staff.role?.name || 'Nhân viên'}</span>
          </p>
          
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setShowUpdateModal(true)}
              className="flex items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors border border-white/5"
            >
              <Edit size={14} /> Sửa thông tin
            </button>
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors border border-white/5"
            >
              <Key size={14} /> Đổi pass
            </button>
            <button 
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors border border-white/5"
            >
              <Shield size={14} /> Trạng thái
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-6 border-b border-white/5 overflow-x-auto custom-scrollbar">
        {[
          { id: 'OVERVIEW', label: 'Tổng quan', icon: <Briefcase size={14} /> },
          { id: 'TIMEKEEPING', label: 'Chấm công', icon: <Clock size={14} /> },
          { id: 'SALARY', label: 'Lương & Thưởng', icon: <DollarSign size={14} /> },
          { id: 'DOCS', label: 'Tài liệu', icon: <Mail size={14} /> },
          { id: 'HISTORY', label: 'Lịch sử', icon: <Activity size={14} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 py-4 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id 
              ? 'border-[#00E5B5] text-[#00E5B5]' 
              : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/20'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column */}
            <div className="space-y-6">
              
              {/* Basic Info */}
              <div className="rounded-2xl bg-[#1A1D27] p-6 border border-white/5">
                <h3 className="text-[15px] font-bold text-white mb-6 flex items-center gap-2">
                  <Briefcase size={16} className="text-[#00D4FF]" />
                  Thông tin cơ bản
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Vai trò chính:</span>
                    <span className="text-white font-medium">{staff.role?.name || 'Nhân viên'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Loại hình:</span>
                    <span className="rounded-md bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-bold text-[#818cf8] uppercase border border-[#6366f1]/20">
                      {staff.employmentType === 'PART_TIME' ? 'PART-TIME' : 'FULL-TIME'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Ngày sinh:</span>
                    <span className="text-white font-medium">{staff.dob ? new Date(staff.dob).toLocaleDateString('vi-VN') : '--'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Email:</span>
                    <span className="text-white font-medium">{staff.email || '--'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">SĐT người thân:</span>
                    <span className="text-white font-medium">{staff.emergencyContactPhone || '--'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Số CCCD:</span>
                    <span className="text-white font-medium">{staff.identityCode || '--'}</span>
                  </div>
                </div>
              </div>

              {/* Contract & Shifts */}
              <div className="rounded-2xl bg-[#1A1D27] p-6 border border-white/5">
                <h3 className="text-[15px] font-bold text-white mb-6 flex items-center gap-2">
                  <Calendar size={16} className="text-[#3B82F6]" />
                  Hợp đồng & Ca làm
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Ngày vào làm:</span>
                    <span className="text-white font-medium">{staff.joinDate ? new Date(staff.joinDate).toLocaleDateString('vi-VN') : '--'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Thâm niên:</span>
                    <span className="text-[#00E5B5] font-medium">0 tháng</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Giờ làm việc:</span>
                    <span className="text-white font-bold">{staff.shiftStart || '08:00'} → {staff.shiftEnd || '17:00'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Chi nhánh chính:</span>
                    <span className="text-gray-400">Chưa gán</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Lương cơ bản:</span>
                    <span className="text-[#00E5B5] font-bold">{staff.baseSalary ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(staff.baseSalary) : '--'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">% Thưởng Spa:</span>
                    <span className="text-white font-bold">{staff.spaCommissionRate ? `${staff.spaCommissionRate}%` : '--%'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column */}
            <div className="space-y-6">
              
              {/* Working Status */}
              <div className="rounded-2xl bg-[#1A1D27] p-6 border border-white/5">
                <h3 className="text-[15px] font-bold text-white mb-6 flex items-center gap-2">
                  <Shield size={16} className="text-amber-400" />
                  Trạng thái làm việc
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="rounded-lg bg-[#00E5B5]/5 border border-[#00E5B5]/10 p-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#00E5B5]" />
                    <span className="text-[#00E5B5] font-bold">Đang làm</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-gray-500">Đăng nhập lần cuối:</span>
                    <span className="text-white font-medium">Chưa đăng nhập</span>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="rounded-2xl bg-[#1A1D27] p-6 border border-white/5">
                <h3 className="text-[15px] font-bold text-white mb-6 flex items-center gap-2">
                  <HeartPulse size={16} className="text-[#00E5B5]" />
                  Hiệu suất (tháng này)
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Đơn hàng:</span>
                    <span className="text-white font-bold">0 đơn</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Doanh số:</span>
                    <span className="text-[#00E5B5] font-bold">0 ₫</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Ca Spa:</span>
                    <span className="text-white font-bold">0 ca</span>
                  </div>
                </div>
              </div>
              
            </div>
            
          </div>
        )}

        {activeTab !== 'OVERVIEW' && (
          <div className="flex flex-col items-center justify-center p-12 rounded-2xl bg-[#1A1D27] border border-white/5">
            <Activity size={48} className="text-[#2A2D3C] mb-4" />
            <p className="text-gray-400 text-lg">Tính năng đang được phát triển.</p>
          </div>
        )}
      </div>

      {showUpdateModal && (
        <UpdateStaffModal 
          staff={staff} 
          onClose={() => setShowUpdateModal(false)} 
          onSuccess={() => {
            setShowUpdateModal(false)
            loadStaff()
          }} 
        />
      )}

      {showPasswordModal && (
        <ChangePasswordModal 
          staffId={staff.id} 
          onClose={() => setShowPasswordModal(false)} 
          onSuccess={() => {
            setShowPasswordModal(false)
          }} 
        />
      )}

      {showStatusModal && (
        <UpdateStatusModal 
          staff={staff} 
          onClose={() => setShowStatusModal(false)} 
          onSuccess={() => {
            setShowStatusModal(false)
            loadStaff()
          }} 
        />
      )}

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
          />
          <button 
            className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-white/20 transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
