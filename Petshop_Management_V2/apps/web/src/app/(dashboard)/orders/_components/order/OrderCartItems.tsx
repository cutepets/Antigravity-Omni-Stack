'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { CartItem } from '@petshop/shared'
import { getProductVariantOptionLabel } from '@petshop/shared'
import {
    ArrowLeftRight,
    ChevronDown,
    FileText,
    Info,
    Minus,
    Package,
    Plus,
    Scissors,
    ShoppingCart,
    Trash2,
    X,
} from 'lucide-react'
import { pricingApi } from '@/lib/api/pricing.api'
import { money, moneyRaw } from '@/app/(dashboard)/_shared/payment/payment.utils'
import {
    formatCartQuantityInput,
    getCartQuantityStep,
    parseCartQuantityInput,
    resolveCartUnitLabel,
    roundCartQuantity,
} from '@/app/(dashboard)/_shared/cart/cart.utils'
import { resolveCartItemStockState } from '@/app/(dashboard)/_shared/cart/stock.utils'
import type { CartItemCallbacks } from '@/app/(dashboard)/_shared/cart/cart.types'
import { CartStockPopover } from '@/app/(dashboard)/_shared/cart/CartStockPopover'
import { getCartItemWeightBandLabel } from '@/app/(dashboard)/pos/utils/pos.utils'
import { buildServiceImageMap, resolveCartServiceImage } from './service-image.utils'
import { buildOrderServiceDetailHref } from './order-service-links'
import { formatHotelStayRange } from './order-hotel-line'

// Re-export so consumers only need to import from here
export type { CartItemCallbacks }

// ── Spa Session Status Badge ─────────────────────────────────────────────────

const SPA_STATUS: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Chờ làm', className: 'bg-amber-500/12 text-amber-600' },
    IN_PROGRESS: { label: 'Đang làm', className: 'bg-blue-500/12 text-blue-600' },
    COMPLETED: { label: 'Hoàn thành', className: 'bg-emerald-500/12 text-emerald-600' },
    CANCELLED: { label: 'Đã hủy', className: 'bg-rose-500/12 text-rose-500 line-through' },
}

const HOTEL_STATUS: Record<string, { label: string; className: string }> = {
    BOOKED: { label: 'Đã đặt', className: 'bg-sky-500/12 text-sky-600' },
    CHECKED_IN: { label: 'Đang trông', className: 'bg-amber-500/12 text-amber-600' },
    CHECKED_OUT: { label: 'Đã trả', className: 'bg-emerald-500/12 text-emerald-600' },
    CANCELLED: { label: 'Đã hủy', className: 'bg-rose-500/12 text-rose-500 line-through' },
}

function ServiceDetailBadge({
    status,
    code,
    href,
    fallbackLabel,
}: {
    status?: string | null
    code?: string | null
    href?: string | null
    fallbackLabel: string
}) {
    const statusMap = fallbackLabel === 'Hotel' ? HOTEL_STATUS : SPA_STATUS
    const meta = status ? statusMap[status] ?? { label: status, className: 'bg-gray-500/12 text-gray-500' } : null
    const codeSeparator = fallbackLabel === 'Hotel' ? ' - ' : ' · '
    const label = `${meta?.label ?? fallbackLabel}${code ? `${codeSeparator}${code}` : ''}`
    const className = `inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta?.className ?? 'bg-gray-500/12 text-gray-500'} ${href ? 'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500' : ''}`

    if (!href) {
        return <span className={className}>{label}</span>
    }

    return (
        <Link href={href} target="_blank" rel="noopener noreferrer" className={className} title={`Mở chi tiết ${label}`}>
            {label}
        </Link>
    )
}


// ────────────────────────────────────────────────────────────────────────────
// OrderCartItems — cart list dùng system design tokens (ERP dashboard style)
// KHÔNG dùng usePosStore. Tất cả mutations đi qua `callbacks` (required).
// ────────────────────────────────────────────────────────────────────────────

export type OrderCartItemsProps = {
    cart: CartItem[]
    branchId?: string
    branches: any[]
    orderStatus?: string
    selectedRowIndex: number
    noteEditingId: string | null
    setNoteEditingId: (id: string | null) => void
    discountEditingId: string | null
    setDiscountEditingId: (id: string | null) => void
    callbacks: CartItemCallbacks  // required — không có store fallback
}

type OrderCartSwapProps = {
    onSwapItem?: (item: CartItem, swapKind: 'TEMP_PRODUCT' | 'GROOMING_MAIN') => void
}

