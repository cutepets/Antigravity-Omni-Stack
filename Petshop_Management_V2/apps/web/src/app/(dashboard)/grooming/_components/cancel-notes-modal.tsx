import { useState, useEffect } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'

interface CancelNotesModalProps {
  // Legacy props (used by grooming-board.tsx kanban drag-drop cancel)
  session?: any
  onCancel?: () => void
  // New unified props (used by grooming-session-dialog.tsx)
  isOpen?: boolean
  title?: string
  placeholder?: string
  onClose?: () => void
  // Shared
  onConfirm: (notes: string) => void
}

export function CancelNotesModal({
  session,
  onCancel,
  isOpen,
  title,
  placeholder,
  onClose,
  onConfirm,
}: CancelNotesModalProps) {
  const [note, setNote] = useState('')

  // Reset note khi modal mở lại
  useEffect(() => {
    if (isOpen) setNote('')
  }, [isOpen])

  const handleClose = () => {
    setNote('')
    onClose?.() || onCancel?.()
  }

  // Nếu dùng prop isOpen thì phải check — legacy mode (không có isOpen) luôn render
  if (isOpen === false) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={handleClose}>
      <div
        className="w-full max-w-sm border shadow-2xl bg-background border-border rounded-2xl animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-5 border-b border-border">
          <div className="flex items-center justify-center shrink-0 w-10 h-10 border rounded-xl border-error/20 bg-error/10">
            <AlertTriangle size={18} className="text-error" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{title || 'Hủy phiên SPA'}</h3>
            {session?.petName && (
              <p className="mt-0.5 text-xs text-foreground-muted">
                Thú cưng: <span className="font-semibold text-foreground">{session.petName}</span>
              </p>
            )}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <label className="block text-xs font-bold text-foreground-secondary">
            Lý do hủy <span className="font-normal text-foreground-muted">(tùy chọn)</span>
          </label>
          <textarea
            autoFocus
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={placeholder || 'VD: Khách báo hủy, thú cưng bị bệnh...'}
            className="w-full text-sm resize-none form-input"
          />
          <p className="text-[11px] text-foreground-muted">
            Phiên sẽ chuyển sang trạng thái <span className="font-semibold text-error">Đã hủy</span>. Lý do sẽ được lưu vào ghi chú (nếu có).
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-background-secondary/50 rounded-b-2xl">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium transition-colors border max-w-xs border-border rounded-xl hover:bg-background-secondary"
          >
            Quay lại
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(note)
              setNote('')
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white transition-colors bg-error rounded-xl hover:bg-error/90"
          >
            <XCircle size={14} /> Xác nhận hủy
          </button>
        </div>
      </div>
    </div>
  )
}
