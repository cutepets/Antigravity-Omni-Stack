import React, { useState } from 'react'
import { X, UserCircle2, Edit2, Image as ImageIcon, Shield, Upload } from 'lucide-react'
import { staffApi, Staff } from '@/lib/api/staff.api'
import { api } from '@/lib/api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { useQuery } from '@tanstack/react-query'
import { AvatarCropperModal } from './AvatarCropperModal'

interface UpdateStaffModalProps {
  staff: Staff
  onClose: () => void
  onSuccess: () => void
}

export function UpdateStaffModal({ staff, onClose, onSuccess }: UpdateStaffModalProps) {
  const [formData, setFormData] = useState({
    fullName: staff.fullName || '',
    username: staff.username || '', // Note: username usually shouldn't be editable but showing it as disabled or editable
    gender: staff.gender || 'FEMALE',
    employmentType: staff.employmentType || 'FULL_TIME',
    phone: staff.phone || '',
    email: staff.email || '',
    dob: staff.dob ? new Date(staff.dob).toISOString().split('T')[0] : '',
    emergencyContactTitle: staff.emergencyContactTitle || 'Mẹ',
    emergencyContactPhone: staff.emergencyContactPhone || '',
    branchId: staff.branch?.id || (staff as any).branchId || '',
    joinDate: staff.joinDate ? new Date(staff.joinDate).toISOString().split('T')[0] : '',
    baseSalary: staff.baseSalary?.toString() || '',
    shiftStart: staff.shiftStart || '08:00',
    shiftEnd: staff.shiftEnd || '17:00',
    spaCommissionRate: staff.spaCommissionRate?.toString() || '',
    roleId: staff.role?.id || '',
    avatar: staff.avatar || ''
  })
  const [loading, setLoading] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)

  const { data: branches = [] } = useQuery({
    queryKey: ['settings', 'branches'],
    queryFn: async () => {
      const res = await api.get('/settings/branches')
      return res.data.data
    }
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles')
      return res.data.data || res.data || []
    }
  })

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ảnh không được vượt quá 2MB')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string)
        e.target.value = ''
      }
      reader.readAsDataURL(file)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleToggle = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      const payload: any = {
        fullName: formData.fullName,
        gender: formData.gender,
        employmentType: formData.employmentType,
        phone: formData.phone,
        email: formData.email,
        emergencyContactTitle: formData.emergencyContactTitle,
        emergencyContactPhone: formData.emergencyContactPhone,
        shiftStart: formData.shiftStart,
        shiftEnd: formData.shiftEnd,
        role: formData.roleId
      }

      if (formData.dob) payload.dob = formData.dob
      if (formData.joinDate) payload.joinDate = formData.joinDate
      if (formData.baseSalary) payload.baseSalary = Number(formData.baseSalary)
      if (formData.spaCommissionRate) payload.spaCommissionRate = Number(formData.spaCommissionRate)
      if (formData.branchId) payload.branchId = formData.branchId
      if (formData.avatar && formData.avatar !== staff.avatar) payload.avatar = formData.avatar

      await staffApi.update(staff.id, payload)
      toast.success('Cập nhật thông tin thành công')
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error('Có lỗi xảy ra khi cập nhật thông tin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto custom-scrollbar pt-10 pb-10">
      <div className="w-full max-w-4xl rounded-2xl bg-[#13151D] border border-[#2A2D3C] shadow-2xl overflow-hidden flex flex-col h-max my-auto">
        
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 p-5 bg-[#171923]">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <UserCircle2 className="text-[#00D4FF]" size={20} />
            Cập nhật thông tin nhân viên
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* THÔNG TIN NHÂN VIÊN */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                <UserCircle2 size={14} className="text-purple-400" /> THÔNG TIN NHÂN VIÊN
              </h3>
              
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="relative h-[140px] w-[100px] rounded-xl border border-dashed border-[#00D4FF] bg-[#2A2D3C] overflow-hidden group shrink-0 mx-auto md:mx-0">
                  {formData.avatar ? (
                    <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                      <ImageIcon size={24} className="mb-2 opacity-50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 z-10">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-white hover:text-[#00D4FF]">
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                      <Upload size={12} /> Đổi ảnh
                    </label>
                    {formData.avatar && (
                      <button type="button" onClick={() => setCropImageSrc(formData.avatar)} className="flex items-center gap-1.5 text-xs font-medium text-white hover:text-[#00E5B5]">
                        <Edit2 size={12} /> Sửa ảnh
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase">Họ và tên <span className="text-red-500">*</span></label>
                    <input name="fullName" value={formData.fullName} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase">Username <span className="text-red-500">*</span></label>
                    <input name="username" value={formData.username} disabled className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] opacity-70 px-4 py-2.5 text-white focus:outline-none cursor-not-allowed" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase">Giới tính</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleToggle('gender', 'MALE')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${formData.gender === 'MALE' ? 'border-[#00D4FF] bg-[#00D4FF] text-black' : 'border-[#2A2D3C] bg-[#13151D] text-gray-400 hover:text-white'}`}>♂ Nam</button>
                      <button type="button" onClick={() => handleToggle('gender', 'FEMALE')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${formData.gender === 'FEMALE' ? 'border-[#00D4FF] bg-[#00D4FF] text-black' : 'border-[#2A2D3C] bg-[#13151D] text-gray-400 hover:text-white'}`}>♀ Nữ</button>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase">Loại hình</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleToggle('employmentType', 'FULL_TIME')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${formData.employmentType === 'FULL_TIME' ? 'border-[#00D4FF] bg-[#00D4FF] text-black' : 'border-[#2A2D3C] bg-[#13151D] text-gray-400 hover:text-white'}`}>
                        {formData.employmentType === 'FULL_TIME' && <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                        Full-time
                      </button>
                      <button type="button" onClick={() => handleToggle('employmentType', 'PART_TIME')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${formData.employmentType === 'PART_TIME' ? 'border-[#00D4FF] bg-[#00D4FF] text-black' : 'border-[#2A2D3C] bg-[#13151D] text-gray-400 hover:text-white'}`}>
                        {formData.employmentType === 'PART_TIME' && <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                        Part-time
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* THÔNG TIN LIÊN HỆ & CÁ NHÂN */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-5 space-y-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <span className="text-blue-400 text-lg leading-none">📓</span> THÔNG TIN LIÊN HỆ & CÁ NHÂN
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Điện thoại</label>
                  <input name="phone" value={formData.phone} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Email</label>
                  <input name="email" value={formData.email} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Ngày sinh</label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Liên hệ khẩn cấp</label>
                  <div className="flex gap-2">
                    <select name="emergencyContactTitle" value={formData.emergencyContactTitle} onChange={handleChange} className="w-1/3 rounded-lg border border-[#2A2D3C] bg-[#13151D] px-3 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors appearance-none">
                      <option value="Mẹ">Mẹ</option>
                      <option value="Bố">Bố</option>
                      <option value="Vợ">Vợ</option>
                      <option value="Chồng">Chồng</option>
                      <option value="Khác">Khác</option>
                    </select>
                    <input name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} placeholder="Số điện thoại" className="w-2/3 rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* HỢP ĐỒNG & CA LÀM VIỆC */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-5 space-y-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <span className="text-pink-400 text-lg leading-none">💼</span> HỢP ĐỒNG & CA LÀM VIỆC
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Chi nhánh</label>
                  <select name="branchId" value={formData.branchId} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors appearance-none">
                    <option value="">— Chọn —</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Ngày vào làm</label>
                  <input type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Lương cơ bản</label>
                  <div className="relative">
                    <input name="baseSalary" value={formData.baseSalary} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] pl-4 pr-10 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">đ</span>
                  </div>
                </div>
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">% Thưởng Spa</label>
                  <div className="relative">
                    <input name="spaCommissionRate" value={formData.spaCommissionRate} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" placeholder="10" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Giờ vào</label>
                  <input type="time" name="shiftStart" value={formData.shiftStart} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Giờ nghỉ</label>
                  <input type="time" name="shiftEnd" value={formData.shiftEnd} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
              </div>
            </div>

            {/* PHÂN QUYỀN & VAI TRÒ */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-5 space-y-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Shield size={14} className="text-blue-500" /> PHÂN QUYỀN & VAI TRÒ
              </h3>
              
              <div className="grid grid-cols-1">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">
                    VAI TRÒ CHÍNH
                  </label>
                  <select
                    name="roleId"
                    value={formData.roleId}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-3 text-white focus:border-[#00D4FF] focus:outline-none transition-colors appearance-none"
                  >
                    <option value="">— Chọn vai trò —</option>
                    {roles.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-2">
                    <span className="text-gray-500 text-lg leading-none">🏢</span> VAI TRÒ THEO CHI NHÁNH
                  </h4>
                  <button type="button" onClick={() => toast('Tính năng chưa hoàn thiện')} className="text-xs font-semibold text-[#00D4FF] hover:bg-[#00D4FF]/10 px-3 py-1.5 rounded-lg border border-[#00D4FF]/20 transition-colors">
                    + Thêm vai trò
                  </button>
                </div>
                <div className="border border-dashed border-[#2A2D3C] rounded-xl p-6 text-center text-sm text-gray-500">
                  Chưa gán vai trò chi nhánh. Nhấn "+ Thêm vai trò" để bắt đầu.
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 border-t border-white/5 bg-[#171923] p-5 flex items-center justify-between">
          <p className="text-sm text-gray-500">Cập nhật thông tin nhân viên.</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-xl bg-[#00D4FF] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#00D4FF]/80 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,212,255,0.3)]"
              disabled={loading}
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Lưu nhân viên
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {cropImageSrc && (
        <AvatarCropperModal
          isOpen={true}
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropCompleteAction={(croppedBase64) => {
            setFormData(prev => ({ ...prev, avatar: croppedBase64 }))
            setCropImageSrc(null)
          }}
        />
      )}
    </div>
  )
}

