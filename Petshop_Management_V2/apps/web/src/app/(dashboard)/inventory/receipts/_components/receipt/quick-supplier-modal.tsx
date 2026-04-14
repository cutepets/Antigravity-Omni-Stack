'use client'

import { UserPlus, X } from 'lucide-react'
import type { SupplierQuickForm } from './receipt.types'

interface QuickSupplierModalProps {
  isOpen: boolean
  form: SupplierQuickForm
  isSaving: boolean
  onClose: () => void
  onChange: (field: keyof SupplierQuickForm, value: string) => void
  onSave: () => void
}

export function QuickSupplierModal({
  isOpen,
  form,
  isSaving,
  onClose,
  onChange,
  onSave,
}: QuickSupplierModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <UserPlus size={18} className="text-primary-500" />
            Thêm nhà cung cấp nhanh
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <input
            autoFocus
            type="text"
            className="form-input h-10"
            placeholder="Tên nhà cung cấp"
            value={form.name}
            onChange={(e) => onChange('name', e.target.value)}
          />
          <input
            type="text"
            className="form-input h-10 uppercase"
            placeholder="ID NCC"
            maxLength={4}
            value={form.code}
            onChange={(e) => onChange('code', e.target.value)}
          />
          <input
            type="text"
            className="form-input h-10"
            placeholder="Số điện thoại"
            value={form.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
          <input
            type="email"
            className="form-input h-10"
            placeholder="Email"
            value={form.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
          <input
            type="text"
            className="form-input h-10"
            placeholder="Địa chỉ"
            value={form.address}
            onChange={(e) => onChange('address', e.target.value)}
          />
          <textarea
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            placeholder="Ghi chú"
            value={form.notes}
            onChange={(e) => onChange('notes', e.target.value)}
          />
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline flex-1 rounded-xl py-2.5 text-sm"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="btn-primary flex-1 justify-center rounded-xl py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu & chọn'}
          </button>
        </div>
      </div>
    </div>
  )
}
