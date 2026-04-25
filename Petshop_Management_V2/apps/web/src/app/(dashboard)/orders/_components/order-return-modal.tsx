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
    const allItems: any[] = order?.items ?? []
    // Fix 1: Chỉ hiện sản phẩm vật lý — backend không xử lý đổi/trả cho dịch vụ
    const items: any[] = allItems.filter((item: any) => item.type === 'product')

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

    // Fix 3: Tách credit theo action type
    const exchangeCredit = selectedItems
        .filter((item) => itemStates[item.id]?.action === 'EXCHANGE')
        .reduce((sum, item) => {
            const state = itemStates[item.id]!
            const effectiveUnitPrice = item.unitPrice - (item.discountItem ?? 0) / item.quantity
            return sum + Math.max(0, effectiveUnitPrice * (state.qty || 1))
        }, 0)

    const returnRefund = selectedItems
        .filter((item) => itemStates[item.id]?.action === 'RETURN')
        .reduce((sum, item) => {
            const state = itemStates[item.id]!
            const effectiveUnitPrice = item.unitPrice - (item.discountItem ?? 0) / item.quantity
            return sum + Math.max(0, effectiveUnitPrice * (state.qty || 1))
        }, 0)

    const calculatedCredit = exchangeCredit + returnRefund

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

        // Fix 2: FULL chỉ khi tất cả product items được chọn, cùng action, và đủ qty
        const allSameAction = selectedItems.every((item) => itemStates[item.id]?.action === itemStates[selectedItems[0]!.id]?.action)
        const isFullReturn =
            allSameAction &&
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
                                        className={`px-4 py-3 transition-colors ${idx > 0 ? 'border-t border-border/60' : ''} ${state.selected ? 'bg-amber-500/8' : 'hover:bg-background-secondary/40'}`}
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
                                                                        ? 'bg-rose-500/12 border-rose-500/40 text-rose-500 font-semibold'
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
                                                                        ? 'bg-sky-500/12 border-sky-500/40 text-sky-500 font-semibold'
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
                    {/* Fix 3: Tách hiển thị exchange credit vs return refund */}
                    {selectedItems.length > 0 && (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 space-y-2">
                            {hasExchange && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-sky-500 font-semibold">Credit đổi hàng (đơn mới)</span>
                                    <span className="font-bold text-sky-400">{fmt(exchangeCredit)}đ</span>
                                </div>
                            )}
                            {hasReturn && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-rose-500 font-semibold">Hoàn tiền trả hàng</span>
                                    <span className="font-bold text-rose-400">{fmt(returnRefund)}đ</span>
                                </div>
                            )}
                            {hasExchange && hasReturn && (
                                <div className="flex justify-between text-sm border-t border-amber-500/20 pt-1.5">
                                    <span className="text-amber-500 font-semibold">Tổng credit</span>
                                    <span className="font-bold text-amber-400">{fmt(calculatedCredit)}đ</span>
                                </div>
                            )}
                            {hasExchange && (
                                <p className="text-xs text-sky-500/80 flex items-center gap-1">
                                    <Info size={12} className="shrink-0" />
                                    Đơn đổi mới sẽ được tạo với {fmt(exchangeCredit)}đ credit áp sẵn.
                                </p>
                            )}
                            {hasReturn && (
                                <p className="text-xs text-rose-500/80 flex items-center gap-1">
                                    <Info size={12} className="shrink-0" />
                                    Cần hoàn {fmt(returnRefund)}đ cho khách.
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
