'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, TriangleAlert, RefreshCw, XCircle } from 'lucide-react'

interface OrderRefundModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (payload: { status: 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED'; reason?: string }) => void
    orderNumber: string
    isPending?: boolean
}

export function OrderRefundModal({
    isOpen,
    onClose,
    onConfirm,
    orderNumber,
    isPending,
}: OrderRefundModalProps) {
    const [reason, setReason] = useState('')
    const [status, setStatus] = useState<'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED'>('FULLY_REFUNDED')

    useEffect(() => {
        if (isOpen) {
            setReason('')
            setStatus('FULLY_REFUNDED')
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleConfirm = () => {
        onConfirm({ status, reason: reason.trim() || undefined })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center app-modal-overlay animate-fade-in">
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <TriangleAlert size={20} className="text-purple-600" />
                        Xác nhận hoàn tiền
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-background-secondary transition-colors">
                        <X size={18} className="text-foreground-muted" />
                    </button>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-foreground-muted leading-relaxed">
                        Cập nhật trạng thái hoàn tiền cho đơn hàng <strong className="text-foreground font-mono">{orderNumber}</strong>. Mọi thay đổi sẽ được lưu vào lịch sử đơn hàng.
                    </p>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setStatus('PARTIALLY_REFUNDED')}
                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3.5 transition-colors ${status === 'PARTIALLY_REFUNDED'
                                ? 'border-purple-500 bg-purple-500/10 text-purple-600 shadow-sm'
                                : 'border-border bg-background-secondary text-foreground-muted hover:bg-background-tertiary hover:border-border/80'
                            }`}
                    >
                        <RefreshCw size={20} strokeWidth={status === 'PARTIALLY_REFUNDED' ? 2.5 : 2} />
                        <span className="text-sm font-semibold">Hoàn một phần</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatus('FULLY_REFUNDED')}
                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3.5 transition-colors ${status === 'FULLY_REFUNDED'
                                ? 'border-purple-500 bg-purple-500/10 text-purple-600 shadow-sm'
                                : 'border-border bg-background-secondary text-foreground-muted hover:bg-background-tertiary hover:border-border/80'
                            }`}
                    >
                        <XCircle size={20} strokeWidth={status === 'FULLY_REFUNDED' ? 2.5 : 2} />
                        <span className="text-sm font-semibold">Đã hoàn đủ</span>
                    </button>
                </div>

                <div className="mb-6">
                    <label className="text-sm font-semibold text-foreground mb-2 block">Lý do hoàn tiền (không bắt buộc)</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ví dụ: Khách trả lại một phần dịch vụ do đổi ý..."
                        rows={3}
                        className="w-full rounded-xl border border-border bg-background-secondary px-3.5 py-3 text-sm text-foreground outline-none focus:border-purple-500/70 focus:bg-background transition-colors resize-none placeholder:text-foreground-muted/60"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 py-2.5 rounded-xl border border-border bg-background-secondary text-sm font-semibold text-foreground hover:bg-background-tertiary transition-colors disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isPending}
                        className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <TriangleAlert size={16} />}
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    )
}
