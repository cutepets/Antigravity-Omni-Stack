'use client'
import { useState } from 'react'
import { X, Package2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PosTempProductModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (item: { description: string; quantity: number; unitPrice: number }) => void
}

export function PosTempProductModal({ isOpen, onClose, onConfirm }: PosTempProductModalProps) {
    const [description, setDescription] = useState('')
    const [quantity, setQuantity] = useState('1')
    const [unitPrice, setUnitPrice] = useState('')

    if (!isOpen) return null

    const parsedQty = Math.max(1, parseFloat(quantity) || 1)
    const parsedPrice = parseFloat(unitPrice) || 0
    const total = parsedQty * parsedPrice

    const handleSubmit = () => {
        if (!description.trim()) return
        if (parsedPrice <= 0) return
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
            className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onKeyDown={handleKeyDown}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                            <Package2 size={16} />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-semibold text-gray-900">Sản phẩm tạm</h2>
                            <p className="text-xs text-gray-400">Bán nhanh, chưa có trong kho</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Tên sản phẩm */}
                    <label className="block space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Tên sản phẩm <span className="text-red-500">*</span>
                        </span>
                        <input
                            autoFocus
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Nhập tên sản phẩm..."
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 placeholder:text-gray-400"
                        />
                    </label>

                    {/* Số lượng + Đơn giá */}
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Số lượng</span>
                            <input
                                type="number"
                                min={0.01}
                                step={1}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-center font-semibold text-gray-900 outline-none transition-colors focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                        </label>

                        <label className="block space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Đơn giá <span className="text-red-500">*</span>
                            </span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-6 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 placeholder:text-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">đ</span>
                            </div>
                        </label>
                    </div>

                    {/* Preview tổng */}
                    {parsedPrice > 0 && (
                        <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 border border-amber-100">
                            <span className="text-sm text-amber-700">Thành tiền</span>
                            <span className="text-lg font-bold text-amber-700">{formatCurrency(total)}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 pb-5">
                    <button
                        onClick={onClose}
                        className="flex-1 h-10 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
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
