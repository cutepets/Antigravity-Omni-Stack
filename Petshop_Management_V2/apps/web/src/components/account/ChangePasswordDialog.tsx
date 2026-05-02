'use client'

import React, { useEffect, useState } from 'react'
import { Check, KeyRound, X } from 'lucide-react'
import { staffApi } from '@/lib/api/staff.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'

interface ChangePasswordDialogProps {
  open: boolean
  staffId?: string
  selfUpdate?: boolean
  title?: string
  description?: string
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ChangePasswordDialog({
  open,
  staffId,
  selfUpdate = false,
  title = 'Đổi mật khẩu',
  description,
  onOpenChange,
  onSuccess,
}: ChangePasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConfirmPassword('')
    setLoading(false)
  }, [open])

  if (!open) return null

  const helperText =
    description ??
    (selfUpdate
      ? 'Nhập mật khẩu mới cho tài khoản của bạn.'
      : 'Admin có thể đặt mật khẩu mới mà không cần mật khẩu cũ.')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!password || password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }

    if (!selfUpdate && !staffId) {
      toast.error('Không tìm thấy tài khoản cần đổi mật khẩu')
      return
    }

    try {
      setLoading(true)
      if (selfUpdate) {
        await staffApi.updateSelf({ password })
      } else {
        await staffApi.update(staffId!, { password })
      }
      toast.success('Đổi mật khẩu thành công')
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error('Có lỗi xảy ra khi đổi mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-120 flex items-center justify-center app-modal-overlay px-4 py-6"
      onMouseDown={() => {
        if (!loading) onOpenChange(false)
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background-base shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className="flex items-center justify-between border-b border-border bg-background-secondary px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-500/20 bg-primary-500/10 text-primary-500">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 id="change-password-title" className="text-base font-bold text-foreground-base">
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-background-tertiary hover:text-foreground-base disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="flex gap-3 rounded-xl border border-primary-500/20 bg-primary-500/10 p-4 text-sm text-foreground-secondary">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
            <p>{helperText}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" className="block text-sm font-semibold text-foreground-secondary">
              Mật khẩu mới
            </label>
            <input
              id="new-password"
              type="password"
              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-4 text-sm text-foreground-base outline-none transition-colors placeholder:text-foreground-muted focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Ít nhất 6 ký tự"
              autoComplete="new-password"
              value={password}
              disabled={loading}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-new-password" className="block text-sm font-semibold text-foreground-secondary">
              Xác nhận mật khẩu mới
            </label>
            <input
              id="confirm-new-password"
              type="password"
              className="h-11 w-full rounded-xl border border-border bg-background-secondary px-4 text-sm text-foreground-base outline-none transition-colors placeholder:text-foreground-muted focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              value={confirmPassword}
              disabled={loading}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background-secondary px-5 text-sm font-bold text-foreground-secondary transition-colors hover:bg-background-tertiary hover:text-foreground-base disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-28"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-32"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
