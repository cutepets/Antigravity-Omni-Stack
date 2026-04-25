'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ArrowLeftRight, CornerUpLeft, Info, Trash2 } from 'lucide-react'
import type { CreateReturnRequestPayload, ExchangeOrderItemPayload, ReturnItemPayload } from '@/lib/api/order.api'
import { PosProductSearch } from '@/app/(dashboard)/pos/components/PosProductSearch'
import { buildProductCartItem } from '@/app/(dashboard)/_shared/cart/cart.builders'

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

function getReturnableQuantity(item: any) {
    return Math.max(0, Number(item?.returnAvailability?.returnableQuantity ?? item?.quantity ?? 0))
}

function getVariantLabel(item: any) {
    const raw = item?.variantName ?? item?.variantLabel ?? item?.productVariant?.variantLabel ?? item?.productVariant?.name
    const label = typeof raw === 'string' ? raw.trim() : ''
    const description = typeof item?.description === 'string' ? item.description.trim() : ''
    return label && label !== description ? label : ''
}

function getUnitLabel(item: any) {
    const raw = item?.unitLabel ?? item?.unit ?? item?.productVariant?.unitLabel
    return typeof raw === 'string' ? raw.trim() : ''
}

function getItemMetaParts(item: any) {
    return [item?.sku, getVariantLabel(item), getUnitLabel(item)]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
}