// ── useSpaServiceImageMap ─────────────────────────────────────────────────────
// Fetches the packageCode→imageUrl map once (globally cached, never refetches).
// Also indexes by label (service name) so cart items can lookup by item.description.
function useSpaServiceImageMap() {
    const { data } = useQuery({
        queryKey: ['pricing', 'spa-service-images'],
        queryFn: () => pricingApi.getSpaServiceImages(),
        staleTime: Infinity,
        gcTime: Infinity,
    })
    return useMemo(() => buildServiceImageMap(Array.isArray(data) ? data : []), [data])
}

const normalizeLabel = (value?: string | null) => `${value ?? ''}`.trim().toLowerCase()

const getVariantOptionText = (productName: string, variant: any) => {
    const label = getProductVariantOptionLabel(productName, variant)
    return label || variant?.unitLabel || variant?.variantLabel || variant?.name || '—'
}

const BLOCKED_TEMP_SWAP_STATUSES = new Set(['CANCELLED'])
const BLOCKED_ORDER_SWAP_STATUSES = new Set(['CANCELLED', 'COMPLETED'])
const BLOCKED_GROOMING_SWAP_STATUSES = new Set(['CANCELLED', 'COMPLETED'])

function getCartItemServiceRole(item: CartItem) {
    const details = (item as any).groomingDetails
    return details?.serviceRole ?? details?.pricingSnapshot?.serviceRole ?? 'MAIN'
}

function canSwapTempProduct(item: CartItem, orderStatus?: string) {
    if (BLOCKED_TEMP_SWAP_STATUSES.has(String(orderStatus ?? ''))) return false
    return Boolean((item as any).isTemp && (item as any).orderItemId)
}

function canSwapGroomingMain(item: CartItem, orderStatus?: string) {
    if (BLOCKED_ORDER_SWAP_STATUSES.has(String(orderStatus ?? ''))) return false
    if (item.type !== 'grooming') return false
    if (!(item as any).orderItemId) return false
    if (getCartItemServiceRole(item) === 'EXTRA') return false

    const details = (item as any).groomingDetails
    const pricingRuleId = details?.pricingRuleId ?? details?.pricingSnapshot?.pricingRuleId ?? null
    if (!pricingRuleId) return false

    const groomingStatus = String((item as any).groomingSession?.status ?? '')
    if (BLOCKED_GROOMING_SWAP_STATUSES.has(groomingStatus)) return false

    return true
}

function SwapActionButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1 rounded-md border border-primary-500/25 bg-primary-500/6 px-2 py-0.5 text-[11px] font-semibold text-primary-600 transition-colors hover:border-primary-500/45 hover:bg-primary-500/10"
        >
            <ArrowLeftRight size={11} />
            Đổi
        </button>
    )
}

export function OrderCartItems({
    cart,
    branchId,
    branches,
    orderStatus,
    selectedRowIndex,
    noteEditingId,
    setNoteEditingId,
    discountEditingId,
    setDiscountEditingId,
    callbacks,
    onSwapItem,
}: OrderCartItemsProps & OrderCartSwapProps) {
    const activeBranches = useMemo(() => branches.filter((b: any) => b.isActive), [branches])

    if (cart.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-foreground-muted">
                <ShoppingCart size={56} className="opacity-20" />
                <p className="text-base font-medium">Đơn hàng trống</p>
                <p className="text-sm">Tìm kiếm sản phẩm để thêm vào đơn</p>
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Table header */}
            <div className="sticky top-0 z-10 hidden lg:grid grid-cols-[40px_32px_minmax(0,1fr)_90px_100px_110px_110px_120px] gap-2 border-b border-border bg-background-secondary/80 px-4 py-2">
                {['#', '', 'Sản phẩm', 'ĐVT', 'Số lượng', 'Đơn giá', 'Chiết khấu', 'Thành tiền'].map((h, i) => (
                    <div
                        key={i}
                        className={`text-[11px] font-semibold uppercase tracking-wide text-foreground-muted ${i >= 4 ? 'text-right' : ''} ${i === 0 ? 'text-center' : ''}`}
                    >
                        {h}
                    </div>
                ))}
            </div>

            {cart.map((item, idx) => (
                <OrderCartRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    branchId={branchId}
                    activeBranches={activeBranches}
                    orderStatus={orderStatus}
                    selectedRowIndex={selectedRowIndex}
                    noteEditingId={noteEditingId}
                    setNoteEditingId={setNoteEditingId}
                    discountEditingId={discountEditingId}
                    setDiscountEditingId={setDiscountEditingId}
                    callbacks={callbacks}
                    onSwapItem={onSwapItem}
                />
            ))}
        </div>
    )
}

