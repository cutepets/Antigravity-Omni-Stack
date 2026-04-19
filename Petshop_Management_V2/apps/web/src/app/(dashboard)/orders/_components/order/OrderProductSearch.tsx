'use client'

import { useState } from 'react'
import { Eye, EyeOff, ListChecks, Package2, BedDouble, Tag } from 'lucide-react'
import { PosProductSearch, type PosProductSearchProps } from '@/app/(dashboard)/pos/components/PosProductSearch'
import { TempProductModal } from '@/app/(dashboard)/_shared/cart/TempProductModal'

// OrderProductSearch — search bar dùng system design tokens.
// Thêm toggles: Ẩn hàng hết, Chọn nhiều, Báo giá Hotel, Sản phẩm tạm, Khuyến mãi (placeholder)

type OrderProductSearchProps = Omit<PosProductSearchProps, 'inputClassName' | 'containerClassName' | 'panelClassName' | 'resultsVariant'> & {
    /** Callback khi user thêm sản phẩm tạm */
    onAddTempProduct?: (item: { description: string; quantity: number; unitPrice: number }) => void
    /** Callback khi user bấm nút Báo giá Hotel */
    onOpenHotelCalc?: () => void
    /** Chỉ hiện các nút action khi isEditing */
    isEditing?: boolean
}

export function OrderProductSearch(props: OrderProductSearchProps) {
    const { onAddTempProduct, onOpenHotelCalc, isEditing, ...searchProps } = props
    const [outOfStockHidden, setOutOfStockHidden] = useState(false)
    const [showTempModal, setShowTempModal] = useState(false)

    return (
        <>
            <div className="flex flex-1 items-center gap-2 min-w-0">
                <PosProductSearch
                    {...searchProps}
                    outOfStockHidden={outOfStockHidden}
                    resultsVariant="pos"
                    inputClassName={[
                        'bg-background-secondary/60 border border-border',
                        'focus-within:border-primary-500 focus-within:bg-background',
                    ].join(' ')}
                />

                {/* Toggle: Ẩn hàng hết */}
                <button
                    type="button"
                    title={outOfStockHidden ? 'Đang ẩn hàng hết — bấm để hiện lại' : 'Ẩn hàng hết hàng'}
                    onClick={() => setOutOfStockHidden((v) => !v)}
                    className={[
                        'shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-150',
                        outOfStockHidden
                            ? 'border-primary-500/40 bg-primary-500/10 text-primary-600'
                            : 'border-border bg-background-secondary/50 text-foreground-muted hover:border-border-strong hover:text-foreground',
                    ].join(' ')}
                >
                    {outOfStockHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>

                {/* Toggle: Chọn nhiều */}
                <button
                    type="button"
                    title={searchProps.isMultiSelectValue ? 'Đang chọn nhiều — bấm để tắt' : 'Bật chọn nhiều sản phẩm'}
                    onClick={() => searchProps.onSetMultiSelect?.(!searchProps.isMultiSelectValue)}
                    className={[
                        'shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-150',
                        searchProps.isMultiSelectValue
                            ? 'border-primary-500/40 bg-primary-500/10 text-primary-600'
                            : 'border-border bg-background-secondary/50 text-foreground-muted hover:border-border-strong hover:text-foreground',
                    ].join(' ')}
                >
                    <ListChecks size={14} />
                </button>

                {/* Phân cách */}
                <div className="h-5 w-px bg-border/60 shrink-0" />

                {/* Nút: Báo giá Hotel */}
                <button
                    type="button"
                    title="Báo giá tính thử hotel"
                    onClick={onOpenHotelCalc}
                    disabled={!onOpenHotelCalc}
                    className="shrink-0 flex h-8 items-center gap-1.5 px-2.5 rounded-lg border border-border bg-background-secondary/50 text-foreground-muted text-[12px] font-medium hover:border-sky-500/40 hover:bg-sky-500/8 hover:text-sky-600 transition-colors duration-150 disabled:opacity-40 disabled:cursor-default"
                >
                    <BedDouble size={13} />
                    <span className="hidden xl:block">Báo giá Hotel</span>
                </button>

                {/* Nút: Sản phẩm tạm */}
                <button
                    type="button"
                    title="Thêm sản phẩm tạm (chưa có trong kho)"
                    onClick={() => setShowTempModal(true)}
                    disabled={!isEditing}
                    className="shrink-0 flex h-8 items-center gap-1.5 px-2.5 rounded-lg border border-border bg-background-secondary/50 text-foreground-muted text-[12px] font-medium hover:border-amber-500/40 hover:bg-amber-500/8 hover:text-amber-600 transition-colors duration-150 disabled:opacity-40 disabled:cursor-default"
                >
                    <Package2 size={13} />
                    <span className="hidden xl:block">SP Tạm</span>
                </button>

                {/* Nút: Khuyến mãi — placeholder, phát triển sau */}
                <button
                    type="button"
                    title="Khuyến mãi — đang phát triển"
                    disabled
                    className="shrink-0 flex h-8 items-center gap-1.5 px-2.5 rounded-lg border border-border bg-background-secondary/50 text-foreground-muted/40 text-[12px] font-medium cursor-not-allowed opacity-50"
                >
                    <Tag size={13} />
                    <span className="hidden xl:block">Khuyến mãi</span>
                </button>
            </div>

            {/* Modal: Sản phẩm tạm */}
            <TempProductModal
                isOpen={showTempModal}
                onClose={() => setShowTempModal(false)}
                onConfirm={(item) => {
                    onAddTempProduct?.(item)
                    setShowTempModal(false)
                }}
            />
        </>
    )
}
