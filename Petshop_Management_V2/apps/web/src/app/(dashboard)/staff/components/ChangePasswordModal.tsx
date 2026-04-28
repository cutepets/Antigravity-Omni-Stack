import React, { useState } from 'react'
import { X, Key } from 'lucide-react'
import { staffApi } from '@/lib/api/staff.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'

interface ChangePasswordModalProps {
  staffId: string
  onClose: () => void
  onSuccess: () => void
}

export function ChangePasswordModal({ staffId, onClose, onSuccess }: ChangePasswordModalProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }

    try {
      setLoading(true)
      await staffApi.update(staffId, { password })
      toast.success('Đổi mật khẩu thành công')
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error('Có lỗi xảy ra khi đổi mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center app-modal-overlay p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#13151D] border border-[#2A2D3C] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 p-5 bg-[#1A1D27]">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Key className="text-[#3B82F6]" size={20} />
            Đổi mật khẩu
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6 rounded-lg bg-blue-900/20 border border-blue-800/50 p-4 flex gap-3 text-sm text-blue-200">
            <span>🔑</span>
            <p>Admin: đặt mật khẩu mới không cần mật khẩu cũ.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Mật khẩu mới</label>
              <input
                type="password"
                className="w-full rounded-lg border border-[#2A2D3C] bg-[#1A1D27] px-4 py-2.5 text-white placeholder-gray-500 focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF] transition-all"
                placeholder="Ít nhất 6 ký tự"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                className="w-full rounded-lg border border-[#2A2D3C] bg-[#1A1D27] px-4 py-2.5 text-white placeholder-gray-500 focus:border-[#00D4FF] focus:outline-none focus:ring-1 focus:ring-[#00D4FF] transition-all"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-[#2A2D3C] bg-[#1A1D27] py-3 font-semibold text-white hover:bg-[#2A2D3C]/80 transition-colors"
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
                    Xác nhận
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

