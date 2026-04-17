'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ArrowLeftRight, CornerUpLeft, Info } from 'lucide-react'
import type { CreateReturnRequestPayload, ReturnItemPayload } from '@/lib/api/order.api'

interface OrderReturnModalProps {
    open: boolean
    onClose: () => void
    order: any
    onConfirm: (payload: CreateReturnRequestPayload) => void
    isLoading?: boolean
}

interface ItemState {
    selected: boolean
    qty: number
    action: 'EXCHANGE' | 'RETURN'
}

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Tiền mặt' },
    { value: 'BANK', label: 'Chuyển khoản' },
    { value: 'POINTS', label: 'Điểm thưởng' },
]

export function OrderReturnModal({
    open,
    onClose,
    order,
    onConfirm,
    isLoading,
}: OrderReturnModalProps) {
    const items: any[] = order?.items ?? []

    const initStates = () =>
        Object.fromEntries(
            items.map((item: any) => [
                item.id,
                { selected: false, qty: item.quantity, action: 'RETURN' as const },
            ]),
        )

    const [itemStates, setItemStates] = useState<Record<string, ItemState>>(initStates)
    const [globalReason, setGlobalReason] = useState('')
    const [refundAmount, setRefundAmount] = useState('')
    const [refundMethod, setRefundMethod] = useState('CASH')

    useEffect(() => {
        if (open) {
            setItemStates(initStates())
            setGlobalReason('')
            setRefundAmount('')
            setRefundMethod('CASH')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    if (!open) return null

    const selectedItems = items.filter((item) => itemStates[item.id]?.selected)
    const hasExchange = selectedItems.some((item) => itemStates[item.id]?.action === 'EXCHANGE')
    const hasReturn = selectedItems.some((item) => itemStates[item.id]?.action === 'RETURN')

    const calculatedCredit = selectedItems.reduce((sum, item) => {
        const state = itemStates[item.id]!
        const effectiveUnitPrice = item.unitPrice - (item.discountItem ?? 0) / item.quantity
        return sum + Math.max(0, effectiveUnitPrice * (state.qty || 1))
    }, 0)

    const fmt = (n: number) => n.toLocaleString('vi-VN')

    function toggleItem(id: string) {
        setItemStates((prev) => ({
            ...prev,
            [id]: { ...prev[id]!, selected: !prev[id]!.selected },
        }))
    }

    function updateItem(id: string, patch: Partial<ItemState>) {
        setItemStates((prev) => ({
            ...prev,
            [id]: { ...prev[id]!, ...patch },
        }))
    }

    function handleConfirm() {
        if (selectedItems.length === 0) return

        const returnItems: ReturnItemPayload[] = selectedItems.map((item) => {
            const state = itemStates[item.id]!
            return {
                orderItemId: item.id,
                quantity: Math.min(state.qty, item.quantity),
                action: state.action,
            }
        })

        const isFullReturn =
            selectedItems.length === items.length &&
            selectedItems.every((item) => itemStates[item.id]?.qty >= item.quantity)

        const payload: CreateReturnRequestPayload = {
            type: isFullReturn ? 'FULL' : 'PARTIAL',
            reason: globalReason.trim() || undefined,
            refundAmount: hasReturn ? (Number(refundAmount) || calculatedCredit) : undefined,
            refundMethod: hasReturn ? refundMethod : undefined,
            items: returnItems,
        }

        onConfirm(payload)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <ArrowLeftRight size={20} className="text-amber-600" />
                        Đổi/Trả hàng — #{order?.orderNumber}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-background-secondary transition-colors"
                    >
                        <X size={18} className="text-foreground-muted" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Item list */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                            Chọn sản phẩm cần đổi/trả
                        </p>
                        <div className="rounded-xl border border-border overflow-hidden">
                            {items.map((item: any, idx: number) => {
                                const state = itemStates[item.id]!
                                return (
                                    <div
                                        key={item.id}
                                        className={`px-4 py-3 transition-colors ${idx > 0 ? 'border-t border-border/60' : ''} ${state.selected ? 'bg-amber-50/60' : 'hover:bg-background-secondary/40'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                className="mt-1 h-4 w-4 accent-amber-500"
                                                checked={state.selected}
                                                onChange={() => toggleItem(item.id)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {item.description}
                                                    </span>
                                                    {item.sku && (
                                                        <span className="text-xs text-foreground-muted">{item.sku}</span>
                                                    )}
                                                    <span className="ml-auto text-xs text-foreground-muted whitespace-nowrap">
                                                        SL: {item.quantity} • {fmt(item.unitPrice)}đ
                                                    </span>
                                                </div>

                                                {state.selected && (
                                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                                        <div>
                                                            <label className="text-xs text-foreground-muted">Số lượng trả</label>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={item.quantity}
                                                                value={state.qty}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                                    updateItem(item.id, {
                                                                        qty: Math.min(Number(e.target.value), item.quantity),
                                                                    })
                                                                }
                                                                className="mt-1 h-8 w-full rounded-lg border border-border bg-background-secondary px-2 text-sm text-foreground outline-none focus:border-amber-500/70"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="text-xs text-foreground-muted">Hành động</label>
                                                            <div className="mt-1 flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateItem(item.id, { action: 'RETURN' })}
                                                                    className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border transition-colors ${state.action === 'RETURN'
                                                                            ? 'bg-rose-50 border-rose-400 text-rose-700 font-semibold'
                                                                            : 'border-border text-foreground-muted hover:bg-background-secondary'
                                                                        }`}
                                                                >
                                                                    <CornerUpLeft size={12} />
                                                                    Trả hàng
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateItem(item.id, { action: 'EXCHANGE' })}
                                                                    className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border transition-colors ${state.action === 'EXCHANGE'
                                                                            ? 'bg-sky-50 border-sky-400 text-sky-700 font-semibold'
                                                                            : 'border-border text-foreground-muted hover:bg-background-secondary'
                                                                        }`}
                                                                >
                                                                    <ArrowLeftRight size={12} />
                                                                    Đổi hàng
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Credit preview */}
                    {selectedItems.length > 0 && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-amber-800 font-semibold">Credit từ hàng đổi/trả</span>
                                <span className="font-bold text-amber-900">{fmt(calculatedCredit)}đ</span>
                            </div>
                            {hasExchange && (
                                <p className="text-xs text-amber-700 flex items-center gap-1">
                                    <Info size={12} className="shrink-0" />
                                    Đơn đổi mới sẽ được tạo với {fmt(calculatedCredit)}đ credit áp sẵn.
                                </p>
                            )}
                            {hasReturn && !hasExchange && (
                                <p className="text-xs text-amber-700 flex items-center gap-1">
                                    <Info size={12} className="shrink-0" />
                                    Cần hoàn {fmt(calculatedCredit)}đ tiền mặt/chuyển khoản cho khách.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Hoàn tiền section */}
                    {hasReturn && (
                        <div className="rounded-xl border border-border bg-background-secondary/40 px-4 py-3 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                                Thông tin hoàn tiền
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-foreground-muted">
                                        Số tiền hoàn (để trống = tự tính)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        placeholder={String(Math.round(calculatedCredit))}
                                        value={refundAmount}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setRefundAmount(e.target.value)
                                        }
                                        className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-amber-500/70"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-foreground-muted">Phương thức hoàn</label>
                                    <select
                                        value={refundMethod}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                            setRefundMethod(e.target.value)
                                        }
                                        className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-amber-500/70"
                                    >
                                        {PAYMENT_METHODS.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lý do chung */}
                    <div>
                        <label className="text-sm font-semibold text-foreground block mb-1.5">
                            Lý do đổi/trả (không bắt buộc)
                        </label>
                        <textarea
                            value={globalReason}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setGlobalReason(e.target.value)
                            }
                            placeholder="Khách không vừa ý, sản phẩm lỗi..."
                            rows={2}
                            className="w-full rounded-xl border border-border bg-background-secondary px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-amber-500/70 transition-colors resize-none placeholder:text-foreground-muted/60"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 py-2.5 rounded-xl border border-border bg-background-secondary text-sm font-semibold text-foreground hover:bg-background-tertiary transition-colors disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedItems.length === 0 || isLoading}
                            className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ArrowLeftRight size={16} />
                            )}
                            {hasExchange
                                ? `Đổi hàng (${selectedItems.length} sp)`
                                : `Trả hàng (${selectedItems.length} sp)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
