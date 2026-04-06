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
    emergencyContactTitle: staff.emergencyContactTitle || 'Máº¹',
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
        toast.error('áº¢nh khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 2MB')
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
      toast.success('Cáº­p nháº­t thÃ´ng tin thÃ nh cÃ´ng')
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error('CÃ³ lá»—i xáº£y ra khi cáº­p nháº­t thÃ´ng tin')
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
            Cáº­p nháº­t thÃ´ng tin nhÃ¢n viÃªn
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* THÃ”NG TIN NHÃ‚N VIÃŠN */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                <UserCircle2 size={14} className="text-purple-400" /> THÃ”NG TIN NHÃ‚N VIÃŠN
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
                      <Upload size={12} /> Äá»•i áº£nh
                    </label>
                    {formData.avatar && (
                      <button type="button" onClick={() => setCropImageSrc(formData.avatar)} className="flex items-center gap-1.5 text-xs font-medium text-white hover:text-[#00E5B5]">
                        <Edit2 size={12} /> Sá»­a áº£nh
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase">Há» vÃ  tÃªn <span className="text-red-500">*</span></label>
                    <input name="fullName" value={formData.fullName} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase">Username <span className="text-red-500">*</span></label>
                    <input name="username" value={formData.username} disabled className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] opacity-70 px-4 py-2.5 text-white focus:outline-none cursor-not-allowed" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase">Giá»›i tÃ­nh</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleToggle('gender', 'MALE')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${formData.gender === 'MALE' ? 'border-[#00D4FF] bg-[#00D4FF] text-black' : 'border-[#2A2D3C] bg-[#13151D] text-gray-400 hover:text-white'}`}>â™‚ Nam</button>
                      <button type="button" onClick={() => handleToggle('gender', 'FEMALE')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${formData.gender === 'FEMALE' ? 'border-[#00D4FF] bg-[#00D4FF] text-black' : 'border-[#2A2D3C] bg-[#13151D] text-gray-400 hover:text-white'}`}>â™€ Ná»¯</button>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase">Loáº¡i hÃ¬nh</label>
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

            {/* THÃ”NG TIN LIÃŠN Há»† & CÃ NHÃ‚N */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-5 space-y-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <span className="text-blue-400 text-lg leading-none">ðŸ““</span> THÃ”NG TIN LIÃŠN Há»† & CÃ NHÃ‚N
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Äiá»‡n thoáº¡i</label>
                  <input name="phone" value={formData.phone} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Email</label>
                  <input name="email" value={formData.email} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">NgÃ y sinh</label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">LiÃªn há»‡ kháº©n cáº¥p</label>
                  <div className="flex gap-2">
                    <select name="emergencyContactTitle" value={formData.emergencyContactTitle} onChange={handleChange} className="w-1/3 rounded-lg border border-[#2A2D3C] bg-[#13151D] px-3 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors appearance-none">
                      <option value="Máº¹">Máº¹</option>
                      <option value="Bá»‘">Bá»‘</option>
                      <option value="Vá»£">Vá»£</option>
                      <option value="Chá»“ng">Chá»“ng</option>
                      <option value="KhÃ¡c">KhÃ¡c</option>
                    </select>
                    <input name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} placeholder="Sá»‘ Ä‘iá»‡n thoáº¡i" className="w-2/3 rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* Há»¢P Äá»’NG & CA LÃ€M VIá»†C */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-5 space-y-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <span className="text-pink-400 text-lg leading-none">ðŸ’¼</span> Há»¢P Äá»’NG & CA LÃ€M VIá»†C
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Chi nhÃ¡nh</label>
                  <select name="branchId" value={formData.branchId} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors appearance-none">
                    <option value="">â€” Chá»n â€”</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">NgÃ y vÃ o lÃ m</label>
                  <input type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">LÆ°Æ¡ng cÆ¡ báº£n</label>
                  <div className="relative">
                    <input name="baseSalary" value={formData.baseSalary} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] pl-4 pr-10 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Ä‘</span>
                  </div>
                </div>
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">% ThÆ°á»Ÿng Spa</label>
                  <div className="relative">
                    <input name="spaCommissionRate" value={formData.spaCommissionRate} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors" placeholder="10" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Giá» vÃ o</label>
                  <input type="time" name="shiftStart" value={formData.shiftStart} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase">Giá» nghá»‰</label>
                  <input type="time" name="shiftEnd" value={formData.shiftEnd} onChange={handleChange} className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none transition-colors [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
              </div>
            </div>

            {/* PHÃ‚N QUYá»€N & VAI TRÃ’ */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1D27] p-5 space-y-5">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Shield size={14} className="text-blue-500" /> PHÃ‚N QUYá»€N & VAI TRÃ’
              </h3>
              
              <div className="grid grid-cols-1">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase mb-2 block">
                    VAI TRÃ’ CHÃNH
                  </label>
                  <select
                    name="roleId"
                    value={formData.roleId}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[#2A2D3C] bg-[#13151D] px-4 py-3 text-white focus:border-[#00D4FF] focus:outline-none transition-colors appearance-none"
                  >
                    <option value="">â€” Chá»n vai trÃ² â€”</option>
                    {roles.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase flex items-center gap-2">
                    <span className="text-gray-500 text-lg leading-none">ðŸ¢</span> VAI TRÃ’ THEO CHI NHÃNH
                  </h4>
                  <button type="button" onClick={() => toast('TÃ­nh nÄƒng chÆ°a hoÃ n thiá»‡n')} className="text-xs font-semibold text-[#00D4FF] hover:bg-[#00D4FF]/10 px-3 py-1.5 rounded-lg border border-[#00D4FF]/20 transition-colors">
                    + ThÃªm vai trÃ²
                  </button>
                </div>
                <div className="border border-dashed border-[#2A2D3C] rounded-xl p-6 text-center text-sm text-gray-500">
                  ChÆ°a gÃ¡n vai trÃ² chi nhÃ¡nh. Nháº¥n &quot;+ ThÃªm vai trÃ²&quot; Ä‘á»ƒ báº¯t Ä‘áº§u.
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 border-t border-white/5 bg-[#171923] p-5 flex items-center justify-between">
          <p className="text-sm text-gray-500">Cáº­p nháº­t thÃ´ng tin nhÃ¢n viÃªn.</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              Há»§y bá»
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
                  LÆ°u nhÃ¢n viÃªn
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