// ── Row ──────────────────────────────────────────────────────────────────────

type OrderCartRowProps = {
    item: CartItem
    idx: number
    branchId?: string
    activeBranches: any[]
    orderStatus?: string
    selectedRowIndex: number
    noteEditingId: string | null
    setNoteEditingId: (id: string | null) => void
    discountEditingId: string | null
    setDiscountEditingId: (id: string | null) => void
    callbacks: CartItemCallbacks
    onSwapItem?: (item: CartItem, swapKind: 'TEMP_PRODUCT' | 'GROOMING_MAIN') => void
}

function OrderCartRow({
    item,
    idx,
    branchId,
    activeBranches,
    orderStatus,
    selectedRowIndex,
    noteEditingId,
    setNoteEditingId,
    discountEditingId,
    setDiscountEditingId,
    callbacks,
    onSwapItem,
}: OrderCartRowProps) {
    const spaImageMap = useSpaServiceImageMap()
    const {
        trueVariants,
        allConversionVariants,
        currentVariantObj,
        isCurrentConversion,
        currentTrueVariant,
        conversionVariants,
        isOverSellableQty,
    } = resolveCartItemStockState(item, branchId)

    const weightBandLabel = getCartItemWeightBandLabel(item)
    const currentQuantity = item.quantity || 1
    const itemDiscountAmount = item.discountItem || 0
    const discountedUnitPrice = Math.max(0, (item.unitPrice || 0) - itemDiscountAmount)
    const itemDiscountPercent =
        item.unitPrice && item.unitPrice > 0 ? Math.round((itemDiscountAmount / item.unitPrice) * 100) : 0
    const baseUnit = (item as any).baseUnit ?? item.unit ?? 'Cái'
    const cartUnitLabel = resolveCartUnitLabel(item) || baseUnit
    const normalizedDescription = normalizeLabel(item.description)
    const variantSuffix = item.variantName && normalizeLabel(item.variantName) !== normalizedDescription
        ? item.variantName
        : null
    const displayTrueVariants = trueVariants.filter((v: any) => {
        const lbl = normalizeLabel(getVariantOptionText(item.description, v))
        return lbl.length > 0 && lbl !== normalizedDescription
    })

    const updateVariant = (variantId: string) => callbacks.onUpdateItemVariant(item.id, variantId)
    const isSelected = idx === selectedRowIndex
    const canSwapTemp = canSwapTempProduct(item, orderStatus)
    const canSwapGrooming = canSwapGroomingMain(item, orderStatus)
    const serviceImage = resolveCartServiceImage(item, spaImageMap)
    const groomingSession = (item as any).groomingSession
    const groomingSessionId = (item as any).groomingSessionId ?? groomingSession?.id ?? null
    const groomingSessionCode = groomingSession?.sessionCode ?? (groomingSessionId ? String(groomingSessionId).slice(-6).toUpperCase() : null)
    const groomingDetailHref = buildOrderServiceDetailHref({
        kind: 'grooming',
        id: groomingSessionId,
        code: groomingSessionCode,
    })
    const hotelStay = (item as any).hotelStay
    const hotelStayId = (item as any).hotelStayId ?? (item.hotelDetails as any)?.stayId ?? hotelStay?.id ?? null
    const hotelStayCode = hotelStay?.stayCode ?? (item.hotelDetails as any)?.stayCode ?? (hotelStayId ? String(hotelStayId).slice(-6).toUpperCase() : null)
    const hotelStatus = hotelStay?.status ?? (item.hotelDetails as any)?.status ?? null
    const hotelDetailHref = buildOrderServiceDetailHref({
        kind: 'hotel',
        id: hotelStayId,
        code: hotelStayCode,
    })

    return (
        <div
            id={`order-cart-row-${item.id}`}
            className={[
                'group flex flex-col border-b border-border transition-colors duration-150',
                isSelected ? 'bg-primary-500/6' : 'hover:bg-primary-500/4',
            ].join(' ')}
        >
            {/* Desktop row */}
            <div className="hidden lg:grid grid-cols-[40px_32px_minmax(0,1fr)_90px_100px_110px_110px_120px] gap-2 items-start px-4 py-2.5">
                {/* # */}
                <div className="pt-1 text-center text-[13px] font-medium text-foreground-muted">{idx + 1}</div>

                {/* Delete — trước ảnh */}
                <div className="flex justify-center pt-1.5">
                    <button
                        onClick={() => callbacks.onRemoveItem(item.id)}
                        className="rounded p-1 text-foreground-muted/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500"
                        title="Xóa"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>

                {/* Product */}
                <div className="flex min-w-0 flex-col gap-0.5">
                    {/* Name + thumbnail */}
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Thumbnail */}
                        <div className="relative shrink-0 h-9 w-9 rounded border border-border bg-background-secondary flex items-center justify-center text-foreground-muted group/img">
                            {serviceImage ? (
                                <>
                                    <Image src={serviceImage} alt={item.description} width={36} height={36} unoptimized className="h-full w-full rounded object-cover" />
                                    <div className="absolute top-1/2 left-full ml-2 w-[180px] h-[180px] -translate-y-1/2 shadow-2xl rounded-lg border-2 border-border overflow-hidden opacity-0 invisible group-hover/img:opacity-100 group-hover/img:visible pointer-events-none transition-all z-50 origin-left">
                                        <Image src={serviceImage} alt={item.description} width={180} height={180} unoptimized className="h-full w-full object-cover" />
                                    </div>
                                </>
                            ) : item.type === 'service' || item.type === 'grooming' ? (
                                <Scissors size={16} />
                            ) : (
                                <Package size={16} />
                            )}
                        </div>

                        {/* Name + inline controls row 1 */}
                        <div className="flex min-w-0 flex-col gap-0.5">
                            {/* Dòng 1: Tên – weight – phiên bản – đổi – session */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="truncate text-[14px] font-semibold text-foreground" title={item.description}>
                                    {item.description}
                                </span>
                                {variantSuffix && (
                                    <span className="inline-flex shrink-0 items-center rounded bg-primary-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary-500">
                                        {variantSuffix}
                                    </span>
                                )}
                                {canSwapTemp && onSwapItem && (
                                    <SwapActionButton onClick={() => onSwapItem(item, 'TEMP_PRODUCT')} />
                                )}
                                {!canSwapTemp && canSwapGrooming && onSwapItem && (
                                    <SwapActionButton onClick={() => onSwapItem(item, 'GROOMING_MAIN')} />
                                )}
                                {/* Weight badge */}
                                {weightBandLabel && (
                                    <span className="inline-flex items-center rounded bg-primary-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">{weightBandLabel}</span>
                                )}
                                {/* True variant select */}
                                {displayTrueVariants.length > 0 && (
                                    <div className="relative inline-flex shrink-0 cursor-pointer items-center">
                                        <select
                                            className="appearance-none bg-transparent text-primary-600 text-[12px] font-semibold pr-4 pl-0.5 outline-none cursor-pointer hover:text-primary-700 transition-colors"
                                            value={currentTrueVariant?.id || (!isCurrentConversion && item.productVariantId) || ''}
                                            onChange={(e) => {
                                                const newId = e.target.value
                                                let targetId = newId
                                                if (isCurrentConversion && currentTrueVariant && currentVariantObj) {
                                                    const newTrueV = displayTrueVariants.find((v: any) => v.id === newId)
                                                    if (newTrueV && allConversionVariants) {
                                                        const curConvLabel = normalizeLabel(getVariantOptionText(item.description, currentVariantObj))
                                                        const newTrueLabel = normalizeLabel(newTrueV.variantLabel as string | null | undefined)
                                                        const match = allConversionVariants.find((cv: any) =>
                                                            normalizeLabel(getVariantOptionText(item.description, cv)) === curConvLabel &&
                                                            normalizeLabel(cv.variantLabel) === newTrueLabel
                                                        )
                                                        if (match) targetId = match.id
                                                    }
                                                }
                                                updateVariant(targetId)
                                            }}
                                        >
                                            <option value="base" className="hidden">Phiên bản</option>
                                            {displayTrueVariants.map((v: any) => (
                                                <option key={v.id} value={v.id}>{getVariantOptionText(item.description, v)}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-primary-500/50 pointer-events-none" size={11} />
                                    </div>
                                )}

                                {/* Grooming session badge — inline dòng 1 */}
                                {groomingSession && (
                                    <ServiceDetailBadge
                                        status={groomingSession.status}
                                        code={groomingSessionCode}
                                        href={groomingDetailHref}
                                        fallbackLabel="Spa"
                                    />
                                )}
                                <CartStockPopover item={item} currentTrueVariant={currentTrueVariant} activeBranches={activeBranches} />
                                {hotelStayId && (
                                    <ServiceDetailBadge
                                        status={hotelStatus}
                                        code={hotelStayCode}
                                        href={hotelDetailHref}
                                        fallbackLabel="Hotel"
                                    />
                                )}
                                {/* Hotel dates — cuối dòng 1 */}
                                {item.hotelDetails && (
                                    <span className="text-[10px] text-primary-600 bg-primary-500/8 rounded px-1.5 py-0.5 font-medium">
                                        {formatHotelStayRange(item.hotelDetails as any)}
                                    </span>
                                )}
                                {/* Grooming scheduled date — cuối dòng 1 */}
                                {item.type === 'grooming' && (item as any).groomingDetails?.scheduledDate && (
                                    <span className="inline-flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                                        📅 {new Date((item as any).groomingDetails.scheduledDate).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                            </div>

                            {/* Dòng 2: SKU – Barcode – Note (cùng hàng) */}
                            <div className="flex items-center gap-2 text-[11px] text-foreground-muted flex-wrap">
                                <span className="font-mono">{item.sku || 'N/A'}</span>
                                {(item as any).barcode ? (
                                    <span className="font-mono text-[10px] text-foreground-muted/50 border border-border/60 rounded px-1 bg-background-secondary">
                                        {(item as any).barcode}
                                    </span>
                                ) : null}
                                {/* Note button – inline dòng 2 */}
                                {noteEditingId === item.id ? (
                                    <input
                                        type="text"
                                        placeholder="Ghi chú..."
                                        defaultValue={item.itemNotes || ''}
                                        autoFocus
                                        onBlur={(e) => {
                                            if (e.target.value !== item.itemNotes) callbacks.onUpdateItemNotes(item.id, e.target.value)
                                            setNoteEditingId(null)
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { callbacks.onUpdateItemNotes(item.id, e.currentTarget.value); setNoteEditingId(null) }
                                            if (e.key === 'Escape') setNoteEditingId(null)
                                        }}
                                        className="h-5 w-40 rounded border border-amber-300 bg-amber-50/20 px-1.5 text-[11px] text-amber-700 placeholder:text-foreground-muted/40 outline-none focus:border-amber-500 transition-colors"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setNoteEditingId(item.id)}
                                        className="flex items-center gap-1 transition-colors"
                                        title={item.itemNotes ? 'Sửa ghi chú' : 'Thêm ghi chú'}
                                    >
                                        {item.itemNotes ? (
                                            <span className="flex items-center gap-1 italic text-amber-600 text-[11px]">
                                                <FileText size={10} className="shrink-0" />
                                                <span className="truncate max-w-[180px]">{item.itemNotes}</span>
                                            </span>
                                        ) : (
                                            <FileText size={10} className="text-foreground-muted/30 hover:text-foreground-muted transition-colors" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ĐVT column — conversion dropdown nếu có, otherwise plain text */}
                <div className="flex items-start justify-start pt-1.5">
                    {conversionVariants.length > 0 ? (
                        <div className="relative inline-flex shrink-0 cursor-pointer items-center">
                            <select
                                className={`appearance-none bg-transparent text-[12px] font-semibold outline-none cursor-pointer pr-4 pl-0.5 transition-colors ${isCurrentConversion
                                    ? 'text-primary-600 hover:text-primary-700'
                                    : 'text-foreground-muted hover:text-foreground'
                                    }`}
                                value={isCurrentConversion ? item.productVariantId : 'base'}
                                onChange={(e) => {
                                    if (e.target.value === 'base') updateVariant(currentTrueVariant ? currentTrueVariant.id : 'base')
                                    else updateVariant(e.target.value)
                                }}
                            >
                                <option value="base">{cartUnitLabel}</option>
                                {conversionVariants.map((v: any) => (
                                    <option key={v.id} value={v.id}>{getVariantOptionText(item.description, v)}</option>
                                ))}
                            </select>
                            <ChevronDown className={`absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none ${isCurrentConversion ? 'text-primary-500/60' : 'opacity-40'
                                }`} size={11} />
                        </div>
                    ) : (
                        <span className="text-[12px] font-medium text-foreground-muted">{cartUnitLabel}</span>
                    )}
                </div>

                {/* Quantity */}
                <div className="flex justify-end pt-1">
                    <OrderQuantityControl item={item} isOverSellableQty={isOverSellableQty} callbacks={callbacks} />
                </div>

                {/* Unit price */}
                <div className="pt-2 text-right text-[13px] font-medium text-foreground">
                    {moneyRaw(item.unitPrice || 0)}
                </div>

                {/* Discount */}
                <div className="relative flex justify-end pt-1">
                    <OrderDiscountEditor
                        item={item}
                        discountedUnitPrice={discountedUnitPrice}
                        itemDiscountAmount={itemDiscountAmount}
                        itemDiscountPercent={itemDiscountPercent}
                        isOpen={discountEditingId === item.id}
                        onClose={() => setDiscountEditingId(null)}
                        onOpen={() => setDiscountEditingId(item.id)}
                        callbacks={callbacks}
                    />
                </div>

                {/* Total */}
                <div className={`pt-2 text-right text-[14px] font-bold ${isOverSellableQty ? 'text-rose-500' : 'text-foreground'}`}>
                    {moneyRaw(discountedUnitPrice * currentQuantity)}
                </div>
            </div>

            {/* Mobile card */}
            <div className="flex lg:hidden gap-3 p-3 relative">
                <div className="relative h-14 w-14 shrink-0 rounded border border-border bg-background-secondary flex items-center justify-center text-foreground-muted">
                    {serviceImage ? (
                        <Image src={serviceImage} alt={item.description} width={56} height={56} unoptimized className="h-full w-full rounded object-cover" />
                    ) : item.type === 'service' || item.type === 'grooming' ? (
                        <Scissors size={22} />
                    ) : (
                        <Package size={22} />
                    )}
                </div>

                <div className="flex flex-1 flex-col gap-1 pr-8">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[14px] font-semibold text-foreground">{item.description}</span>
                        {canSwapTemp && onSwapItem && (
                            <SwapActionButton onClick={() => onSwapItem(item, 'TEMP_PRODUCT')} />
                        )}
                        {!canSwapTemp && canSwapGrooming && onSwapItem && (
                            <SwapActionButton onClick={() => onSwapItem(item, 'GROOMING_MAIN')} />
                        )}
                        {displayTrueVariants.length > 0 && (
                            <div className="relative inline-flex cursor-pointer items-center">
                                <select
                                    className="appearance-none bg-transparent text-primary-600 text-[13px] font-semibold pr-4 outline-none cursor-pointer"
                                    value={currentTrueVariant?.id || (!isCurrentConversion && item.productVariantId) || ''}
                                    onChange={(e) => updateVariant(e.target.value)}
                                >
                                    {displayTrueVariants.map((v: any) => (
                                        <option key={v.id} value={v.id}>{getVariantOptionText(item.description, v)}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" size={12} />
                            </div>
                        )}
                    </div>
                    <div className="text-[11px] text-foreground-muted">{item.sku || 'N/A'} {weightBandLabel ? `• ${weightBandLabel}` : ''}</div>

                    <OrderDiscountEditor
                        item={item}
                        discountedUnitPrice={discountedUnitPrice}
                        itemDiscountAmount={itemDiscountAmount}
                        itemDiscountPercent={itemDiscountPercent}
                        isOpen={discountEditingId === item.id}
                        onClose={() => setDiscountEditingId(null)}
                        onOpen={() => setDiscountEditingId(item.id)}
                        callbacks={callbacks}
                        mobile
                    />
                </div>

                <button
                    onClick={() => callbacks.onRemoveItem(item.id)}
                    className="absolute right-2 top-2 rounded p-1 text-foreground-muted/50 hover:text-rose-500 focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                    <X size={18} />
                </button>

                <div className="absolute bottom-2 right-2">
                    <OrderQuantityControl item={item} isOverSellableQty={isOverSellableQty} callbacks={callbacks} mobile />
                </div>
            </div>
        </div>
    )
}

// ── Quantity Control ─────────────────────────────────────────────────────────

function OrderQuantityControl({
    item,
    isOverSellableQty,
    callbacks,
    mobile = false,
}: {
    item: CartItem
    isOverSellableQty: boolean
    callbacks: CartItemCallbacks
    mobile?: boolean
}) {
    const step = getCartQuantityStep(item)
    const [draft, setDraft] = useState(() => formatCartQuantityInput(item.quantity ?? step, step))

    useEffect(() => {
        setDraft(formatCartQuantityInput(item.quantity ?? step, step))
    }, [item.quantity, step])

    const commit = (raw: string) => {
        const parsed = parseCartQuantityInput(raw)
        const next = Number.isNaN(parsed) ? step : roundCartQuantity(Math.max(step, parsed), step)
        callbacks.onUpdateQuantity(item.id, next)
        setDraft(formatCartQuantityInput(next, step))
    }

    const isHotel = item.type === 'hotel'
    const size = mobile ? 'px-2.5 py-1.5' : 'px-2 py-1'

    return (
        <div
            className={[
                'flex items-center rounded border overflow-hidden transition-colors',
                isHotel ? 'border-border bg-background-secondary/60 opacity-60' :
                    isOverSellableQty ? 'border-rose-500/60 bg-rose-500/5' :
                        'border-border bg-background focus-within:border-primary-500',
                mobile ? 'h-8' : 'h-7',
            ].join(' ')}
        >
            <button
                disabled={isHotel}
                onClick={() => {
                    const next = roundCartQuantity(Math.max(step, (item.quantity ?? step) - step), step)
                    callbacks.onUpdateQuantity(item.id, next)
                    setDraft(formatCartQuantityInput(next, step))
                }}
                className={`${size} transition-colors ${isOverSellableQty ? 'text-rose-500 hover:bg-rose-500/10' : 'text-foreground-muted hover:bg-primary-500/8'}`}
            >
                <Minus size={12} />
            </button>
            <input
                type="text"
                disabled={isHotel}
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { commit(e.currentTarget.value); e.currentTarget.blur() }
                    if (e.key === 'Escape') { setDraft(formatCartQuantityInput(item.quantity ?? step, step)); e.currentTarget.blur() }
                }}
                className={[
                    'w-9 border-none bg-transparent text-center text-[13px] font-bold outline-none',
                    isOverSellableQty ? 'text-rose-500' : 'text-foreground',
                ].join(' ')}
            />
            <button
                disabled={isHotel}
                onClick={() => {
                    const next = roundCartQuantity((item.quantity ?? step) + step, step)
                    callbacks.onUpdateQuantity(item.id, next)
                    setDraft(formatCartQuantityInput(next, step))
                }}
                className={`${size} transition-colors ${isOverSellableQty ? 'text-rose-500 hover:bg-rose-500/10' : 'text-foreground-muted hover:bg-primary-500/8'}`}
            >
                <Plus size={12} />
            </button>
        </div>
    )
}

// ── Discount Editor ──────────────────────────────────────────────────────────

function OrderDiscountEditor({
    item,
    discountedUnitPrice,
    itemDiscountAmount,
    itemDiscountPercent,
    isOpen,
    onClose,
    onOpen,
    callbacks,
    mobile = false,
}: {
    item: CartItem
    discountedUnitPrice: number
    itemDiscountAmount: number
    itemDiscountPercent: number
    isOpen: boolean
    onClose: () => void
    onOpen: () => void
    callbacks: CartItemCallbacks
    mobile?: boolean
}) {
    const update = (v: number) => callbacks.onUpdateDiscountItem(item.id, v)

    return (
        <>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={onClose} />
                    <div className="absolute top-full right-0 z-50 mt-1.5 w-64 rounded-xl border border-border bg-background p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                            <h4 className="text-[13px] font-bold text-foreground">Chiết khấu</h4>
                            <button className="text-foreground-muted hover:text-foreground transition-colors" onClick={onClose}><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-foreground-muted">VNĐ</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full rounded border border-border bg-background px-2.5 py-1.5 pr-6 text-right text-[13px] font-medium text-amber-600 outline-none transition-colors focus:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 placeholder:text-foreground-muted/30"
                                        placeholder="0"
                                        value={item.discountItem ? money(item.discountItem) : ''}
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value.replace(/\D/g, ''), 10)
                                            update(Number.isNaN(v) ? 0 : v)
                                        }}
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-amber-500">đ</span>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-foreground-muted">%</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full rounded border border-border bg-background px-2.5 py-1.5 pr-6 text-right text-[13px] font-medium text-amber-600 outline-none transition-colors focus:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 placeholder:text-foreground-muted/30"
                                        placeholder="0"
                                        value={itemDiscountAmount > 0 && item.unitPrice ? itemDiscountPercent : ''}
                                        onChange={(e) => {
                                            const pct = parseFloat(e.target.value.replace(/[^\d.]/g, ''))
                                            const clamped = Number.isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct))
                                            update(Math.round((item.unitPrice || 0) * (clamped / 100)))
                                        }}
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-amber-500">%</span>
                                </div>
                            </div>
                        </div>
                        {(item.discountItem ?? 0) > 0 && (
                            <div className="mt-3 flex justify-between border-t border-border pt-2 text-[12px]">
                                <span className="text-foreground-muted">Giảm</span>
                                <span className="font-bold text-amber-600">-{money(itemDiscountAmount)} ({itemDiscountPercent}%)</span>
                            </div>
                        )}
                    </div>
                </>
            )}

            {mobile ? (
                <div>
                    <button
                        type="button"
                        onClick={onOpen}
                        className="border-b border-dashed border-border pb-0.5 text-[14px] font-medium text-foreground hover:border-primary-500 transition-colors"
                    >
                        {moneyRaw(discountedUnitPrice)}
                    </button>
                    {itemDiscountAmount > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                            <span>-{itemDiscountPercent}%</span>
                            <span className="opacity-70">(-{money(itemDiscountAmount)})</span>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onOpen}
                    className="flex flex-col items-end gap-0.5"
                >
                    <span className="border-b border-dashed border-border text-[13px] font-medium text-foreground hover:border-primary-500 transition-colors pb-0.5">
                        {itemDiscountAmount > 0 ? (
                            <span className="text-amber-600">{money(itemDiscountAmount)}</span>
                        ) : (
                            <span className="text-foreground-muted/40">—</span>
                        )}
                    </span>
                    {itemDiscountAmount > 0 && (
                        <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/8 px-1 py-0.5 rounded">
                            -{itemDiscountPercent}%
                        </span>
                    )}
                </button>
            )}
        </>
    )
}

// ── Stock Info Popover ───────────────────────────────────────────────────────

function OrderStockInfo({ item, currentTrueVariant, activeBranches }: { item: CartItem; currentTrueVariant: any; activeBranches: any[] }) {
    const targetStockInfo = currentTrueVariant ?? item
    const branchStocks = Array.isArray((targetStockInfo as any).branchStocks) ? (targetStockInfo as any).branchStocks : []
    const isService = item.type !== 'product'
    const defaultFallback = isService ? '∞' : '—'
    const headerName = (item as any).currentVariantObj?.name || item.description
    const headerSku = item.sku || currentTrueVariant?.sku || 'N/A'

    return (
        <div className="group/info relative shrink-0">
            <Info size={14} className="cursor-help text-border opacity-0 transition-all group-hover:opacity-100 group-hover/info:text-primary-500" />
            <div className="absolute left-1/2 top-full z-50 mt-2 w-[320px] translate-x-[-40%] pointer-events-none opacity-0 invisible transition-all group-hover/info:pointer-events-auto group-hover/info:opacity-100 group-hover/info:visible before:absolute before:-top-4 before:left-0 before:h-4 before:w-full">
                <div className="rounded-xl border border-border bg-background shadow-xl overflow-hidden">
                    <div className="border-b border-border bg-background-secondary/60 px-4 py-3">
                        <Link href={item.productId ? `/products/${item.productId}` : '#'} target="_blank" className="block text-[13px] font-bold text-foreground hover:text-primary-600 hover:underline transition-colors">
                            {headerName}
                        </Link>
                        <div className="text-[10px] text-foreground-muted mt-0.5 font-medium uppercase tracking-wide">{headerSku}</div>
                    </div>
                    <div className="px-4 py-3">
                        <table className="w-full text-xs text-right whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-border text-foreground-muted">
                                    <th className="pb-2 text-left font-semibold"></th>
                                    <th className="px-2 pb-2 font-semibold">TỒN</th>
                                    <th className="px-2 pb-2 font-semibold text-primary-600">KHẢ DỤNG</th>
                                    <th className="pl-2 pb-2 font-semibold">ĐỂ BÁN</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-border/50">
                                    <td className="py-2 text-left font-semibold text-foreground">Tổng</td>
                                    <td className="px-2 py-2">{isService ? defaultFallback : (targetStockInfo as any).stock ?? defaultFallback}</td>
                                    <td className="px-2 py-2 font-bold text-primary-600">
                                        {isService ? defaultFallback : (targetStockInfo as any).availableStock ?? defaultFallback}
                                    </td>
                                    <td className="pl-2 py-2">{isService ? defaultFallback : (targetStockInfo as any).trading ?? defaultFallback}</td>
                                </tr>
                                {activeBranches.map((branch: any) => {
                                    const bs = branchStocks.find((s: any) => s.branchId === branch.id || s.branch?.id === branch.id)
                                    const stock = bs ? bs.stock ?? 0 : 0
                                    const reserved = bs ? bs.reservedStock ?? 0 : 0
                                    const avail = bs?.availableStock ?? stock - reserved
                                    return (
                                        <tr key={branch.id} className="border-b border-border/30 border-dashed last:border-0">
                                            <td className="py-1.5 text-left font-medium text-foreground-muted truncate max-w-[120px]">{branch.name}</td>
                                            <td className="px-2 py-1.5">{isService ? defaultFallback : stock}</td>
                                            <td className="px-2 py-1.5 text-primary-600/70">{isService ? defaultFallback : avail}</td>
                                            <td className="pl-2 py-1.5">{defaultFallback}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
