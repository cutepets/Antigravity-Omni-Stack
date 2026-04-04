import React, { useState } from 'react'
import { X, Shield } from 'lucide-react'
import { staffApi, Staff } from '@/lib/api/staff.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'

interface UpdateStatusModalProps {
  staff: Staff
  onClose: () => void
  onSuccess: () => void
}

const STATUS_OPTIONS = [
  { value: 'PROBATION', label: 'Thử việc' },
  { value: 'OFFICIAL', label: 'Chính thức' },
  { value: 'LEAVE', label: 'Tạm nghỉ' },
  { value: 'LEAVING', label: 'Sắp nghỉ' },
  { value: 'RESIGNED', label: 'Đã nghỉ' },
  { value: 'QUIT', label: 'Bỏ việc' }
]

export function UpdateStatusModal({ staff, onClose, onSuccess }: UpdateStatusModalProps) {
  const [status, setStatus] = useState<string>(staff.status === 'WORKING' ? 'OFFICIAL' : staff.status)
  const [expectedLeaveDate, setExpectedLeaveDate] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      // Logic for note/reason could be logged into ActivityLog on the backend
      // Currently backend update only accepts status, we pass it.
      await staffApi.update(staff.id, { status })
      toast.success('Cập nhật trạng thái thành công')
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#13151D] border border-[#2A2D3C] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 p-5 bg-[#1A1D27]">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Shield className="text-[#00D4FF]" size={20} />
            Cập nhật trạng thái
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-2 gap-3">
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`flex items-center justify-between px-4 py-3 border rounded-xl transition-all ${
                      isSelected 
                        ? 'border-orange-500 bg-orange-500/10 text-orange-500 font-medium' 
                        : 'border-[#2A2D3C] bg-[#1A1D27] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {opt.label}
                    {isSelected && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {['LEAVE', 'LEAVING', 'RESIGNED', 'QUIT'].includes(status) && (
              <div className="space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {status === 'LEAVING' ? 'Dự kiến nghỉ vào ngày' : 'Ngày nghỉ'}
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-[#2A2D3C] bg-[#1A1D27] px-4 py-2.5 text-white focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF] transition-all"
                    value={expectedLeaveDate}
                    onChange={(e) => setExpectedLeaveDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Ghi chú (Lưu vào lịch sử)
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[#2A2D3C] bg-[#1A1D27] px-4 py-3 text-white placeholder-gray-500 focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF] transition-all resize-none"
                placeholder="Lý do thay đổi..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-[0.4] rounded-xl bg-transparent py-3 font-semibold text-gray-400 hover:text-white transition-colors"
                disabled={loading}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[#00D4FF] py-3 font-semibold text-black hover:bg-[#00D4FF]/80 transition-colors flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Lưu trạng thái
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