export function OrderReturnModal({
    open,
    onClose,
    order,
    onConfirm,
    isLoading,
}: OrderReturnModalProps) {
    const allItems: any[] = order?.items ?? []
    // Fix 1: Chỉ hiện sản phẩm vật lý — backend không xử lý đổi/trả cho dịch vụ
    const items: any[] = allItems.filter((item: any) => item.type === 'product' && getReturnableQuantity(item) > 0)

    const initStates = () =>
        Object.fromEntries(
            items.map((item: any) => [
                item.id,
                { selected: false, qty: getReturnableQuantity(item), action: 'RETURN' as const },
            ]),
        )

    const [itemStates, setItemStates] = useState<Record<string, ItemState>>(initStates)
    const [globalReason, setGlobalReason] = useState('')
    const [refundAmount, setRefundAmount] = useState('')
    const [refundMethod, setRefundMethod] = useState('CASH')
    const [exchangeItems, setExchangeItems] = useState<any[]>([])

    useEffect(() => {
        if (open) {
            setItemStates(initStates())
            setGlobalReason('')
            setRefundAmount('')
            setRefundMethod('CASH')
            setExchangeItems([])
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
    const exchangeOrderSubtotal = exchangeItems.reduce((sum, item) => {
        return sum + Number(item.unitPrice || 0) * Number(item.quantity || 0) - Number(item.discountItem || 0)
    }, 0)
    const exchangeRemaining = Math.max(0, exchangeOrderSubtotal - exchangeCredit)
    const exchangeSurplus = Math.max(0, exchangeCredit - exchangeOrderSubtotal)

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

    function mergeExchangeItem(item: any) {
        const cartItem = buildProductCartItem(item)
        setExchangeItems((current) => {
            const existingIndex = current.findIndex((entry) => entry.id === cartItem.id)
            if (existingIndex >= 0) {
                const nextItems = [...current]
                nextItems[existingIndex] = {
                    ...nextItems[existingIndex],
                    quantity: Number(nextItems[existingIndex].quantity || 0) + 1,
                }
                return nextItems
            }
            return [...current, cartItem]
        })
    }

    function updateExchangeItem(index: number, patch: Record<string, number>) {
        setExchangeItems((current) => current.map((item, itemIndex) => (
            itemIndex === index ? { ...item, ...patch } : item
        )))
    }

    function removeExchangeItem(index: number) {
        setExchangeItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
    }

    function handleConfirm() {
        if (selectedItems.length === 0) return

        const returnItems: ReturnItemPayload[] = selectedItems.map((item) => {
            const state = itemStates[item.id]!
            const returnableQuantity = getReturnableQuantity(item)
            return {
                orderItemId: item.id,
                quantity: Math.min(state.qty, returnableQuantity),
                action: state.action,
            }
        })

        // Fix 2: FULL chỉ khi tất cả product items được chọn, cùng action, và đủ qty
        const allSameAction = selectedItems.every((item) => itemStates[item.id]?.action === itemStates[selectedItems[0]!.id]?.action)
        const isFullReturn =
            allSameAction &&
            selectedItems.length === items.length &&
            selectedItems.every((item) => itemStates[item.id]?.qty >= getReturnableQuantity(item))

        const payload: CreateReturnRequestPayload = {
            type: isFullReturn ? 'FULL' : 'PARTIAL',
            reason: globalReason.trim() || undefined,
            refundAmount: hasReturn ? (Number(refundAmount) || returnRefund) : undefined,
            refundMethod: hasReturn ? refundMethod : undefined,
            items: returnItems,
            exchangeItems: hasExchange && exchangeItems.length > 0
                ? exchangeItems.map((item): ExchangeOrderItemPayload => ({
                    productId: item.productId,
                    productVariantId: item.productVariantId,
                    sku: item.sku,
                    description: item.description,
                    quantity: Number(item.quantity) || 1,
                    unitPrice: Number(item.unitPrice) || 0,
                    discountItem: Number(item.discountItem) || 0,
                    vatRate: Number(item.vatRate) || 0,
                    type: 'product',
                    isTemp: item.isTemp ?? false,
                    tempLabel: item.tempLabel,
                }))
                : undefined,
        }

        onConfirm(payload)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl">
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
                                const variantLabel = getVariantLabel(item)
                                const unitLabel = getUnitLabel(item)
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
                                                    {variantLabel && (
                                                        <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-xs font-semibold text-sky-500">{variantLabel}</span>
                                                    )}
                                                    {unitLabel && (
                                                        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-semibold text-emerald-500">{unitLabel}</span>
                                                    )}
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
                                                                max={getReturnableQuantity(item)}
                                                                value={state.qty}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                                    updateItem(item.id, {
                                                                        qty: Math.min(Number(e.target.value), getReturnableQuantity(item)),
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

                    {hasExchange && (
                        <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-sky-500">Sản phẩm đổi mới</p>
                                <span className="text-xs font-semibold text-foreground-muted">{exchangeItems.length} dòng</span>
                            </div>

                            <PosProductSearch
                                onSelect={mergeExchangeItem}
                                branchId={order?.branchId}
                                cartItems={exchangeItems}
                                outOfStockHidden
                                resultsVariant="order"
                                inputClassName="bg-background border border-border focus-within:border-sky-500/70"
                                panelClassName="fixed inset-0 z-[60] bg-background flex flex-col lg:block lg:absolute lg:top-full lg:left-0 lg:mt-1 lg:w-[500px] lg:bg-background lg:border lg:border-border lg:rounded-lg lg:shadow-xl lg:h-auto lg:max-h-[550px] lg:right-auto"
                            />

                            {exchangeItems.length > 0 && (
                                <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
                                    {exchangeItems.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className={`grid grid-cols-[1fr_72px_96px_96px_32px] items-center gap-2 px-3 py-2 ${index > 0 ? 'border-t border-border/60' : ''}`}
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-foreground">{item.description}</div>
                                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
                                                    {getItemMetaParts(item).length > 0
                                                        ? getItemMetaParts(item).map((part, partIndex) => (
                                                            <span key={`${part}-${partIndex}`} className="rounded-md bg-background-secondary px-1.5 py-0.5">{part}</span>
                                                        ))
                                                        : <span>Không có SKU</span>}
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                min={1}
                                                value={item.quantity}
                                                onChange={(event) => updateExchangeItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                                                className="h-8 rounded-lg border border-border bg-background-secondary px-2 text-sm text-foreground outline-none focus:border-sky-500/70"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                value={item.unitPrice}
                                                onChange={(event) => updateExchangeItem(index, { unitPrice: Math.max(0, Number(event.target.value) || 0) })}
                                                className="h-8 rounded-lg border border-border bg-background-secondary px-2 text-sm text-foreground outline-none focus:border-sky-500/70"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                value={item.discountItem ?? 0}
                                                onChange={(event) => updateExchangeItem(index, { discountItem: Math.max(0, Number(event.target.value) || 0) })}
                                                className="h-8 rounded-lg border border-border bg-background-secondary px-2 text-sm text-foreground outline-none focus:border-sky-500/70"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeExchangeItem(index)}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500"
                                                title="Xóa"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="rounded-lg border border-sky-500/20 bg-background/70 px-3 py-2 space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-foreground-muted">Credit đổi hàng</span>
                                    <span className="font-semibold text-sky-500">{fmt(exchangeCredit)}đ</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-foreground-muted">Giá trị hàng đổi mới</span>
                                    <span className="font-semibold text-foreground">{fmt(exchangeOrderSubtotal)}đ</span>
                                </div>
                                <div className="flex justify-between border-t border-border/60 pt-1.5">
                                    <span className="font-semibold text-foreground">{exchangeRemaining > 0 ? 'Còn phải thu' : 'Dư credit'}</span>
                                    <span className={`font-bold ${exchangeRemaining > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                        {fmt(exchangeRemaining > 0 ? exchangeRemaining : exchangeSurplus)}đ
                                    </span>
                                </div>
                            </div>
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
