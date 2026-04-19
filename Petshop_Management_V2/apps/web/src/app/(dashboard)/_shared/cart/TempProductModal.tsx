'use client'

import { useState } from 'react'
import { X, Package2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface TempProductModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (item: { description: string; quantity: number; unitPrice: number }) => void
}

/**
 * TempProductModal — Shared modal thêm sản phẩm tạm cho POS và Orders.
 * Dùng CSS design tokens — tương thích Dark Mode.
 */
export function TempProductModal({ isOpen, onClose, onConfirm }: TempProductModalProps) {
    const [description, setDescription] = useState('')
    const [quantity, setQuantity] = useState('1')
    const [unitPrice, setUnitPrice] = useState('')

    if (!isOpen) return null

    const parsedQty = Math.max(1, parseFloat(quantity) || 1)
    const parsedPrice = parseFloat(unitPrice) || 0
    const total = parsedQty * parsedPrice

    const handleSubmit = () => {
        if (!description.trim() || parsedPrice <= 0) return
        onConfirm({ description: description.trim(), quantity: parsedQty, unitPrice: parsedPrice })
        setDescription('')
        setQuantity('1')
        setUnitPrice('')
        onClose()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit()
        if (e.key === 'Escape') onClose()
    }

    return (
        <div
            className="fixed inset-0 z-999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onKeyDown={handleKeyDown}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                            <Package2 size={16} />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-semibold text-foreground">Sản phẩm tạm</h2>
                            <p className="text-xs text-foreground-muted">Bán nhanh, chưa có trong kho</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-background-secondary hover:text-foreground transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    <label className="block space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                            Tên sản phẩm <span className="text-error">*</span>
                        </span>
                        <input
                            autoFocus
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Nhập tên sản phẩm..."
                            className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary-500 focus:bg-background focus:ring-2 focus:ring-primary-500/20 placeholder:text-foreground-muted"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Số lượng</span>
                            <input
                                type="number"
                                min={0.01}
                                step={1}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2.5 text-sm text-center font-semibold text-foreground outline-none transition-colors focus:border-primary-500 focus:bg-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                        </label>

                        <label className="block space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                                Đơn giá <span className="text-error">*</span>
                            </span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2.5 pr-6 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary-500 focus:bg-background placeholder:text-foreground-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground-muted">đ</span>
                            </div>
                        </label>
                    </div>

                    {parsedPrice > 0 && (
                        <div className="flex items-center justify-between rounded-xl bg-amber-500/8 px-4 py-3 border border-amber-500/20">
                            <span className="text-sm text-amber-600">Thành tiền</span>
                            <span className="text-lg font-bold text-amber-600">{formatCurrency(total)}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 pb-5">
                    <button
                        onClick={onClose}
                        className="flex-1 h-10 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-background-secondary transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!description.trim() || parsedPrice <= 0}
                        className="flex-1 h-10 rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Thêm vào đơn
                    </button>
                </div>
            </div>
        </div>
    )
}
