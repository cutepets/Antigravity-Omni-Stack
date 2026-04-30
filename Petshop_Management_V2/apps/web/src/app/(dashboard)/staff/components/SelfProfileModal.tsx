'use client'

import Image from 'next/image'
import React, { useRef, useState } from 'react'
import { Camera, Edit2, Plus, Upload, X } from 'lucide-react'
import { uploadApi } from '@/lib/api'
import { Staff, UpdateSelfStaffDto } from '@/lib/api/staff.api'
import { AvatarCropperModal } from './AvatarCropperModal'

const inputStyle = "w-full rounded-xl border border-border bg-background-elevated px-4 py-3 text-sm text-foreground placeholder-foreground-muted outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all"
const labelStyle = "mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground-muted"

const dataUrlToFile = async (dataUrl: string, fileName: string) => {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], fileName, { type: blob.type || 'image/png' })
}

interface SelfProfileModalProps {
  staff: Staff
  isOpen: boolean
  onClose: () => void
  onSave: (data: UpdateSelfStaffDto) => Promise<void>
}

export function SelfProfileModal({ staff, isOpen, onClose, onSave }: SelfProfileModalProps) {
  const [avatarBase64, setAvatarBase64] = useState<string | null>(staff.avatar || null)
  const [cropImageObj, setCropImageObj] = useState<string | null>(null)
  const [salaryBankName, setSalaryBankName] = useState(staff.salaryBankName || '')
  const [salaryBankAccount, setSalaryBankAccount] = useState(staff.salaryBankAccount || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.addEventListener('load', () => setCropImageObj(reader.result?.toString() || null))
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let avatarUrl = avatarBase64 || undefined
      if (avatarBase64?.startsWith('data:')) {
        const avatarFile = await dataUrlToFile(avatarBase64, `${staff.username}-avatar.png`)
        avatarUrl = await uploadApi.uploadImage(avatarFile, {
          scope: 'staff',
          ownerType: 'STAFF',
          ownerId: staff.id,
          fieldName: 'avatar',
          displayName: staff.fullName,
        })
      }

      await onSave({
        avatar: avatarUrl,
        salaryBankName: salaryBankName || undefined,
        salaryBankAccount: salaryBankAccount || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Không thể cập nhật thông tin cá nhân')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 app-modal-overlay">
      <div className="relative flex max-h-[95vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border/50">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-background px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Cập nhật cá nhân</h2>
            <p className="text-xs text-foreground-muted">Bạn có thể tự cập nhật ảnh đại diện và tài khoản nhận lương.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-foreground-muted transition-colors hover:bg-white/5 hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto p-6">
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-400">
              {error}
            </div>
          ) : null}

          <div className="flex justify-center">
            <div className="relative h-[144px] w-[108px] overflow-hidden rounded-xl ring-4 ring-background-elevated">
              {avatarBase64 ? (
                <Image src={avatarBase64} alt={staff.fullName} className="h-full w-full object-cover" width={400} height={400} unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-background-elevated to-background">
                  <Camera size={32} className="text-foreground-muted" />
                </div>
              )}
              <div className="absolute inset-0 hidden flex-col items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity hover:opacity-100 sm:flex">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-white hover:text-primary-500">
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  <Upload size={12} /> Đổi
                </label>
                {avatarBase64 ? (
                  <button type="button" onClick={() => setCropImageObj(avatarBase64)} className="flex items-center gap-1.5 text-xs font-medium text-white hover:text-primary-400">
                    <Edit2 size={12} /> Sửa
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 rounded-full bg-primary-500 p-2 text-primary-foreground shadow-lg"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelStyle}>Ngân hàng</label>
              <input
                type="text"
                value={salaryBankName}
                onChange={(event) => setSalaryBankName(event.target.value)}
                className={inputStyle}
                placeholder="VD: Vietcombank"
              />
            </div>
            <div>
              <label className={labelStyle}>STK nhận lương</label>
              <input
                type="text"
                inputMode="numeric"
                value={salaryBankAccount}
                onChange={(event) => setSalaryBankAccount(event.target.value.replace(/\D/g, ''))}
                className={inputStyle}
                placeholder="0123456789"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border/50 pt-5">
            <button type="button" onClick={onClose} disabled={loading} className="rounded-xl border border-border/50 bg-background-elevated px-5 py-3 font-medium text-foreground transition-colors hover:bg-background-secondary">
              Đóng
            </button>
            <button type="submit" disabled={loading} className="rounded-xl bg-primary-500 px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-600 disabled:opacity-60">
              {loading ? 'Đang lưu...' : 'Lưu cập nhật'}
            </button>
          </div>
        </form>
      </div>

      {cropImageObj ? (
        <AvatarCropperModal
          isOpen={true}
          onClose={() => setCropImageObj(null)}
          imageSrc={cropImageObj}
          onCropCompleteAction={(base64) => {
            setAvatarBase64(base64)
            setCropImageObj(null)
          }}
        />
      ) : null}
    </div>
  )
}
